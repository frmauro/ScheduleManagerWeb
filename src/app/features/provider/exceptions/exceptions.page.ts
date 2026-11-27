import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, filter, map, startWith, Subject, switchMap } from 'rxjs';
import { ProvidersApi } from '../../../core/api/providers.api';
import { ScheduleApi } from '../../../core/api/schedule.api';
import { isApiError } from '../../../core/errors/api-error';
import { resolveErrorMessage } from '../../../core/errors/error-messages';
import { DialogService } from '../../../core/feedback/dialog.service';
import { ToastService } from '../../../core/feedback/toast.service';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type {
  AppointmentSummary,
  Page,
  ProviderProfile,
  ScheduleException,
  ScheduleExceptionCreated,
} from '../../../core/models/api-models';
import { SCHEDULE_EXCEPTION_TYPE_LABELS } from '../../../core/models/labels';
import {
  PAGE_FIELDS,
  parseListQuery,
  serializeListQuery,
  type ParsedQuery,
  type QueryShape,
} from '../../../shared/state/list-query';
import { LOADING, toRemoteState, type RemoteState } from '../../../shared/state/remote-state';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import {
  RemoteReadyDirective,
  RemoteViewComponent,
} from '../../../shared/ui/remote-view.component';
import { AffectedAppointmentsPanelComponent } from '../affected-appointments-panel.component';
import {
  EXCEPTION_FORM_TITLE_ID,
  ExceptionFormDialogComponent,
  type ExceptionFormDialogData,
} from './exception-form-dialog.component';

export const EXCEPTIONS_QUERY_SHAPE = {
  de: { kind: 'date' },
  ate: { kind: 'date' },
  ...PAGE_FIELDS,
} as const satisfies QueryShape;

type ExceptionsQuery = ParsedQuery<typeof EXCEPTIONS_QUERY_SHAPE>;

/** `2026-12-24` → `24/12/2026` (data pura, sem fuso). */
function brDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Exceções da agenda (`/prestador/excecoes?de=&ate=&pagina=`, FR-042, FR-043): lista por
 * período, nova exceção em diálogo (com painel de afetados) e remoção com confirmação.
 */
@Component({
  selector: 'sm-exceptions-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AffectedAppointmentsPanelComponent,
    ButtonDirective,
    PaginationComponent,
    RemoteReadyDirective,
    RemoteViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{{ text.title }}</h1>
          <p class="mt-1 text-gray-700">{{ text.intro }}</p>
        </div>
        <button type="button" smButton="primary" [disabled]="!timeZoneId()" (click)="add()">
          {{ text.add }}
        </button>
      </div>

      <form
        class="mt-6 flex flex-wrap items-end gap-3"
        [formGroup]="filters"
        [attr.aria-label]="text.filtersLabel"
        (ngSubmit)="applyFilters()"
      >
        <div>
          <label class="sm-label" for="sm-exceptions-from">{{ text.from }}</label>
          <input id="sm-exceptions-from" class="sm-input w-auto" type="date" formControlName="de" />
        </div>
        <div>
          <label class="sm-label" for="sm-exceptions-to">{{ text.to }}</label>
          <input id="sm-exceptions-to" class="sm-input w-auto" type="date" formControlName="ate" />
        </div>
        <button type="submit" smButton="secondary">{{ text.filter }}</button>
      </form>

      @if (affected().length > 0) {
        <div class="mt-4">
          <sm-affected-appointments-panel [appointments]="affected()" [timeZoneId]="timeZoneId()" />
        </div>
      }

      <div class="mt-4">
        <sm-remote-view
          [state]="state()"
          [emptyTitle]="text.emptyTitle"
          [emptyDescription]="text.emptyDescription"
          (retry)="reload()"
        >
          <ng-template [smRemoteReady]="state()" let-page>
            <ul class="flex flex-col gap-3" [attr.aria-label]="text.listLabel">
              @for (item of page.items; track item.id) {
                <li
                  class="sm-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="exception-item"
                >
                  <div class="text-sm">
                    <p class="font-semibold">{{ typeLabels[item.type] }}</p>
                    <p>{{ period(item) }} · {{ times(item) }}</p>
                    @if (item.reason) {
                      <p class="text-gray-700">{{ item.reason }}</p>
                    }
                  </div>
                  <button type="button" smButton="danger" (click)="remove(item)">
                    {{ text.remove }}
                  </button>
                </li>
              }
            </ul>
            <div class="mt-4">
              <sm-pagination
                [meta]="page"
                (pageChange)="goToPage($event)"
                (pageSizeChange)="setPageSize($event)"
              />
            </div>
          </ng-template>
        </sm-remote-view>
      </div>
    </section>
  `,
})
export class ExceptionsPageComponent {
  private readonly api = inject(ScheduleApi);
  private readonly providers = inject(ProvidersApi);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reload$ = new Subject<void>();

  protected readonly text = PROVIDER_MESSAGES.exceptions;
  protected readonly typeLabels = SCHEDULE_EXCEPTION_TYPE_LABELS;
  protected readonly affected = signal<readonly AppointmentSummary[]>([]);

  protected readonly filters = new FormGroup({
    de: new FormControl('', { nonNullable: true }),
    ate: new FormControl('', { nonNullable: true }),
  });

  private readonly query$ = this.route.queryParamMap.pipe(
    map((params) => parseListQuery(params, EXCEPTIONS_QUERY_SHAPE)),
  );
  protected readonly query = toSignal(this.query$, { requireSync: true });

  private readonly profile = toSignal(
    toRemoteState(this.providers.getMe(), () => false),
    { initialValue: LOADING as RemoteState<ProviderProfile> },
  );
  protected readonly timeZoneId = computed(() => {
    const p = this.profile();
    return p.status === 'ready' ? p.value.timeZoneId : '';
  });

  protected readonly state = toSignal(
    combineLatest([this.query$, this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([q]) =>
        toRemoteState(
          this.api.listExceptions({ from: q.de, to: q.ate, page: q.pagina, pageSize: q.itens }),
        ),
      ),
    ),
    { initialValue: LOADING as RemoteState<Page<ScheduleException>> },
  );

  constructor() {
    effect(() => {
      const q = this.query();
      this.filters.setValue({ de: q.de ?? '', ate: q.ate ?? '' }, { emitEvent: false });
    });
  }

  protected add(): void {
    const ref = this.dialogs.open<
      ScheduleExceptionCreated,
      ExceptionFormDialogData,
      ExceptionFormDialogComponent
    >(ExceptionFormDialogComponent, {
      data: { timeZoneId: this.timeZoneId() },
      ariaLabelledBy: EXCEPTION_FORM_TITLE_ID,
    });
    ref.closed
      .pipe(filter((created): created is ScheduleExceptionCreated => created !== undefined))
      .subscribe((created) => {
        this.affected.set(created.affectedAppointments);
        this.toast.success(this.text.created);
        this.reload();
      });
  }

  protected remove(item: ScheduleException): void {
    this.dialogs
      .confirm({
        title: this.text.removeTitle,
        message: this.text.removeMessage,
        confirmLabel: this.text.remove,
        tone: 'danger',
      })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.api.deleteException(item.id).subscribe({
          next: () => {
            this.toast.success(this.text.removed);
            this.reload();
          },
          error: (error: unknown) => {
            if (isApiError(error)) {
              this.toast.error(resolveErrorMessage(error));
              if (error.hasCode('schedule.exception_not_found')) {
                this.reload();
              }
            }
          },
        }),
      );
  }

  protected period(item: ScheduleException): string {
    return this.text.period(brDate(item.startDate), brDate(item.endDate));
  }

  protected times(item: ScheduleException): string {
    return item.startTime && item.endTime ? `${item.startTime}–${item.endTime}` : this.text.allDay;
  }

  protected applyFilters(): void {
    const v = this.filters.getRawValue();
    this.navigate({ ...this.query(), de: v.de || undefined, ate: v.ate || undefined, pagina: 1 });
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

  private navigate(query: ExceptionsQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeListQuery(query, EXCEPTIONS_QUERY_SHAPE),
      queryParamsHandling: 'merge',
    });
  }
}
