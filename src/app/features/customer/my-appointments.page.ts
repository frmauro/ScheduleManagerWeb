import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';
import { CustomersApi } from '../../core/api/customers.api';
import { ProviderTimeZoneCache, type ProviderZone } from '../../core/api/provider-time-zone.cache';
import { APP_PATHS } from '../../core/config/app-paths';
import { MAX_PERIOD_DAYS } from '../../core/config/app.constants';
import { CUSTOMER_MESSAGES } from '../../core/i18n/customer.messages';
import type {
  AppointmentSummary,
  Instant,
  LocalDate,
  Page,
  Uuid,
} from '../../core/models/api-models';
import { APPOINTMENT_STATUS_VALUES, type AppointmentStatus } from '../../core/models/enums';
import { APPOINTMENT_STATUS_LABELS } from '../../core/models/labels';
import {
  PAGE_FIELDS,
  parseListQuery,
  serializeListQuery,
  type ParsedQuery,
  type QueryShape,
} from '../../shared/state/list-query';
import { IDLE, LOADING, toRemoteState, type RemoteState } from '../../shared/state/remote-state';
import {
  browserTimeZone,
  daysBetween,
  formatInZone,
  toZonedIso,
  zonedDayRange,
} from '../../shared/time/zoned-time';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { RemoteReadyDirective, RemoteViewComponent } from '../../shared/ui/remote-view.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { TabsComponent, type TabItem } from '../../shared/ui/tabs.component';
import { ZoneHintComponent } from '../../shared/ui/zone-hint.component';

const TABS = ['proximos', 'historico'] as const;
type Tab = (typeof TABS)[number];

export const MY_APPOINTMENTS_QUERY_SHAPE = {
  aba: { kind: 'enum', values: TABS, default: 'proximos' },
  status: { kind: 'enumArray', values: APPOINTMENT_STATUS_VALUES },
  de: { kind: 'date' },
  ate: { kind: 'date' },
  prestador: { kind: 'string' },
  ...PAGE_FIELDS,
} as const satisfies QueryShape;

type MyAppointmentsQuery = ParsedQuery<typeof MY_APPOINTMENTS_QUERY_SHAPE>;

type PeriodError = 'order' | 'tooLong' | null;

export function periodError(from: LocalDate | undefined, to: LocalDate | undefined): PeriodError {
  if (!from || !to) {
    return null;
  }
  const days = daysBetween(from, to);
  return days < 0 ? 'order' : days + 1 > MAX_PERIOD_DAYS ? 'tooLong' : null;
}

/**
 * Intervalo da consulta: "Próximos" começa agora (`from`), "Histórico" termina agora (`to`);
 * as datas do filtro (no fuso do dispositivo) só estreitam esse intervalo. `null` = vazio.
 */
export function tabRange(
  q: Pick<MyAppointmentsQuery, 'aba' | 'de' | 'ate'>,
  now: number,
  timeZone: string,
): { from?: Instant; to?: Instant } | null {
  const deMs = q.de ? Date.parse(zonedDayRange(q.de, timeZone).from) : undefined;
  const ateMs = q.ate ? Date.parse(zonedDayRange(q.ate, timeZone).to) : undefined;
  const fromMs = q.aba === 'proximos' ? Math.max(now, deMs ?? now) : deMs;
  const toMs = q.aba === 'historico' ? Math.min(now, ateMs ?? now) : ateMs;
  if (fromMs !== undefined && toMs !== undefined && toMs <= fromMs) {
    return null;
  }
  return {
    from: fromMs === undefined ? undefined : toZonedIso(fromMs, timeZone),
    to: toMs === undefined ? undefined : toZonedIso(toMs, timeZone),
  };
}

interface Listing {
  readonly page: Page<AppointmentSummary>;
  /** Fuso e nome por prestador; `null` = desativado (exibe no fuso do dispositivo). */
  readonly zones: Readonly<Record<Uuid, ProviderZone | null>>;
}

function statusControls(): Record<AppointmentStatus, FormControl<boolean>> {
  return Object.fromEntries(
    APPOINTMENT_STATUS_VALUES.map((s) => [s, new FormControl(false, { nonNullable: true })]),
  ) as Record<AppointmentStatus, FormControl<boolean>>;
}

/**
 * Meus agendamentos (`/cliente/agendamentos?aba=&status=&de=&ate=&prestador=&pagina=`, FR-032):
 * "Próximos" e "Histórico" com qualquer estado, filtros na URL e data/hora no fuso de cada
 * prestador (R18).
 */
@Component({
  selector: 'sm-my-appointments-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    PaginationComponent,
    RemoteReadyDirective,
    RemoteViewComponent,
    StatusBadgeComponent,
    TabsComponent,
    ZoneHintComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8">
      <h1>{{ text.title }}</h1>

      <div class="mt-4">
        <sm-tabs
          #tabs="smTabs"
          [tabs]="tabItems"
          [active]="query().aba"
          [ariaLabel]="text.tabsLabel"
          (activeChange)="setTab($event)"
        />
        <div
          role="tabpanel"
          class="pt-4"
          [id]="tabs.panelId"
          [attr.aria-labelledby]="tabs.tabId(query().aba)"
        >
          <form
            class="flex flex-wrap items-end gap-4"
            [formGroup]="filters"
            [attr.aria-label]="text.filtersLabel"
            (ngSubmit)="applyFilters()"
          >
            <fieldset>
              <legend class="sm-label">{{ text.status }}</legend>
              <div class="flex flex-wrap gap-x-4 gap-y-1" formGroupName="status">
                @for (status of statuses; track status) {
                  <label class="inline-flex min-h-[44px] items-center gap-2 text-sm">
                    <input type="checkbox" [formControlName]="status" />
                    {{ statusLabels[status] }}
                  </label>
                }
              </div>
            </fieldset>
            <div>
              <label class="sm-label" for="sm-my-from">{{ text.from }}</label>
              <input id="sm-my-from" class="sm-input w-auto" type="date" formControlName="de" />
            </div>
            <div>
              <label class="sm-label" for="sm-my-to">{{ text.to }}</label>
              <input
                id="sm-my-to"
                class="sm-input w-auto"
                type="date"
                formControlName="ate"
                [attr.aria-invalid]="periodMessage() ? 'true' : null"
                [attr.aria-describedby]="periodMessage() ? 'sm-my-period-error' : null"
              />
              @if (periodMessage(); as message) {
                <p id="sm-my-period-error" class="sm-error" data-testid="period-error">
                  {{ message }}
                </p>
              }
            </div>
            <button type="submit" smButton="secondary">{{ text.filter }}</button>
          </form>

          @if (query().prestador) {
            <p class="mt-3">
              <span
                class="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm"
                data-testid="provider-filter"
              >
                {{ text.providerFilter(providerFilterName()) }}
                <button
                  type="button"
                  class="min-h-[32px] min-w-[32px] rounded-full font-bold hover:bg-gray-200"
                  [attr.aria-label]="text.removeProviderFilter(providerFilterName())"
                  (click)="removeProviderFilter()"
                >
                  ×
                </button>
              </span>
            </p>
          }

          <div class="mt-4">
            <sm-remote-view
              [state]="state()"
              [emptyTitle]="emptyTitle()"
              [emptyDescription]="emptyDescription()"
              (retry)="reload()"
            >
              @if (query().aba === 'proximos') {
                <a smEmptyAction smButton="primary" [routerLink]="homePath">{{
                  text.findProviders
                }}</a>
              }
              <ng-template [smRemoteReady]="state()" let-listing>
                <ul class="flex flex-col gap-3" [attr.aria-label]="text.listLabel">
                  @for (item of listing.page.items; track item.id) {
                    <li class="sm-card flex flex-col gap-2" data-testid="my-appointment">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <a class="sm-link font-semibold" [routerLink]="detailPath(item.id)">
                          {{ item.serviceName }} · {{ item.providerName }}
                        </a>
                        <sm-status-badge [status]="item.status" />
                      </div>
                      <p class="text-sm" data-testid="my-appointment-when">
                        @if (listing.zones[item.providerId]; as zone) {
                          {{ when(item.startAt, zone.timeZoneId) }}
                          <sm-zone-hint
                            class="block"
                            [timeZone]="zone.timeZoneId"
                            [at]="item.startAt"
                          />
                        } @else {
                          {{ when(item.startAt, browserZone) }} ({{ text.yourTime }})
                        }
                      </p>
                      @if (query().prestador !== item.providerId) {
                        <p class="text-sm">
                          <a
                            class="sm-link"
                            [routerLink]="[]"
                            [queryParams]="{ prestador: item.providerId, pagina: null }"
                            queryParamsHandling="merge"
                            >{{ text.seeAllWithProvider }}</a
                          >
                        </p>
                      }
                    </li>
                  }
                </ul>
                <div class="mt-4">
                  <sm-pagination
                    [meta]="listing.page"
                    (pageChange)="goToPage($event)"
                    (pageSizeChange)="setPageSize($event)"
                  />
                </div>
              </ng-template>
            </sm-remote-view>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class MyAppointmentsPageComponent {
  private readonly api = inject(CustomersApi);
  private readonly zones = inject(ProviderTimeZoneCache);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reload$ = new Subject<void>();

  protected readonly text = CUSTOMER_MESSAGES.appointments;
  protected readonly statuses = APPOINTMENT_STATUS_VALUES;
  protected readonly statusLabels = APPOINTMENT_STATUS_LABELS;
  protected readonly homePath = APP_PATHS.home;
  protected readonly browserZone = browserTimeZone();
  protected readonly tabItems: readonly TabItem<Tab>[] = TABS.map((id) => ({
    id,
    label: this.text.tabs[id],
  }));

  protected readonly filters = new FormGroup({
    status: new FormGroup(statusControls()),
    de: new FormControl('', { nonNullable: true }),
    ate: new FormControl('', { nonNullable: true }),
  });

  private readonly query$ = this.route.queryParamMap.pipe(
    map((params) => parseListQuery(params, MY_APPOINTMENTS_QUERY_SHAPE)),
  );
  protected readonly query = toSignal(this.query$, { requireSync: true });

  protected readonly periodMessage = computed(() => {
    const q = this.query();
    const error = periodError(q.de, q.ate);
    return error === 'order'
      ? this.text.periodOrder
      : error === 'tooLong'
        ? this.text.periodTooLong(MAX_PERIOD_DAYS)
        : null;
  });

  private readonly providerFilterZone = toSignal(
    this.query$.pipe(
      map((q) => q.prestador),
      switchMap((id) => (id ? this.zones.get(id).pipe(catchError(() => of(null))) : of(undefined))),
    ),
    { initialValue: undefined },
  );
  protected readonly providerFilterName = computed(
    () => this.providerFilterZone()?.displayName ?? this.text.unknownProvider,
  );

  protected readonly emptyTitle = computed(() =>
    this.query().aba === 'proximos' ? this.text.emptyUpcomingTitle : this.text.emptyHistoryTitle,
  );
  protected readonly emptyDescription = computed(() =>
    this.query().aba === 'proximos'
      ? this.text.emptyUpcomingDescription
      : this.text.emptyHistoryDescription,
  );

  protected readonly state = toSignal(
    combineLatest([this.query$, this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([q]) => this.load(q)),
    ),
    { initialValue: LOADING as RemoteState<Listing> },
  );

  constructor() {
    effect(() => {
      const q = this.query();
      const status = Object.fromEntries(
        APPOINTMENT_STATUS_VALUES.map((s) => [s, q.status.includes(s)]),
      ) as Record<AppointmentStatus, boolean>;
      this.filters.setValue({ status, de: q.de ?? '', ate: q.ate ?? '' }, { emitEvent: false });
    });
  }

  private load(q: MyAppointmentsQuery) {
    if (periodError(q.de, q.ate)) {
      return of(IDLE as RemoteState<Listing>);
    }
    const range = tabRange(q, Date.now(), this.browserZone);
    if (!range) {
      return of({ status: 'empty' } as RemoteState<Listing>);
    }
    const request = this.api
      .listMyAppointments({
        status: q.status,
        from: range.from,
        to: range.to,
        providerId: q.prestador,
        sort: q.aba === 'proximos' ? 'startAt' : '-startAt',
        page: q.pagina,
        pageSize: q.itens,
      })
      .pipe(switchMap((page) => this.withZones(page)));
    return toRemoteState<Listing>(request, (listing) => listing.page.items.length === 0);
  }

  /** Resolve o fuso de cada prestador distinto da página (R18); falha → fuso do dispositivo. */
  private withZones(page: Page<AppointmentSummary>) {
    const ids = [...new Set(page.items.map((a) => a.providerId))];
    if (ids.length === 0) {
      return of<Listing>({ page, zones: {} });
    }
    return forkJoin(ids.map((id) => this.zones.get(id).pipe(catchError(() => of(null))))).pipe(
      map((zones): Listing => ({
        page,
        zones: Object.fromEntries(ids.map((id, i) => [id, zones[i] ?? null])),
      })),
    );
  }

  protected when(startAt: Instant, timeZone: string): string {
    return formatInZone(startAt, timeZone);
  }

  protected detailPath(id: string): string {
    return APP_PATHS.customer.appointment(id);
  }

  protected setTab(tab: string): void {
    this.navigate({ ...this.query(), aba: tab as Tab, pagina: 1 });
  }

  protected applyFilters(): void {
    const v = this.filters.getRawValue();
    this.navigate({
      ...this.query(),
      status: APPOINTMENT_STATUS_VALUES.filter((s) => v.status[s]),
      de: v.de || undefined,
      ate: v.ate || undefined,
      pagina: 1,
    });
  }

  protected removeProviderFilter(): void {
    this.navigate({ ...this.query(), prestador: undefined, pagina: 1 });
  }

  protected goToPage(page: number): void {
    this.navigate({ ...this.query(), pagina: page });
  }

  protected setPageSize(size: number): void {
    this.navigate({ ...this.query(), itens: size, pagina: 1 });
  }

  protected reload(): void {
    this.reload$.next();
  }

  private navigate(query: MyAppointmentsQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeListQuery(query, MY_APPOINTMENTS_QUERY_SHAPE),
      queryParamsHandling: 'merge',
    });
  }
}
