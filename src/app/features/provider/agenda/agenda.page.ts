import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, filter, map, of, shareReplay, startWith, Subject, switchMap } from 'rxjs';
import { ProvidersApi } from '../../../core/api/providers.api';
import { ServicesApi } from '../../../core/api/services.api';
import { MAX_PERIOD_DAYS } from '../../../core/config/app.constants';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type {
  AppointmentSummary,
  LocalDate,
  Page,
  ProviderProfile,
} from '../../../core/models/api-models';
import { APPOINTMENT_STATUS_VALUES, type AppointmentStatus } from '../../../core/models/enums';
import { APPOINTMENT_STATUS_LABELS } from '../../../core/models/labels';
import {
  PAGE_FIELDS,
  parseListQuery,
  serializeListQuery,
  type ParsedQuery,
  type QueryShape,
} from '../../../shared/state/list-query';
import { IDLE, LOADING, toRemoteState, type RemoteState } from '../../../shared/state/remote-state';
import {
  addDays,
  daysBetween,
  todayInZone,
  zonedDayRange,
  zonedWeekRange,
} from '../../../shared/time/zoned-time';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { ErrorStateComponent } from '../../../shared/ui/error-state.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  RemoteReadyDirective,
  RemoteViewComponent,
} from '../../../shared/ui/remote-view.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton.component';
import { TabsComponent, type TabItem } from '../../../shared/ui/tabs.component';
import { ZoneHintComponent } from '../../../shared/ui/zone-hint.component';
import { AgendaDayComponent } from './agenda-day.component';
import { AgendaListComponent } from './agenda-list.component';
import { AgendaWeekComponent } from './agenda-week.component';

const VIEWS = ['lista', 'dia', 'semana'] as const;
type AgendaView = (typeof VIEWS)[number];

export const AGENDA_QUERY_SHAPE = {
  visao: { kind: 'enum', values: VIEWS, default: 'lista' },
  data: { kind: 'date' },
  status: { kind: 'enumArray', values: APPOINTMENT_STATUS_VALUES },
  servico: { kind: 'string' },
  de: { kind: 'date' },
  ate: { kind: 'date' },
  ...PAGE_FIELDS,
} as const satisfies QueryShape;

type AgendaQuery = ParsedQuery<typeof AGENDA_QUERY_SHAPE>;

type AgendaData =
  | { readonly kind: 'list'; readonly page: Page<AppointmentSummary> }
  | { readonly kind: 'calendar'; readonly items: AppointmentSummary[] };

type PeriodError = 'order' | 'tooLong' | null;

/** Período da lista: `de` (padrão hoje) até `ate` inclusivo; máximo de 366 dias (FR-044). */
export function periodError(from: LocalDate, to: LocalDate | undefined): PeriodError {
  if (!to) {
    return null;
  }
  const days = daysBetween(from, to);
  return days < 0 ? 'order' : days + 1 > MAX_PERIOD_DAYS ? 'tooLong' : null;
}

function statusControls(): Record<AppointmentStatus, FormControl<boolean>> {
  return Object.fromEntries(
    APPOINTMENT_STATUS_VALUES.map((s) => [s, new FormControl(false, { nonNullable: true })]),
  ) as Record<AppointmentStatus, FormControl<boolean>>;
}

/**
 * Agenda do prestador (`/prestador/agenda?visao=&data=&status=&servico=&de=&ate=&pagina=`,
 * FR-044): lista paginada ou calendário dia/semana no fuso do prestador, com filtros na URL.
 */
@Component({
  selector: 'sm-agenda-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AgendaDayComponent,
    AgendaListComponent,
    AgendaWeekComponent,
    ButtonDirective,
    ErrorStateComponent,
    PaginationComponent,
    RemoteReadyDirective,
    RemoteViewComponent,
    SkeletonComponent,
    TabsComponent,
    ZoneHintComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1>{{ text.title }}</h1>
        @if (timeZoneId(); as tz) {
          <sm-zone-hint [timeZone]="tz" />
        }
      </div>

      @switch (profile().status) {
        @case ('error') {
          @if (profileError(); as error) {
            <div class="mt-6"><sm-error-state [error]="error" (retry)="reload()" /></div>
          }
        }
        @case ('ready') {
          <div class="mt-4">
            <sm-tabs
              #tabs="smTabs"
              [tabs]="viewTabs"
              [active]="query().visao"
              [ariaLabel]="text.viewsLabel"
              (activeChange)="setView($event)"
            />
            <div
              role="tabpanel"
              class="pt-4"
              [id]="tabs.panelId"
              [attr.aria-labelledby]="tabs.tabId(query().visao)"
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
                  <label class="sm-label" for="sm-agenda-service">{{ text.service }}</label>
                  <select id="sm-agenda-service" class="sm-select w-auto" formControlName="servico">
                    <option value="">{{ text.allServices }}</option>
                    @for (service of services(); track service.id) {
                      <option [value]="service.id">{{ service.name }}</option>
                    }
                  </select>
                </div>
                @if (query().visao === 'lista') {
                  <div>
                    <label class="sm-label" for="sm-agenda-from">{{ text.from }}</label>
                    <input
                      id="sm-agenda-from"
                      class="sm-input w-auto"
                      type="date"
                      formControlName="de"
                      aria-describedby="sm-agenda-from-hint"
                    />
                    <p id="sm-agenda-from-hint" class="sm-hint">{{ text.fromHint }}</p>
                  </div>
                  <div>
                    <label class="sm-label" for="sm-agenda-to">{{ text.to }}</label>
                    <input
                      id="sm-agenda-to"
                      class="sm-input w-auto"
                      type="date"
                      formControlName="ate"
                      [attr.aria-invalid]="periodMessage() ? 'true' : null"
                      [attr.aria-describedby]="periodMessage() ? 'sm-agenda-period-error' : null"
                    />
                    @if (periodMessage(); as message) {
                      <p id="sm-agenda-period-error" class="sm-error" data-testid="period-error">
                        {{ message }}
                      </p>
                    }
                  </div>
                }
                <button type="submit" smButton="secondary">{{ text.filter }}</button>
              </form>

              @if (query().visao !== 'lista') {
                <nav
                  class="mt-4 flex flex-wrap items-center gap-2"
                  [attr.aria-label]="text.navLabel"
                >
                  <button type="button" smButton="secondary" (click)="shift(-1)">
                    ← {{ query().visao === 'dia' ? text.previousDay : text.previousWeek }}
                  </button>
                  <button type="button" smButton="secondary" (click)="goToday()">
                    {{ text.today }}
                  </button>
                  <button type="button" smButton="secondary" (click)="shift(1)">
                    {{ query().visao === 'dia' ? text.nextDay : text.nextWeek }} →
                  </button>
                </nav>
              }

              <div class="mt-4">
                <sm-remote-view
                  [state]="state()"
                  [emptyTitle]="text.emptyTitle"
                  [emptyDescription]="text.emptyDescription"
                  (retry)="reload()"
                >
                  <ng-template [smRemoteReady]="state()" let-data>
                    @if (data.kind === 'list') {
                      <sm-agenda-list
                        [appointments]="data.page.items"
                        [timeZoneId]="timeZoneId()"
                      />
                      <div class="mt-4">
                        <sm-pagination
                          [meta]="data.page"
                          (pageChange)="goToPage($event)"
                          (pageSizeChange)="setPageSize($event)"
                        />
                      </div>
                    } @else {
                      <p class="mb-2 text-sm" role="status" data-testid="agenda-summary">
                        @if (pendingCount(data.items); as pending) {
                          {{ text.pendingCount(pending) }}
                        } @else if (data.items.length === 0) {
                          {{ text.emptyPeriod }}
                        }
                      </p>
                      @if (query().visao === 'dia') {
                        <sm-agenda-day
                          [appointments]="data.items"
                          [date]="calendarDate()"
                          [timeZoneId]="timeZoneId()"
                        />
                      } @else {
                        <sm-agenda-week
                          [appointments]="data.items"
                          [date]="calendarDate()"
                          [timeZoneId]="timeZoneId()"
                        />
                      }
                    }
                  </ng-template>
                </sm-remote-view>
              </div>
            </div>
          </div>
        }
        @default {
          <div class="mt-6"><sm-skeleton [rows]="5" /></div>
        }
      }
    </section>
  `,
})
export class AgendaPageComponent {
  private readonly providers = inject(ProvidersApi);
  private readonly servicesApi = inject(ServicesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reload$ = new Subject<void>();

  protected readonly text = PROVIDER_MESSAGES.agenda;
  protected readonly statuses = APPOINTMENT_STATUS_VALUES;
  protected readonly statusLabels = APPOINTMENT_STATUS_LABELS;
  protected readonly viewTabs: readonly TabItem<AgendaView>[] = VIEWS.map((id) => ({
    id,
    label: this.text.views[id],
  }));

  protected readonly filters = new FormGroup({
    status: new FormGroup(statusControls()),
    servico: new FormControl('', { nonNullable: true }),
    de: new FormControl('', { nonNullable: true }),
    ate: new FormControl('', { nonNullable: true }),
  });

  private readonly query$ = this.route.queryParamMap.pipe(
    map((params) => parseListQuery(params, AGENDA_QUERY_SHAPE)),
  );
  protected readonly query = toSignal(this.query$, { requireSync: true });

  protected readonly profile = toSignal(
    this.reload$.pipe(
      startWith(undefined),
      switchMap(() => toRemoteState(this.providers.getMe(), () => false)),
      shareReplay({ bufferSize: 1, refCount: true }),
    ),
    { initialValue: LOADING as RemoteState<ProviderProfile> },
  );
  protected readonly profileError = computed(() => {
    const p = this.profile();
    return p.status === 'error' ? p.error : null;
  });
  protected readonly timeZoneId = computed(() => {
    const p = this.profile();
    return p.status === 'ready' ? p.value.timeZoneId : '';
  });

  protected readonly services = toSignal(
    this.servicesApi.listMine({ pageSize: 100 }).pipe(map((page) => page.items)),
    { initialValue: [] },
  );

  private readonly today = computed(() => {
    const tz = this.timeZoneId();
    return tz ? todayInZone(tz) : '';
  });
  protected readonly calendarDate = computed(() => this.query().data ?? this.today());

  private readonly period = computed(() => {
    const q = this.query();
    const from = q.de ?? this.today();
    return { from, to: q.ate, error: periodError(from, q.ate) };
  });
  protected readonly periodMessage = computed(() => {
    const error = this.query().visao === 'lista' ? this.period().error : null;
    return error === 'order'
      ? this.text.periodOrder
      : error === 'tooLong'
        ? this.text.periodTooLong(MAX_PERIOD_DAYS)
        : null;
  });

  protected readonly state = toSignal(
    combineLatest([
      this.query$,
      toObservable(this.timeZoneId).pipe(filter((tz) => tz !== '')),
      this.reload$.pipe(startWith(undefined)),
    ]).pipe(switchMap(([q, tz]) => this.load(q, tz))),
    { initialValue: LOADING as RemoteState<AgendaData> },
  );

  constructor() {
    effect(() => {
      const q = this.query();
      const status = Object.fromEntries(
        APPOINTMENT_STATUS_VALUES.map((s) => [s, q.status.includes(s)]),
      ) as Record<AppointmentStatus, boolean>;
      this.filters.setValue(
        { status, servico: q.servico ?? '', de: q.de ?? '', ate: q.ate ?? '' },
        { emitEvent: false },
      );
    });
  }

  private load(q: AgendaQuery, tz: string) {
    const filters = { status: q.status, serviceId: q.servico };
    if (q.visao === 'lista') {
      const from = q.de ?? todayInZone(tz);
      if (periodError(from, q.ate)) {
        return of(IDLE as RemoteState<AgendaData>);
      }
      return toRemoteState<AgendaData>(
        this.providers
          .listMyAppointments({
            ...filters,
            from: zonedDayRange(from, tz).from,
            to: q.ate ? zonedDayRange(q.ate, tz).to : undefined,
            sort: 'startAt',
            page: q.pagina,
            pageSize: q.itens,
          })
          .pipe(map((page) => ({ kind: 'list', page }) as const)),
        (data) => data.kind === 'list' && data.page.items.length === 0,
      );
    }
    const date = q.data ?? todayInZone(tz);
    const range = q.visao === 'dia' ? zonedDayRange(date, tz) : zonedWeekRange(date, tz);
    return toRemoteState<AgendaData>(
      this.providers
        .listAllMyAppointmentsInRange(range.from, range.to, filters)
        .pipe(map((items) => ({ kind: 'calendar', items }) as const)),
      () => false,
    );
  }

  protected pendingCount(items: readonly AppointmentSummary[]): number {
    return items.filter((a) => a.status === 'Pending').length;
  }

  protected setView(view: string): void {
    this.navigate({ ...this.query(), visao: view as AgendaView, pagina: 1 });
  }

  protected applyFilters(): void {
    const v = this.filters.getRawValue();
    const status = APPOINTMENT_STATUS_VALUES.filter((s) => v.status[s]);
    this.navigate({
      ...this.query(),
      status,
      servico: v.servico || undefined,
      de: v.de || undefined,
      ate: v.ate || undefined,
      pagina: 1,
    });
  }

  protected shift(direction: 1 | -1): void {
    const step = this.query().visao === 'dia' ? 1 : 7;
    this.navigate({ ...this.query(), data: addDays(this.calendarDate(), direction * step) });
  }

  protected goToday(): void {
    this.navigate({ ...this.query(), data: undefined });
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

  private navigate(query: AgendaQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeListQuery(query, AGENDA_QUERY_SHAPE),
      queryParamsHandling: 'merge',
    });
  }
}
