import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, filter, map, startWith, Subject, switchMap, type Observable } from 'rxjs';
import { ServicesApi } from '../../../core/api/services.api';
import { formatDuration } from '../../../core/domain/booking-policy-format';
import { isApiError } from '../../../core/errors/api-error';
import { ERROR_MESSAGES, resolveErrorMessage } from '../../../core/errors/error-messages';
import { DialogService } from '../../../core/feedback/dialog.service';
import { ToastService } from '../../../core/feedback/toast.service';
import { COMMON_MESSAGES } from '../../../core/i18n/common.messages';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { Page, Service } from '../../../core/models/api-models';
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
import {
  SERVICE_FORM_TITLE_ID,
  ServiceFormDialogComponent,
  type ServiceFormDialogData,
} from './service-form-dialog.component';

export const SERVICES_QUERY_SHAPE = {
  ativos: { kind: 'enum', values: ['todos', 'sim', 'nao'], default: 'todos' },
  ...PAGE_FIELDS,
} as const satisfies QueryShape;

type ServicesQuery = ParsedQuery<typeof SERVICES_QUERY_SHAPE>;

const ACTIVE_FILTER: Record<ServicesQuery['ativos'], boolean | undefined> = {
  todos: undefined,
  sim: true,
  nao: false,
};

/**
 * Serviços do prestador (`/prestador/servicos?ativos=&pagina=`, FR-040): lista com inativos,
 * criar/editar em diálogo, ativar/desativar e excluir (serviço já agendado → oferece desativar).
 */
@Component({
  selector: 'sm-services-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    ButtonDirective,
    PaginationComponent,
    RemoteViewComponent,
    RemoteReadyDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl px-4 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{{ text.title }}</h1>
          <p class="mt-1 text-gray-700">{{ text.intro }}</p>
        </div>
        <button type="button" smButton="primary" (click)="openForm()">{{ text.add }}</button>
      </div>

      <div class="mt-6">
        <label class="sm-label" for="sm-services-filter">{{ text.filterLabel }}</label>
        <select
          id="sm-services-filter"
          class="sm-select w-auto"
          [value]="query().ativos"
          (change)="setFilter($event)"
        >
          <option value="todos">{{ text.filterAll }}</option>
          <option value="sim">{{ text.filterActive }}</option>
          <option value="nao">{{ text.filterInactive }}</option>
        </select>
      </div>

      <div class="mt-4">
        <sm-remote-view
          [state]="state()"
          [emptyTitle]="text.emptyTitle"
          [emptyDescription]="text.emptyDescription"
          (retry)="reload()"
        >
          <ng-template [smRemoteReady]="state()" let-page>
            <ul class="flex flex-col gap-3" [attr.aria-label]="text.listLabel">
              @for (service of page.items; track service.id) {
                <li
                  class="sm-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="service-item"
                >
                  <div>
                    <h2 class="text-base font-semibold">{{ service.name }}</h2>
                    <p class="text-sm text-gray-700">
                      {{ duration(service.durationMinutes) }} · {{ service.price | currency }}
                    </p>
                    <p class="mt-1 text-sm font-medium" data-testid="service-status">
                      {{ service.isActive ? text.active : text.inactive }}
                    </p>
                  </div>
                  <div
                    class="flex flex-wrap gap-2"
                    role="group"
                    [attr.aria-label]="text.actionsFor(service.name)"
                  >
                    <button type="button" smButton="secondary" (click)="openForm(service)">
                      {{ text.edit }}
                    </button>
                    <button type="button" smButton="secondary" (click)="toggle(service)">
                      {{ service.isActive ? text.deactivate : text.activate }}
                    </button>
                    <button type="button" smButton="danger" (click)="remove(service)">
                      {{ text.delete }}
                    </button>
                  </div>
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
export class ServicesPageComponent {
  private readonly api = inject(ServicesApi);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reload$ = new Subject<void>();

  protected readonly text = PROVIDER_MESSAGES.services;

  private readonly query$ = this.route.queryParamMap.pipe(
    map((params) => parseListQuery(params, SERVICES_QUERY_SHAPE)),
  );
  protected readonly query = toSignal(this.query$, { requireSync: true });

  protected readonly state = toSignal(
    combineLatest([this.query$, this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([q]) =>
        toRemoteState(
          this.api.listMine({
            isActive: ACTIVE_FILTER[q.ativos],
            page: q.pagina,
            pageSize: q.itens,
          }),
        ),
      ),
    ),
    { initialValue: LOADING as RemoteState<Page<Service>> },
  );

  protected openForm(service?: Service): void {
    const ref = this.dialogs.open<Service, ServiceFormDialogData, ServiceFormDialogComponent>(
      ServiceFormDialogComponent,
      { data: { service }, ariaLabelledBy: SERVICE_FORM_TITLE_ID },
    );
    ref.closed.pipe(filter((saved): saved is Service => saved !== undefined)).subscribe(() => {
      this.toast.success(service ? this.text.updated : this.text.created);
      this.reload();
    });
  }

  protected toggle(service: Service): void {
    this.run(this.api.setStatus(service.id, !service.isActive), () =>
      this.toast.success(service.isActive ? this.text.deactivated : this.text.activated),
    );
  }

  protected remove(service: Service): void {
    this.dialogs
      .confirm({
        title: this.text.deleteTitle,
        message: this.text.deleteMessage(service.name),
        confirmLabel: this.text.delete,
        tone: 'danger',
      })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.api.delete(service.id).subscribe({
          next: () => {
            this.toast.success(this.text.deleted);
            this.reload();
          },
          error: (error: unknown) => {
            if (isApiError(error) && error.hasCode('service.in_use')) {
              this.offerDeactivate(service);
            } else {
              this.showError(error);
            }
          },
        }),
      );
  }

  /** `409 service.in_use`: não dá para excluir; oferece desativar (US4 #7). */
  private offerDeactivate(service: Service): void {
    this.dialogs
      .confirm({
        title: this.text.inUseTitle,
        message: ERROR_MESSAGES['service.in_use'].message,
        confirmLabel: this.text.deactivate,
        cancelLabel: COMMON_MESSAGES.actions.close,
      })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.run(this.api.setStatus(service.id, false), () =>
          this.toast.success(this.text.deactivated),
        ),
      );
  }

  private run(request: Observable<unknown>, done: () => void): void {
    request.subscribe({
      next: () => {
        done();
        this.reload();
      },
      error: (error: unknown) => this.showError(error),
    });
  }

  private showError(error: unknown): void {
    if (isApiError(error)) {
      this.toast.error(resolveErrorMessage(error));
    }
  }

  protected setFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const ativos = SERVICES_QUERY_SHAPE.ativos.values.find((v) => v === value) ?? 'todos';
    this.navigate({ ...this.query(), ativos, pagina: 1 });
  }

  protected goToPage(page: number): void {
    this.navigate({ ...this.query(), pagina: page });
  }

  protected setPageSize(size: number): void {
    this.navigate({ ...this.query(), itens: size, pagina: 1 });
  }

  protected duration(minutes: number): string {
    return formatDuration(minutes);
  }

  protected reload(): void {
    this.reload$.next();
  }

  private navigate(query: ServicesQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeListQuery(query, SERVICES_QUERY_SHAPE),
      queryParamsHandling: 'merge',
    });
  }
}
