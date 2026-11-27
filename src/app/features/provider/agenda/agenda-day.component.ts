import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { AppointmentSummary, LocalDate } from '../../../core/models/api-models';
import { AgendaGridComponent } from './agenda-grid.component';
import { brDate } from './agenda-week.component';

/** Visão de um dia, por hora no fuso do prestador (FR-044). */
@Component({
  selector: 'sm-agenda-day',
  standalone: true,
  imports: [AgendaGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sm-agenda-grid
      [appointments]="appointments()"
      [days]="days()"
      [timeZoneId]="timeZoneId()"
      [caption]="caption()"
    />
  `,
})
export class AgendaDayComponent {
  readonly appointments = input.required<readonly AppointmentSummary[]>();
  readonly date = input.required<LocalDate>();
  readonly timeZoneId = input.required<string>();

  protected readonly days = computed(() => [this.date()]);
  protected readonly caption = computed(() =>
    PROVIDER_MESSAGES.agenda.dayTitle(brDate(this.date())),
  );
}
