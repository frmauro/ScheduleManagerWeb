import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, startWith, Subject, switchMap } from 'rxjs';
import { ProvidersApi } from '../../core/api/providers.api';
import { ServicesApi } from '../../core/api/services.api';
import { SessionStore } from '../../core/auth/session.store';
import { APP_PATHS } from '../../core/config/app-paths';
import { MAX_PAGE_SIZE } from '../../core/config/app.constants';
import { BOOKING_MESSAGES } from '../../core/i18n/booking.messages';
import type {
  LocalDate,
  Page,
  ProviderPublicProfile,
  Service,
  TimeSlot,
} from '../../core/models/api-models';
import { LOADING, toRemoteState, type RemoteState } from '../../shared/state/remote-state';
import { localDateOf } from '../../shared/time/zoned-time';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { FormErrorSummaryComponent } from '../../shared/ui/form-error-summary.component';
import { RemoteReadyDirective, RemoteViewComponent } from '../../shared/ui/remote-view.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { AvailabilityPickerComponent } from '../catalog/availability-picker.component';
import { NotFoundPageComponent } from '../errors/not-found.page';
import { BookingSuccessComponent } from './booking-success.component';
import { BookingSummaryComponent } from './booking-summary.component';
import { BookingStore } from './booking.store';

const LOCAL_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

type Step = 'choose' | 'review' | 'done';

/**
 * Reserva (US3): `/prestadores/:providerId/agendar?servico=&data=&horario=`.
 * Sem `horario`, escolhe o horário; com `horario`, mostra o resumo. A escolha fica na URL, então
 * o visitante volta do login/cadastro ao mesmo resumo (FR-028); as observações ficam no rascunho.
 */
@Component({
  selector: 'sm-booking-page',
  standalone: true,
  imports: [
    RouterLink,
    AvailabilityPickerComponent,
    BookingSuccessComponent,
    BookingSummaryComponent,
    EmptyStateComponent,
    FormErrorSummaryComponent,
    NotFoundPageComponent,
    RemoteReadyDirective,
    RemoteViewComponent,
    SkeletonComponent,
  ],
  providers: [BookingStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notFound()) {
      <sm-not-found-page />
    } @else {
      <section class="mx-auto max-w-3xl px-4 py-8">
        <a
          class="sm-link text-sm"
          [routerLink]="providerPath()"
          [queryParams]="{ servico: servico() ?? null, data: selectedDate() ?? null }"
          >← {{ text.backToProvider }}</a
        >
        <h1 class="mt-4">{{ text.title }}</h1>

        <ol
          class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"
          [attr.aria-label]="text.steps.label"
        >
          @for (item of steps; track item.id; let i = $index) {
            <li
              [attr.aria-current]="item.id === step() ? 'step' : null"
              [class.font-semibold]="item.id === step()"
              [class.text-gray-600]="item.id !== step()"
            >
              {{ i + 1 }}. {{ item.label }}
            </li>
          }
        </ol>

        <div class="mt-6">
          <sm-remote-view [state]="profile()" [skeletonRows]="4" (retry)="reload()">
            <ng-template [smRemoteReady]="profile()" let-provider>
              @if (store.phase() === 'success' && store.result(); as result) {
                <sm-booking-success [appointment]="result.appointment" />
              } @else if (services().status === 'loading') {
                <sm-skeleton [rows]="3" />
              } @else if (selectedService(); as service) {
                <div [hidden]="reviewing()">
                  <h2 class="text-lg">{{ text.chooseTitle(service.name) }}</h2>
                  @if (store.phase() === 'choosing' && store.errorMessage(); as message) {
                    <div class="mt-3">
                      <sm-form-error-summary [messages]="[message]" title="" />
                    </div>
                  }
                  <div class="mt-3">
                    <sm-availability-picker
                      [providerId]="provider.id"
                      [serviceId]="service.id"
                      [timeZoneId]="provider.timeZoneId"
                      [date]="selectedDate()"
                      (dateChange)="selectDate($event)"
                      (slotSelected)="selectSlot(provider, $event)"
                    />
                  </div>
                </div>
                @if (reviewing() && slot(); as startAt) {
                  <sm-booking-summary
                    [provider]="provider"
                    [service]="service"
                    [startAt]="startAt"
                    [initialNotes]="store.notes()"
                    [submitting]="store.submitting()"
                    [confirmDisabled]="!canBook()"
                    (notesChange)="store.setNotes($event)"
                    (confirm)="confirm()"
                    (changeSlot)="changeSlot()"
                  >
                    @if (store.phase() === 'error' && store.errorMessage(); as message) {
                      <sm-form-error-summary [messages]="[message]" title="" />
                    }
                    @if (isGuest()) {
                      <p class="sm-hint" data-testid="login-notice">
                        {{ text.summary.loginNotice }}
                      </p>
                    } @else if (!canBook()) {
                      <p class="sm-error" role="alert">{{ text.summary.onlyCustomers }}</p>
                    }
                  </sm-booking-summary>
                }
              } @else {
                <sm-empty-state
                  [title]="text.serviceMissingTitle"
                  [description]="text.serviceMissingDescription"
                >
                  <a class="sm-link" [routerLink]="providerPath()">{{ text.chooseService }}</a>
                </sm-empty-state>
              }
            </ng-template>
          </sm-remote-view>
        </div>
      </section>
    }
  `,
})
export class BookingPageComponent {
  /** Parâmetro de rota e query params (`withComponentInputBinding`). */
  readonly providerId = input.required<string>();
  readonly servico = input<string>();
  readonly data = input<string>();
  readonly horario = input<string>();

  protected readonly store = inject(BookingStore);
  private readonly providersApi = inject(ProvidersApi);
  private readonly servicesApi = inject(ServicesApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reload$ = new Subject<void>();
  private readonly picker = viewChild(AvailabilityPickerComponent);

  protected readonly text = BOOKING_MESSAGES;
  protected readonly steps: readonly { id: Step; label: string }[] = [
    { id: 'choose', label: BOOKING_MESSAGES.steps.choose },
    { id: 'review', label: BOOKING_MESSAGES.steps.review },
    { id: 'done', label: BOOKING_MESSAGES.steps.done },
  ];

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
        toRemoteState(this.servicesApi.listPublic(id, { pageSize: MAX_PAGE_SIZE }), () => false),
      ),
    ),
    { initialValue: LOADING as RemoteState<Page<Service>> },
  );

  protected readonly notFound = computed(() => {
    const p = this.profile();
    return p.status === 'error' && p.error.status === 404;
  });

  private readonly readyProfile = computed(() => {
    const p = this.profile();
    return p.status === 'ready' ? p.value : null;
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

  /** `horario` é o `startAt` do slot, opaco: só se confere que é um instante válido. */
  protected readonly slot = computed(() => {
    const value = this.horario();
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  });

  protected readonly reviewing = computed(() => {
    const phase = this.store.phase();
    return (
      this.slot() !== null && (phase === 'reviewing' || phase === 'submitting' || phase === 'error')
    );
  });

  protected readonly step = computed<Step>(() =>
    this.store.phase() === 'success' ? 'done' : this.reviewing() ? 'review' : 'choose',
  );

  protected readonly isGuest = computed(() => !this.session.isAuthenticated());
  protected readonly canBook = computed(() => {
    const role = this.session.role();
    return role === null || role === 'Customer';
  });

  constructor() {
    // URL com horário → abre o resumo dessa tentativa.
    effect(() => {
      const provider = this.readyProfile();
      const service = this.selectedService();
      const startAt = this.slot();
      if (!provider || !service || !startAt) {
        return;
      }
      untracked(() =>
        this.store.review({
          providerId: provider.id,
          serviceId: service.id,
          date: this.selectedDate() ?? localDateOf(startAt, provider.timeZoneId),
          startAt,
        }),
      );
    });

    // Voltar (navegador) para a escolha de horário.
    effect(() => {
      if (this.slot() === null) {
        untracked(() => {
          const phase = this.store.phase();
          if (phase === 'reviewing' || phase === 'error') {
            this.store.choose();
          }
        });
      }
    });

    // Recusa que exige outro horário: tira `horario` da URL (FR-030).
    effect(() => {
      if (this.store.phase() === 'choosing' && this.store.error() && this.slot() !== null) {
        untracked(() => this.navigate({ horario: null }));
      }
    });

    // Horário ocupado e afins: recarrega os horários da data automaticamente.
    effect(() => {
      if (this.store.slotsReloads() > 0) {
        untracked(() => this.picker()?.reload());
      }
    });
  }

  protected selectDate(date: LocalDate | undefined): void {
    this.navigate({ data: date ?? null });
  }

  protected selectSlot(provider: ProviderPublicProfile, slot: TimeSlot): void {
    this.navigate(
      { data: localDateOf(slot.startAt, provider.timeZoneId), horario: slot.startAt },
      false,
    );
  }

  protected changeSlot(): void {
    this.store.choose();
    this.navigate({ horario: null });
  }

  /** Visitante → login com retorno a esta mesma URL (FR-028); cliente → envia. */
  protected confirm(): void {
    if (this.isGuest()) {
      void this.router.navigate([APP_PATHS.login], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    if (this.canBook()) {
      this.store.submit();
    }
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected providerPath(): string {
    return APP_PATHS.provider(this.providerId());
  }

  private navigate(queryParams: Record<string, string | null>, replaceUrl = true): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
