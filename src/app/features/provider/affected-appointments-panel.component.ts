import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { AppointmentsApi } from '../../core/api/appointments.api';
import { APP_PATHS } from '../../core/config/app-paths';
import { isApiError } from '../../core/errors/api-error';
import { resolveErrorMessage } from '../../core/errors/error-messages';
import { DialogService } from '../../core/feedback/dialog.service';
import { ToastService } from '../../core/feedback/toast.service';
import { PROVIDER_MESSAGES } from '../../core/i18n/provider.messages';
import type { AppointmentSummary, Uuid } from '../../core/models/api-models';
import { AffectedAppointmentsListComponent } from '../../shared/ui/affected-appointments-list.component';
import { openCancelDialog } from '../appointments/cancel-dialog.component';

/**
 * Painel de agendamentos afetados (FR-043): explica que **não** foram cancelados
 * automaticamente e permite abrir ou cancelar cada um.
 */
@Component({
  selector: 'sm-affected-appointments-panel',
  standalone: true,
  imports: [AffectedAppointmentsListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
      <section
        class="sm-card border-tone-warning-fg"
        aria-labelledby="sm-affected-title"
        data-testid="affected-panel"
      >
        <h2 id="sm-affected-title" class="text-lg">{{ text.title }}</h2>
        <p class="mt-1 text-sm text-gray-700">{{ text.description }}</p>
        <div class="mt-3">
          <sm-affected-appointments-list
            [appointments]="items()"
            [timeZoneId]="timeZoneId()"
            [busyId]="busyId()"
            (openAppointment)="openAppointment($event)"
            (cancelAppointment)="cancelAppointment($event)"
          />
        </div>
      </section>
    }
  `,
})
export class AffectedAppointmentsPanelComponent {
  readonly appointments = input.required<readonly AppointmentSummary[]>();
  readonly timeZoneId = input.required<string>();

  private readonly api = inject(AppointmentsApi);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly text = PROVIDER_MESSAGES.affected;
  protected readonly items = signal<readonly AppointmentSummary[]>([]);
  protected readonly busyId = signal<Uuid | null>(null);

  constructor() {
    effect(() => {
      const list = this.appointments();
      untracked(() => this.items.set(list));
    });
  }

  protected openAppointment(id: Uuid): void {
    void this.router.navigateByUrl(APP_PATHS.providerArea.appointment(id));
  }

  /** Busca o `etag` atual e cancela com `If-Match` (R9); some da lista ao concluir. */
  protected cancelAppointment(id: Uuid): void {
    this.busyId.set(id);
    const sub = this.api
      .get(id)
      .pipe(
        switchMap(({ etag }) =>
          openCancelDialog(this.dialogs, {
            submit: (body) => this.api.cancel(id, etag, body),
          }),
        ),
        finalize(() => this.busyId.set(null)),
      )
      .subscribe({
        next: (result) => {
          if (result) {
            this.items.update((list) => list.filter((a) => a.id !== id));
            this.toast.success(this.text.cancelled);
          }
        },
        error: (error: unknown) => {
          if (isApiError(error)) {
            this.toast.error(resolveErrorMessage(error));
          }
        },
      });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
