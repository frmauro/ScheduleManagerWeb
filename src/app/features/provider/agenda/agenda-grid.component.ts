import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../../core/config/app-paths';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { AppointmentSummary, LocalDate } from '../../../core/models/api-models';
import { DAY_OF_WEEK_LABELS } from '../../../core/models/labels';
import { dayOfWeekOf, formatInZone, localDateOf } from '../../../shared/time/zoned-time';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';

/** Horário comercial exibido mesmo sem agendamentos; a grade estende para cobrir todos. */
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 18;

export interface PlacedAppointment {
  readonly appointment: AppointmentSummary;
  /** `HH:mm` de início no fuso do prestador. */
  readonly time: string;
}

export interface AgendaGrid {
  readonly hours: readonly number[];
  /** Chave `yyyy-MM-dd|HH` → agendamentos que começam naquela hora, em ordem de início. */
  readonly cells: ReadonlyMap<string, readonly PlacedAppointment[]>;
}

export function cellKey(date: LocalDate, hour: number): string {
  return `${date}|${String(hour).padStart(2, '0')}`;
}

/**
 * Posiciona cada agendamento pelo **dia e hora locais no fuso do prestador** (FR-003, FR-044):
 * 23:30 em São Paulo fica no próprio dia, mesmo sendo 02:30 UTC do dia seguinte.
 */
export function placeAppointments(
  appointments: readonly AppointmentSummary[],
  days: readonly LocalDate[],
  timeZone: string,
): AgendaGrid {
  const cells = new Map<string, PlacedAppointment[]>();
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  const sorted = [...appointments].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  for (const appointment of sorted) {
    const date = localDateOf(appointment.startAt, timeZone);
    if (!days.includes(date)) {
      continue;
    }
    const time = formatInZone(appointment.startAt, timeZone, 'time');
    const hour = Number(time.slice(0, 2));
    first = Math.min(first, hour);
    last = Math.max(last, hour);
    const key = cellKey(date, hour);
    cells.set(key, [...(cells.get(key) ?? []), { appointment, time }]);
  }
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return { hours, cells };
}

/** `2026-12-01` → `01/12`. */
function shortDate(date: LocalDate): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

/**
 * Grade por hora no fuso do prestador (FR-044), usada pelas visões dia e semana. É uma tabela:
 * dias nas colunas, horas nas linhas; cada agendamento é um link para o detalhe. Pendentes têm
 * borda destacada **e** o selo com ícone e texto "Pendente" (FR-009).
 */
@Component({
  selector: 'sm-agenda-grid',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[20rem] table-fixed border-collapse text-sm">
        <caption class="sr-only">
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="w-16 border-b border-gray-200 p-2 text-left">{{ text.hour }}</th>
            @for (day of days(); track $index) {
              <th
                scope="col"
                class="border-b border-gray-200 p-2 text-left"
                [class.min-w-[9rem]]="days().length > 1"
              >
                {{ dayLabel(day) }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (hour of grid().hours; track hour) {
            <tr>
              <th scope="row" class="border-b border-gray-100 p-2 text-left align-top font-normal">
                {{ hourLabel(hour) }}
              </th>
              @for (day of days(); track $index) {
                <td
                  class="border-b border-gray-100 p-1 align-top"
                  [attr.data-cell]="cellKey(day, hour)"
                >
                  @for (item of cell(day, hour); track item.appointment.id) {
                    <a
                      class="mb-1 block rounded-md border p-2 hover:bg-gray-50 focus:outline-2 focus:outline-brand"
                      [class.border-tone-warning-fg]="item.appointment.status === 'Pending'"
                      [class.border-l-4]="item.appointment.status === 'Pending'"
                      [class.border-gray-200]="item.appointment.status !== 'Pending'"
                      [routerLink]="detailPath(item.appointment.id)"
                      [attr.data-status]="item.appointment.status"
                      data-testid="agenda-appointment"
                    >
                      <span class="block font-semibold">{{ item.time }}</span>
                      <span class="block">{{ item.appointment.customerName }}</span>
                      <span class="block text-gray-700">{{ item.appointment.serviceName }}</span>
                      <sm-status-badge [status]="item.appointment.status" />
                    </a>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AgendaGridComponent {
  readonly appointments = input.required<readonly AppointmentSummary[]>();
  readonly days = input.required<readonly LocalDate[]>();
  readonly timeZoneId = input.required<string>();
  readonly caption = input.required<string>();

  protected readonly text = PROVIDER_MESSAGES.agenda;
  protected readonly cellKey = cellKey;
  protected readonly grid = computed(() =>
    placeAppointments(this.appointments(), this.days(), this.timeZoneId()),
  );

  protected cell(day: LocalDate, hour: number): readonly PlacedAppointment[] {
    return this.grid().cells.get(cellKey(day, hour)) ?? [];
  }

  protected dayLabel(day: LocalDate): string {
    return `${DAY_OF_WEEK_LABELS[dayOfWeekOf(day)]} ${shortDate(day)}`;
  }

  protected hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  protected detailPath(id: string): string {
    return APP_PATHS.providerArea.appointment(id);
  }
}
