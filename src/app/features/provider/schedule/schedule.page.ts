import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize, startWith, Subject, switchMap } from 'rxjs';
import { ScheduleApi } from '../../../core/api/schedule.api';
import { ApiError, isApiError } from '../../../core/errors/api-error';
import { resolveErrorMessage } from '../../../core/errors/error-messages';
import { ToastService } from '../../../core/feedback/toast.service';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { AppointmentSummary, WeeklySchedule } from '../../../core/models/api-models';
import {
  LOADING,
  ready,
  toRemoteState,
  type RemoteState,
} from '../../../shared/state/remote-state';
import {
  RemoteReadyDirective,
  RemoteViewComponent,
} from '../../../shared/ui/remote-view.component';
import { AffectedAppointmentsPanelComponent } from '../affected-appointments-panel.component';
import { ScheduleEditorComponent } from './schedule-editor.component';

/**
 * Expediente semanal (`/prestador/expediente`, FR-041, FR-043): o fuso é só leitura; salvar
 * substitui o expediente inteiro e lista os agendamentos que ficaram fora dele.
 */
@Component({
  selector: 'sm-schedule-page',
  standalone: true,
  imports: [
    AffectedAppointmentsPanelComponent,
    RemoteReadyDirective,
    RemoteViewComponent,
    ScheduleEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      <sm-remote-view [state]="state()" [skeletonRows]="5" (retry)="reload()">
        <ng-template [smRemoteReady]="state()" let-schedule>
          <dl class="mt-4 text-sm">
            <dt class="font-medium">{{ text.timeZone }}</dt>
            <dd data-testid="schedule-time-zone">{{ schedule.timeZoneId }}</dd>
            <dd class="sm-hint">{{ text.timeZoneHint }}</dd>
          </dl>

          @if (affected().length > 0) {
            <div class="mt-4">
              <sm-affected-appointments-panel
                [appointments]="affected()"
                [timeZoneId]="schedule.timeZoneId ?? ''"
              />
            </div>
          }

          <div class="mt-4">
            <sm-schedule-editor [schedule]="schedule" [saving]="saving()" (save)="save($event)" />
          </div>
        </ng-template>
      </sm-remote-view>
    </section>
  `,
})
export class SchedulePageComponent {
  private readonly api = inject(ScheduleApi);
  private readonly toast = inject(ToastService);
  private readonly reload$ = new Subject<void>();
  private readonly editor = viewChild(ScheduleEditorComponent);

  protected readonly text = PROVIDER_MESSAGES.schedule;
  protected readonly saving = signal(false);
  protected readonly affected = signal<readonly AppointmentSummary[]>([]);
  private readonly saved = signal<RemoteState<WeeklySchedule> | null>(null);

  private readonly loaded = toSignal(
    this.reload$.pipe(
      startWith(undefined),
      switchMap(() => toRemoteState(this.api.getWeekly(), () => false)),
    ),
    { initialValue: LOADING as RemoteState<WeeklySchedule> },
  );

  /** Depois de salvar, mostra o expediente devolvido pela API. */
  protected readonly state = computed(() => this.saved() ?? this.loaded());

  protected save(body: Pick<WeeklySchedule, 'days'>): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .replaceWorkingHours(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.saved.set(ready(result.schedule));
          this.affected.set(result.affectedAppointments);
          this.toast.success(this.text.saved);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(raw: unknown): void {
    const error = isApiError(raw) ? raw : new ApiError({ kind: 'unknown', status: 0 });
    const editor = this.editor();
    const validation = error.validationErrors;
    if (validation && editor) {
      const rest = editor.showServerErrors(validation);
      editor.showSummary(rest.length > 0 ? rest : [this.text.invalid]);
      return;
    }
    editor?.showSummary([resolveErrorMessage(error)]);
  }

  protected reload(): void {
    this.saved.set(null);
    this.reload$.next();
  }
}
