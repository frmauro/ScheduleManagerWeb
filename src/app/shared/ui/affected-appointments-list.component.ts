import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PROVIDER_MESSAGES } from '../../core/i18n/provider.messages';
import type { AppointmentSummary, Uuid } from '../../core/models/api-models';
import { InZonePipe } from '../time/in-zone.pipe';
import { ButtonDirective } from './button.directive';
import { StatusBadgeComponent } from './status-badge.component';

/**
 * Lista de agendamentos afetados por uma mudança de agenda (FR-043). Só apresentação
 * (Art. II.1): quem usa decide o que "Abrir" e "Cancelar" fazem.
 */
@Component({
  selector: 'sm-affected-appointments-list',
  standalone: true,
  imports: [InZonePipe, ButtonDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-2" [attr.aria-label]="text.listLabel">
      @for (item of appointments(); track item.id) {
        <li
          class="flex flex-col gap-2 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="affected-appointment"
        >
          <div class="text-sm">
            <p class="font-medium">{{ item.customerName }}</p>
            <p>{{ item.serviceName }} · {{ item.startAt | inZone: timeZoneId() }}</p>
            <p class="mt-1"><sm-status-badge [status]="item.status" /></p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              smButton="secondary"
              [attr.aria-label]="text.openFor(item.customerName)"
              (click)="openAppointment.emit(item.id)"
            >
              {{ text.open }}
            </button>
            <button
              type="button"
              smButton="danger"
              [disabled]="busyId() === item.id"
              [attr.aria-label]="text.cancelFor(item.customerName)"
              (click)="cancelAppointment.emit(item.id)"
            >
              {{ text.cancel }}
            </button>
          </div>
        </li>
      }
    </ul>
  `,
})
export class AffectedAppointmentsListComponent {
  readonly appointments = input.required<readonly AppointmentSummary[]>();
  /** Fuso do prestador: os horários são exibidos nele (FR-003). */
  readonly timeZoneId = input.required<string>();
  /** Item com ação em andamento (botão desabilitado). */
  readonly busyId = input<Uuid | null>(null);
  readonly openAppointment = output<Uuid>();
  readonly cancelAppointment = output<Uuid>();

  protected readonly text = PROVIDER_MESSAGES.affected;
}
