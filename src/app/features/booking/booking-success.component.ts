import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../core/config/app-paths';
import { BOOKING_MESSAGES } from '../../core/i18n/booking.messages';
import type { Appointment } from '../../core/models/api-models';
import { InZonePipe } from '../../shared/time/in-zone.pipe';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ZoneHintComponent } from '../../shared/ui/zone-hint.component';

/**
 * Sucesso da reserva (FR-029): deixa claro se ficou **Pendente** (aguardando o prestador) ou
 * **Confirmado** (auto-confirmação) e leva ao detalhe na área do cliente.
 */
@Component({
  selector: 'sm-booking-success',
  standalone: true,
  imports: [RouterLink, InZonePipe, ButtonDirective, StatusBadgeComponent, ZoneHintComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sm-card flex flex-col gap-3" data-testid="booking-success" role="status">
      <h2 #heading class="text-lg" tabindex="-1">{{ title() }}</h2>
      <div><sm-status-badge [status]="appointment().status" /></div>
      <p class="text-gray-800">{{ description() }}</p>
      <p>
        <span class="font-medium">{{ appointment().service.name }}</span> ·
        {{ appointment().provider.displayName }} ·
        {{ appointment().startAt | inZone: appointment().provider.timeZoneId }}
        <sm-zone-hint
          class="block"
          [timeZone]="appointment().provider.timeZoneId"
          [at]="appointment().startAt"
        />
      </p>
      <div class="flex flex-wrap gap-2">
        <a smButton="primary" [routerLink]="detailPath()">{{ text.viewAppointment }}</a>
        <a smButton="secondary" [routerLink]="listPath">{{ text.myAppointments }}</a>
      </div>
    </section>
  `,
})
export class BookingSuccessComponent {
  readonly appointment = input.required<Appointment>();

  protected readonly text = BOOKING_MESSAGES.success;
  protected readonly listPath = APP_PATHS.customer.appointments;
  protected readonly detailPath = computed(() =>
    APP_PATHS.customer.appointment(this.appointment().id),
  );
  private readonly confirmed = computed(() => this.appointment().status === 'Confirmed');
  protected readonly title = computed(() =>
    this.confirmed() ? this.text.confirmedTitle : this.text.pendingTitle,
  );
  protected readonly description = computed(() =>
    this.confirmed() ? this.text.confirmedDescription : this.text.pendingDescription,
  );

  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus());
  }
}
