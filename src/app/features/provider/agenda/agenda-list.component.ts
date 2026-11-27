import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../../core/config/app-paths';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { AppointmentSummary } from '../../../core/models/api-models';
import { InZonePipe } from '../../../shared/time/in-zone.pipe';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge.component';

/** Lista da agenda (FR-044): selo de status, data/hora no fuso, cliente, serviço e link. */
@Component({
  selector: 'sm-agenda-list',
  standalone: true,
  imports: [RouterLink, InZonePipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-3" [attr.aria-label]="text.listLabel">
      @for (item of appointments(); track item.id) {
        <li>
          <a
            class="sm-card flex flex-col gap-1 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
            [class.border-tone-warning-fg]="item.status === 'Pending'"
            [class.border-l-4]="item.status === 'Pending'"
            [routerLink]="detailPath(item.id)"
            [attr.data-status]="item.status"
            data-testid="agenda-item"
          >
            <span class="flex flex-col">
              <span class="font-semibold">{{ item.startAt | inZone: timeZoneId() }}</span>
              <span>{{ item.customerName }} · {{ item.serviceName }}</span>
            </span>
            <sm-status-badge [status]="item.status" />
          </a>
        </li>
      }
    </ul>
  `,
})
export class AgendaListComponent {
  readonly appointments = input.required<readonly AppointmentSummary[]>();
  readonly timeZoneId = input.required<string>();

  protected readonly text = PROVIDER_MESSAGES.agenda;

  protected detailPath(id: string): string {
    return APP_PATHS.providerArea.appointment(id);
  }
}
