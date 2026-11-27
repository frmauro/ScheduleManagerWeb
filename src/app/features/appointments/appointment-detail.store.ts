import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, tap, throwError, type Observable, type Subscription } from 'rxjs';
import { AppointmentsApi } from '../../core/api/appointments.api';
import { SessionStore } from '../../core/auth/session.store';
import { availableActions, type AppointmentAction } from '../../core/domain/appointment-actions';
import { ApiError, isApiError } from '../../core/errors/api-error';
import { resolveErrorMessage } from '../../core/errors/error-messages';
import { ToastService } from '../../core/feedback/toast.service';
import { APPOINTMENT_MESSAGES } from '../../core/i18n/appointments.messages';
import type {
  AdminCancelRequest,
  Appointment,
  CancelRequest,
  Uuid,
  Versioned,
} from '../../core/models/api-models';

export type DetailStatus = 'loading' | 'ready' | 'error';

/** Outra pessoa alterou o agendamento: avisa e recarrega (FR-048). */
const CONFLICT_CODES = ['appointment.precondition_failed', 'appointment.concurrency_conflict'];
/** A ação deixou de valer para o status real: recarrega para mostrar o atual (FR-047). */
const STALE_CODES = ['appointment.invalid_transition', 'appointment.already_started'];

/** Intervalo para reavaliar as ações (ex.: "Concluir" aparece quando o início chega). */
const CLOCK_TICK_MS = 15_000;

/**
 * Estado do detalhe do agendamento (data-model §4 "AppointmentDetailState"): o `etag` exibido
 * vai em cada ação e é trocado pelo novo da resposta (R9). Escopo da página.
 */
@Injectable()
export class AppointmentDetailStore {
  private readonly api = inject(AppointmentsApi);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);

  private readonly appointmentState = signal<Appointment | null>(null);
  private readonly etagState = signal<string | null>(null);
  private readonly statusState = signal<DetailStatus>('loading');
  private readonly loadErrorState = signal<ApiError | null>(null);
  private readonly pendingState = signal<AppointmentAction | null>(null);
  private readonly noticeState = signal<string | null>(null);
  private readonly now = signal(Date.now());

  readonly appointment = this.appointmentState.asReadonly();
  readonly etag = this.etagState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();
  readonly pendingAction = this.pendingState.asReadonly();
  /** Mensagem da última ação recusada (catálogo por `code`). */
  readonly notice = this.noticeState.asReadonly();

  readonly actions = computed<AppointmentAction[]>(() => {
    const appointment = this.appointmentState();
    const role = this.session.role();
    return appointment && role ? availableActions(appointment, role, this.now()) : [];
  });

  private id: Uuid | null = null;
  private loading?: Subscription;

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.loading?.unsubscribe();
    });
  }

  load(id: Uuid): void {
    this.id = id;
    this.noticeState.set(null);
    this.fetch();
  }

  /** Busca de novo mantendo o aviso atual (ex.: depois de um conflito). */
  reload(): void {
    this.fetch();
  }

  confirm(): void {
    this.run('confirm', (id, etag) => this.api.confirm(id, etag));
  }

  complete(): void {
    this.run('complete', (id, etag) => this.api.complete(id, etag));
  }

  /**
   * Para o `cancel-dialog`: o diálogo mostra o erro; aqui o resultado atualiza o estado e os
   * conflitos recarregam o detalhe.
   */
  cancelRequest(body: CancelRequest | AdminCancelRequest): Observable<Versioned<Appointment>> {
    const id = this.id;
    const etag = this.etagState();
    if (!id || !etag) {
      return throwError(() => new ApiError({ kind: 'unknown', status: 0 }));
    }
    this.noticeState.set(null);
    this.pendingState.set('cancel');
    return this.api.cancel(id, etag, body).pipe(
      tap((result) => this.applyAction('cancel', result)),
      catchError((error: unknown) => {
        this.handleActionError(error);
        return throwError(() => error);
      }),
      finalize(() => this.pendingState.set(null)),
    );
  }

  private run(
    action: AppointmentAction,
    call: (id: Uuid, etag: string) => Observable<Versioned<Appointment>>,
  ): void {
    const id = this.id;
    const etag = this.etagState();
    if (!id || !etag || this.pendingState()) {
      return;
    }
    this.noticeState.set(null);
    this.pendingState.set(action);
    call(id, etag)
      .pipe(finalize(() => this.pendingState.set(null)))
      .subscribe({
        next: (result) => this.applyAction(action, result),
        error: (error: unknown) => this.handleActionError(error),
      });
  }

  private applyAction(action: AppointmentAction, result: Versioned<Appointment>): void {
    this.apply(result);
    const done = APPOINTMENT_MESSAGES.done;
    this.toast.success(
      action === 'confirm' ? done.confirm : action === 'complete' ? done.complete : done.cancel,
    );
  }

  private apply(result: Versioned<Appointment>): void {
    this.appointmentState.set(result.value);
    this.etagState.set(result.etag);
    this.now.set(Date.now());
  }

  private handleActionError(error: unknown): void {
    const apiError = isApiError(error) ? error : new ApiError({ kind: 'unknown', status: 0 });
    this.noticeState.set(resolveErrorMessage(apiError));
    if (apiError.hasCode(...CONFLICT_CODES, ...STALE_CODES)) {
      this.reload();
    }
  }

  private fetch(): void {
    const id = this.id;
    if (!id) {
      return;
    }
    this.loading?.unsubscribe();
    if (!this.appointmentState()) {
      this.statusState.set('loading');
    }
    this.loading = this.api.get(id).subscribe({
      next: (result) => {
        this.apply(result);
        this.loadErrorState.set(null);
        this.statusState.set('ready');
      },
      error: (error: unknown) => {
        this.loadErrorState.set(
          isApiError(error) ? error : new ApiError({ kind: 'unknown', status: 0 }),
        );
        this.appointmentState.set(null);
        this.statusState.set('error');
      },
    });
  }
}
