import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { APP_PATHS } from '../../core/config/app-paths';
import { DialogService } from '../../core/feedback/dialog.service';
import { APPOINTMENT_MESSAGES } from '../../core/i18n/appointments.messages';
import type { Role } from '../../core/models/enums';
import { InZonePipe } from '../../shared/time/in-zone.pipe';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ZoneHintComponent } from '../../shared/ui/zone-hint.component';
import { AppointmentDetailStore } from './appointment-detail.store';
import { openCancelDialog } from './cancel-dialog.component';
import { HistoryTimelineComponent } from './history-timeline.component';

const BACK_PATHS: Record<Role, string> = {
  Provider: APP_PATHS.providerArea.agenda,
  Customer: APP_PATHS.customer.appointments,
  Admin: APP_PATHS.admin.appointments,
};

/**
 * Detalhe do agendamento, compartilhado pelas 3 áreas (FR-045..048): dados do cliente, serviço
 * do momento da reserva, horário no fuso do prestador, histórico e só as ações possíveis.
 */
@Component({
  selector: 'sm-appointment-detail-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    RouterLink,
    InZonePipe,
    ButtonDirective,
    ErrorStateComponent,
    HistoryTimelineComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    ZoneHintComponent,
  ],
  providers: [AppointmentDetailStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8">
      <a class="sm-link text-sm" [routerLink]="backPath()">← {{ text.back }}</a>
      <h1 class="mt-2">{{ text.title }}</h1>

      @switch (store.status()) {
        @case ('loading') {
          <div class="mt-6"><sm-skeleton [rows]="5" /></div>
        }
        @case ('error') {
          @if (store.loadError(); as error) {
            <div class="mt-6">
              @if (error.hasCode('appointment.not_found') || error.status === 404) {
                <p class="sm-card" role="alert" data-testid="appointment-not-found">
                  {{ text.notFound }}
                </p>
              } @else {
                <sm-error-state [error]="error" (retry)="store.reload()" />
              }
            </div>
          }
        }
        @case ('ready') {
          @if (store.appointment(); as a) {
            <div class="mt-4 flex flex-col gap-6">
              <div class="flex flex-wrap items-center gap-3">
                <span data-testid="appointment-status"
                  ><sm-status-badge [status]="a.status"
                /></span>
              </div>

              @if (store.notice(); as notice) {
                <p class="sm-card border-tone-warning-fg" role="alert" data-testid="action-notice">
                  {{ notice }}
                </p>
              }

              @if (store.actions().length > 0 || showCompleteHint()) {
                <div
                  class="flex flex-wrap gap-2"
                  role="group"
                  [attr.aria-label]="text.actions.groupLabel"
                >
                  @for (action of store.actions(); track $index) {
                    @switch (action) {
                      @case ('confirm') {
                        <button
                          type="button"
                          smButton="primary"
                          [loading]="store.pendingAction() === 'confirm'"
                          [disabled]="busy()"
                          (click)="store.confirm()"
                        >
                          {{ text.actions.confirm }}
                        </button>
                      }
                      @case ('complete') {
                        <button
                          type="button"
                          smButton="primary"
                          [loading]="store.pendingAction() === 'complete'"
                          [disabled]="busy()"
                          (click)="store.complete()"
                        >
                          {{ text.actions.complete }}
                        </button>
                      }
                      @case ('cancel') {
                        <button
                          type="button"
                          smButton="danger"
                          [loading]="store.pendingAction() === 'cancel'"
                          [disabled]="busy()"
                          (click)="cancel()"
                        >
                          {{ text.actions.cancel }}
                        </button>
                      }
                    }
                  }
                  @if (showCompleteHint()) {
                    <p class="sm-hint self-center" data-testid="complete-hint">
                      {{ text.completeHint }}
                    </p>
                  }
                </div>
              }
              @if (role() === 'Customer' && store.actions().includes('cancel')) {
                <p class="sm-hint">{{ text.customerNotice }}</p>
              }

              <dl class="grid gap-4 sm:grid-cols-2">
                <div class="sm-card">
                  <dt class="font-semibold">{{ text.sections.when }}</dt>
                  <dd class="mt-1" data-testid="appointment-when">
                    {{ a.startAt | inZone: a.provider.timeZoneId : 'date' }}
                    {{
                      text.range(
                        a.startAt | inZone: a.provider.timeZoneId : 'time',
                        a.endAt | inZone: a.provider.timeZoneId : 'time'
                      )
                    }}
                    <sm-zone-hint
                      class="block"
                      [timeZone]="a.provider.timeZoneId"
                      [at]="a.startAt"
                    />
                  </dd>
                </div>
                <div class="sm-card">
                  <dt class="font-semibold">{{ text.sections.service }}</dt>
                  <dd class="mt-1">
                    <p>{{ a.service.name }}</p>
                    <p class="text-sm text-gray-700">
                      {{ text.fields.duration }}: {{ text.minutes(a.service.durationMinutes) }} ·
                      {{ text.fields.price }}: {{ a.service.price | currency }}
                    </p>
                    <p class="sm-hint">{{ text.serviceSnapshot }}</p>
                  </dd>
                </div>
                <div class="sm-card">
                  <dt class="font-semibold">{{ text.sections.customer }}</dt>
                  <dd class="mt-1" data-testid="appointment-customer">
                    <p>{{ a.customer.name }}</p>
                    @if (a.customer.email) {
                      <p class="text-sm">
                        {{ text.fields.email }}:
                        <a class="sm-link" [href]="'mailto:' + a.customer.email">{{
                          a.customer.email
                        }}</a>
                      </p>
                    }
                    @if (a.customer.phone) {
                      <p class="text-sm">
                        {{ text.fields.phone }}:
                        <a class="sm-link" [href]="'tel:' + a.customer.phone">{{
                          a.customer.phone
                        }}</a>
                      </p>
                    }
                  </dd>
                </div>
                <div class="sm-card">
                  <dt class="font-semibold">{{ text.sections.provider }}</dt>
                  <dd class="mt-1">{{ a.provider.displayName }}</dd>
                </div>
                @if (a.notes) {
                  <div class="sm-card sm:col-span-2">
                    <dt class="font-semibold">{{ text.sections.notes }}</dt>
                    <dd class="mt-1 whitespace-pre-line">{{ a.notes }}</dd>
                  </div>
                }
                @if (a.cancellationReason) {
                  <div class="sm-card sm:col-span-2">
                    <dt class="font-semibold">{{ text.sections.cancellationReason }}</dt>
                    <dd class="mt-1 whitespace-pre-line">{{ a.cancellationReason }}</dd>
                  </div>
                }
              </dl>

              <section aria-labelledby="sm-history-title">
                <h2 id="sm-history-title" class="text-lg">{{ text.sections.history }}</h2>
                <div class="mt-3">
                  <sm-history-timeline [history]="a.history" [timeZoneId]="a.provider.timeZoneId" />
                </div>
              </section>
            </div>
          }
        }
      }
    </section>
  `,
})
export class AppointmentDetailPageComponent {
  /** `:id` da rota (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  protected readonly store = inject(AppointmentDetailStore);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);

  protected readonly text = APPOINTMENT_MESSAGES;
  protected readonly role = this.session.role;
  protected readonly backPath = computed(() => {
    const role = this.role();
    return role ? BACK_PATHS[role] : APP_PATHS.home;
  });
  protected readonly busy = computed(() => this.store.pendingAction() !== null);

  /** "Concluir" ainda indisponível: Confirmado e antes do início (para quem pode concluir). */
  protected readonly showCompleteHint = computed(() => {
    const a = this.store.appointment();
    const role = this.role();
    return (
      a?.status === 'Confirmed' &&
      (role === 'Provider' || role === 'Admin') &&
      !this.store.actions().includes('complete')
    );
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.load(id));
    });
  }

  protected cancel(): void {
    openCancelDialog(this.dialogs, {
      requireOnBehalfOf: this.role() === 'Admin',
      showCustomerNotice: this.role() === 'Customer',
      submit: (body) => this.store.cancelRequest(body),
    }).subscribe();
  }
}
