import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { APPOINTMENT_MESSAGES } from '../../core/i18n/appointments.messages';
import type { StatusChange } from '../../core/models/api-models';
import { APPOINTMENT_STATUS_LABELS, ROLE_LABELS } from '../../core/models/labels';
import { InZonePipe } from '../../shared/time/in-zone.pipe';

/**
 * Linha do tempo do agendamento (FR-045): "de → para", por quem, motivo e quando, no fuso do
 * prestador, em ordem cronológica.
 */
@Component({
  selector: 'sm-history-timeline',
  standalone: true,
  imports: [InZonePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries().length === 0) {
      <p class="text-sm text-gray-700">{{ text.empty }}</p>
    } @else {
      <ol
        class="flex flex-col gap-3 border-l-2 border-gray-200 pl-4"
        [attr.aria-label]="text.label"
      >
        @for (entry of entries(); track $index) {
          <li class="text-sm" data-testid="history-entry">
            <p class="font-semibold">{{ title(entry) }}</p>
            <p class="text-gray-700">
              <time [attr.datetime]="entry.changedAt">{{
                entry.changedAt | inZone: timeZoneId()
              }}</time>
              · {{ text.by(roleLabels[entry.changedByRole]) }}
            </p>
            @if (entry.reason) {
              <p class="text-gray-800">{{ text.reason(entry.reason) }}</p>
            }
          </li>
        }
      </ol>
    }
  `,
})
export class HistoryTimelineComponent {
  readonly history = input.required<readonly StatusChange[]>();
  readonly timeZoneId = input.required<string>();

  protected readonly text = APPOINTMENT_MESSAGES.timeline;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly entries = computed(() =>
    [...this.history()].sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt)),
  );

  protected title(entry: StatusChange): string {
    const to = APPOINTMENT_STATUS_LABELS[entry.toStatus];
    return entry.fromStatus
      ? this.text.transition(APPOINTMENT_STATUS_LABELS[entry.fromStatus], to)
      : this.text.created(to);
  }
}
