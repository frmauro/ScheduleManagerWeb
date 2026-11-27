import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { AppointmentSummary, LocalDate } from '../../../core/models/api-models';
import { addDays, startOfWeek } from '../../../shared/time/zoned-time';
import { AgendaGridComponent } from './agenda-grid.component';

/** `2026-12-01` → `01/12/2026`. */
export function brDate(date: LocalDate): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** Visão semanal (domingo a sábado da semana de `date`), no fuso do prestador (FR-044). */
@Component({
  selector: 'sm-agenda-week',
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
export class AgendaWeekComponent {
  readonly appointments = input.required<readonly AppointmentSummary[]>();
  readonly date = input.required<LocalDate>();
  readonly timeZoneId = input.required<string>();

  protected readonly days = computed(() => {
    const start = startOfWeek(this.date());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  });
  protected readonly caption = computed(() => {
    const days = this.days();
    return PROVIDER_MESSAGES.agenda.weekTitle(brDate(days[0] ?? ''), brDate(days[6] ?? ''));
  });
}
