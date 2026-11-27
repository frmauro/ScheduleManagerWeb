import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, map, startWith, Subject, switchMap } from 'rxjs';
import { ProvidersApi } from '../../core/api/providers.api';
import { ServicesApi } from '../../core/api/services.api';
import { APP_PATHS } from '../../core/config/app-paths';
import { MAX_PAGE_SIZE } from '../../core/config/app.constants';
import { formatDuration } from '../../core/domain/booking-policy-format';
import { CATALOG_MESSAGES } from '../../core/i18n/catalog.messages';
import type {
  LocalDate,
  Page,
  ProviderPublicProfile,
  Service,
  TimeSlot,
} from '../../core/models/api-models';
import { SERVICE_CATEGORY_LABELS } from '../../core/models/labels';
import { formatCep } from '../../shared/forms/cep.directive';
import { formatBrPhone } from '../../shared/forms/phone-br.directive';
import { localDateOf } from '../../shared/time/zoned-time';
import { LOADING, toRemoteState, type RemoteState } from '../../shared/state/remote-state';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { RemoteReadyDirective, RemoteViewComponent } from '../../shared/ui/remote-view.component';
import { ZoneHintComponent } from '../../shared/ui/zone-hint.component';
import { NotFoundPageComponent } from '../errors/not-found.page';
import { AvailabilityPickerComponent } from './availability-picker.component';

const LOCAL_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const BR_E164 = '+55';

/** Telefone E.164 brasileiro exibido com máscara; estrangeiro, como veio. */
export function displayPhone(phone: string): string {
  return phone.startsWith(BR_E164) ? formatBrPhone(phone.slice(BR_E164.length)) : phone;
}

/**
 * Página pública do prestador (US1, FR-023): dados, fuso, serviços ativos e horários livres.
 * Rota `/prestadores/:providerId?servico=&data=`; a seleção fica na URL.
 */
@Component({
  selector: 'sm-provider-profile-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    RouterLink,
    ButtonDirective,
    RemoteViewComponent,
    RemoteReadyDirective,
    ZoneHintComponent,
    NotFoundPageComponent,
    AvailabilityPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notFound()) {
      <sm-not-found-page />
    } @else {
      <section class="mx-auto max-w-5xl px-4 py-8">
        <a class="sm-link text-sm" [routerLink]="homePath">← {{ text.backToSearch }}</a>

        <sm-remote-view [state]="profile()" [skeletonRows]="4" (retry)="reload()">
          <ng-template [smRemoteReady]="profile()" let-provider>
            <header class="mt-4">
              <h1>{{ provider.displayName }}</h1>
              <p class="mt-1 text-gray-700">{{ categoryLabel(provider) }}</p>
            </header>

            <div class="mt-6 grid gap-4 md:grid-cols-3">
              <div class="sm-card md:col-span-2">
                <h2 class="text-base font-semibold">{{ text.about }}</h2>
                @if (provider.description) {
                  <p class="mt-2 whitespace-pre-line text-gray-800">{{ provider.description }}</p>
                }
                <h2 class="mt-4 text-base font-semibold">{{ text.timeZone }}</h2>
                <p class="mt-1">
                  <sm-zone-hint [timeZone]="provider.timeZoneId" [always]="true" />
                </p>
              </div>
              <div class="sm-card">
                <h2 class="text-base font-semibold">{{ text.contact }}</h2>
                <dl class="mt-2 space-y-1 text-sm">
                  <div>
                    <dt class="inline font-medium">{{ text.phone }}:</dt>
                    <dd class="inline">{{ phone(provider.contactPhone) }}</dd>
                  </div>
                  @if (provider.contactEmail) {
                    <div>
                      <dt class="inline font-medium">{{ text.email }}:</dt>
                      <dd class="inline break-all">{{ provider.contactEmail }}</dd>
                    </div>
                  }
                </dl>
                <h2 class="mt-4 text-base font-semibold">{{ text.address }}</h2>
                <address class="mt-1 text-sm not-italic">
                  {{ provider.address.street }}, {{ provider.address.number }}
                  @if (provider.address.complement) {
                    – {{ provider.address.complement }}
                  }
                  <br />
                  {{ provider.address.district }} · {{ provider.address.city }}/{{
                    provider.address.state
                  }}
                  <br />
                  CEP {{ cep(provider.address.postalCode) }}
                </address>
              </div>
            </div>

            <h2 class="mt-8">{{ text.servicesTitle }}</h2>
            <div class="mt-3">
              <sm-remote-view
                [state]="services()"
                [emptyTitle]="text.noServicesTitle"
                [emptyDescription]="text.noServicesDescription"
                (retry)="reload()"
              >
                <ng-template [smRemoteReady]="services()" let-page>
                  <ul class="grid gap-3 sm:grid-cols-2">
                    @for (service of page.items; track service.id) {
                      <li class="sm-card flex flex-col gap-2">
                        <h3 class="font-semibold">{{ service.name }}</h3>
                        @if (service.description) {
                          <p class="text-sm text-gray-700">{{ service.description }}</p>
                        }
                        <p class="text-sm">
                          <span class="sr-only">{{ text.duration }}: </span
                          >{{ duration(service.durationMinutes) }} ·
                          <span class="sr-only">{{ text.price }}: </span
                          >{{ service.price | currency }}
                        </p>
                        <div>
                          <button
                            type="button"
                            [smButton]="service.id === servico() ? 'primary' : 'secondary'"
                            [attr.aria-pressed]="service.id === servico()"
                            (click)="selectService(service.id)"
                          >
                            {{ text.chooseService }}
                          </button>
                        </div>
                      </li>
                    }
                  </ul>
                </ng-template>
              </sm-remote-view>
            </div>

            @if (selectedService(); as service) {
              <section class="sm-card mt-6" aria-labelledby="sm-availability-title">
                <h2 id="sm-availability-title" class="text-lg">
                  {{ text.availabilityTitle(service.name) }}
                </h2>
                <div class="mt-3">
                  <sm-availability-picker
                    [providerId]="provider.id"
                    [serviceId]="service.id"
                    [timeZoneId]="provider.timeZoneId"
                    [date]="selectedDate()"
                    (dateChange)="selectDate($event)"
                    (slotSelected)="selectSlot(provider, service, $event)"
                  />
                </div>
              </section>
            }
          </ng-template>
        </sm-remote-view>
      </section>
    }
  `,
})
export class ProviderProfilePageComponent {
  /** Parâmetro de rota e query params (`withComponentInputBinding`). */
  readonly providerId = input.required<string>();
  readonly servico = input<string>();
  readonly data = input<string>();

  private readonly providersApi = inject(ProvidersApi);
  private readonly servicesApi = inject(ServicesApi);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly reload$ = new Subject<void>();

  protected readonly text = CATALOG_MESSAGES.profile;
  protected readonly homePath = APP_PATHS.home;

  private readonly id$ = combineLatest([
    toObservable(this.providerId),
    this.reload$.pipe(startWith(undefined)),
  ]).pipe(map(([id]) => id));

  protected readonly profile = toSignal(
    this.id$.pipe(switchMap((id) => toRemoteState(this.providersApi.getPublic(id), () => false))),
    { initialValue: LOADING as RemoteState<ProviderPublicProfile> },
  );

  protected readonly services = toSignal(
    this.id$.pipe(
      switchMap((id) =>
        toRemoteState(this.servicesApi.listPublic(id, { pageSize: MAX_PAGE_SIZE })),
      ),
    ),
    { initialValue: LOADING as RemoteState<Page<Service>> },
  );

  protected readonly notFound = computed(() => {
    const p = this.profile();
    return p.status === 'error' && p.error.status === 404;
  });

  protected readonly selectedService = computed(() => {
    const s = this.services();
    const id = this.servico();
    return s.status === 'ready' && id ? (s.value.items.find((x) => x.id === id) ?? null) : null;
  });

  protected readonly selectedDate = computed(() => {
    const d = this.data();
    return d && LOCAL_DATE.test(d) ? d : undefined;
  });

  constructor() {
    effect(() => {
      const p = this.profile();
      if (p.status === 'ready') {
        this.title.setTitle(`${p.value.displayName} · ScheduleManager`);
      }
    });
  }

  protected selectService(serviceId: string): void {
    void this.router.navigate([APP_PATHS.provider(this.providerId())], {
      queryParams: { servico: serviceId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected selectDate(date: LocalDate | undefined): void {
    void this.router.navigate([APP_PATHS.provider(this.providerId())], {
      queryParams: { data: date ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Leva à reserva (US3) com o `startAt` intacto; a data é a do horário, no fuso do prestador. */
  protected selectSlot(provider: ProviderPublicProfile, service: Service, slot: TimeSlot): void {
    void this.router.navigate([APP_PATHS.booking(provider.id)], {
      queryParams: {
        servico: service.id,
        data: localDateOf(slot.startAt, provider.timeZoneId),
        horario: slot.startAt,
      },
    });
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected categoryLabel(provider: ProviderPublicProfile): string {
    return SERVICE_CATEGORY_LABELS[provider.category];
  }

  protected phone(value: string): string {
    return displayPhone(value);
  }

  protected cep(value: string): string {
    return formatCep(value);
  }

  protected duration(minutes: number): string {
    return formatDuration(minutes);
  }
}
