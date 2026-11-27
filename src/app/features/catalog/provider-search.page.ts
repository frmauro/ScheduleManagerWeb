import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, startWith, Subject, switchMap } from 'rxjs';
import { ProvidersApi, type ProviderSort } from '../../core/api/providers.api';
import { APP_PATHS } from '../../core/config/app-paths';
import { CATALOG_MESSAGES } from '../../core/i18n/catalog.messages';
import type { Page, ProviderSummary } from '../../core/models/api-models';
import { SERVICE_CATEGORY_VALUES, isOneOf, type ServiceCategory } from '../../core/models/enums';
import { SERVICE_CATEGORY_LABELS } from '../../core/models/labels';
import { SmValidators } from '../../shared/forms/validators';
import {
  PAGE_FIELDS,
  parseListQuery,
  serializeListQuery,
  type ParsedQuery,
  type QueryShape,
} from '../../shared/state/list-query';
import { LOADING, toRemoteState, type RemoteState } from '../../shared/state/remote-state';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { RemoteReadyDirective, RemoteViewComponent } from '../../shared/ui/remote-view.component';
import { enumOptions } from '../../shared/ui/select-options';

/** Ordem na URL em pt-BR (contracts/routes.md) → `sort` da API. */
const SORT_TO_API: Record<'nome' | '-nome', ProviderSort> = {
  nome: 'displayName',
  '-nome': '-displayName',
};

export const SEARCH_QUERY_SHAPE = {
  q: { kind: 'string' },
  categoria: { kind: 'enum', values: SERVICE_CATEGORY_VALUES },
  cidade: { kind: 'string' },
  ordem: { kind: 'enum', values: ['nome', '-nome'], default: 'nome' },
  ...PAGE_FIELDS,
} as const satisfies QueryShape;

type SearchQuery = ParsedQuery<typeof SEARCH_QUERY_SHAPE>;

/** Busca pública de prestadores com filtros na URL (US1, FR-022). Rota `/`. */
@Component({
  selector: 'sm-provider-search-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    PaginationComponent,
    RemoteViewComponent,
    RemoteReadyDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl px-4 py-8">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      <form
        class="sm-card mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        role="search"
        [attr.aria-label]="text.filtersLabel"
        [formGroup]="form"
        (ngSubmit)="apply()"
      >
        <sm-field class="lg:col-span-2" [label]="text.nameLabel">
          <input
            smFieldControl
            class="sm-input"
            type="search"
            formControlName="q"
            [placeholder]="text.namePlaceholder"
          />
        </sm-field>
        <sm-field [label]="text.categoryLabel">
          <select smFieldControl class="sm-select" formControlName="categoria">
            <option value="">{{ text.allCategories }}</option>
            @for (option of categoryOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </sm-field>
        <sm-field [label]="text.cityLabel">
          <input smFieldControl class="sm-input" type="text" formControlName="cidade" />
        </sm-field>
        <sm-field [label]="text.sortLabel">
          <select smFieldControl class="sm-select" formControlName="ordem">
            <option value="nome">{{ text.sortAsc }}</option>
            <option value="-nome">{{ text.sortDesc }}</option>
          </select>
        </sm-field>
        <div class="flex gap-2 lg:col-span-5">
          <button type="submit" smButton [disabled]="form.invalid">{{ text.submit }}</button>
          @if (hasFilters()) {
            <button type="button" smButton="ghost" (click)="clearFilters()">
              {{ text.clearFilters }}
            </button>
          }
        </div>
      </form>

      <div class="mt-6">
        <sm-remote-view
          [state]="state()"
          [emptyTitle]="text.emptyTitle"
          [emptyDescription]="text.emptyDescription"
          [skeletonRows]="4"
          (retry)="reload()"
        >
          <button smEmptyAction type="button" smButton="secondary" (click)="clearFilters()">
            {{ text.clearFilters }}
          </button>
          <ng-template [smRemoteReady]="state()" let-page>
            <h2 class="sr-only">{{ text.resultsLabel }}</h2>
            <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              @for (provider of page.items; track provider.id) {
                <li>
                  <a
                    class="sm-card block h-full hover:border-brand focus-visible:border-brand"
                    [routerLink]="providerLink(provider.id)"
                  >
                    <span class="block font-semibold text-gray-900">{{
                      provider.displayName
                    }}</span>
                    <span class="mt-1 block text-sm text-gray-700">
                      {{ categoryLabel(provider.category) }}
                    </span>
                    <span class="mt-1 block text-sm text-gray-700">
                      {{ provider.city }} / {{ provider.state }}
                    </span>
                  </a>
                </li>
              }
            </ul>
            <sm-pagination
              [meta]="page"
              (pageChange)="goToPage($event)"
              (pageSizeChange)="changePageSize($event)"
            />
          </ng-template>
        </sm-remote-view>
      </div>
    </section>
  `,
})
export class ProviderSearchPageComponent {
  private readonly api = inject(ProvidersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload$ = new Subject<void>();

  protected readonly text = CATALOG_MESSAGES.search;
  protected readonly categoryOptions = enumOptions(
    SERVICE_CATEGORY_VALUES,
    SERVICE_CATEGORY_LABELS,
  );

  protected readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true, validators: SmValidators.searchText }),
    categoria: new FormControl<ServiceCategory | ''>('', { nonNullable: true }),
    cidade: new FormControl('', { nonNullable: true, validators: SmValidators.searchText }),
    ordem: new FormControl<'nome' | '-nome'>('nome', { nonNullable: true }),
  });

  private readonly query$ = this.route.queryParamMap.pipe(
    map((params) => parseListQuery(params, SEARCH_QUERY_SHAPE)),
  );

  protected readonly query = toSignal(this.query$, { requireSync: true });

  protected readonly state = toSignal(
    combineLatest([this.query$, this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([q]) =>
        toRemoteState(
          this.api.search({
            q: q.q,
            category: q.categoria,
            city: q.cidade,
            sort: SORT_TO_API[q.ordem],
            page: q.pagina,
            pageSize: q.itens,
          }),
        ),
      ),
    ),
    { initialValue: LOADING as RemoteState<Page<ProviderSummary>> },
  );

  protected readonly hasFilters = computed(() => {
    const q = this.query();
    return !!(q.q || q.categoria || q.cidade);
  });

  constructor() {
    // A URL é a fonte da verdade: ao voltar/recarregar, os campos refletem os filtros.
    effect(() => {
      const q = this.query();
      this.form.setValue(
        { q: q.q ?? '', categoria: q.categoria ?? '', cidade: q.cidade ?? '', ordem: q.ordem },
        { emitEvent: false },
      );
    });
  }

  protected apply(): void {
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    this.navigate({
      ...this.query(),
      q: v.q.trim() || undefined,
      categoria: isOneOf(SERVICE_CATEGORY_VALUES, v.categoria) ? v.categoria : undefined,
      cidade: v.cidade.trim() || undefined,
      ordem: v.ordem,
      pagina: 1,
    });
  }

  protected clearFilters(): void {
    this.navigate({
      ...this.query(),
      q: undefined,
      categoria: undefined,
      cidade: undefined,
      pagina: 1,
    });
  }

  protected goToPage(page: number): void {
    this.navigate({ ...this.query(), pagina: page });
  }

  protected changePageSize(size: number): void {
    this.navigate({ ...this.query(), itens: size, pagina: 1 });
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected providerLink(id: string): string {
    return APP_PATHS.provider(id);
  }

  protected categoryLabel(category: ServiceCategory): string {
    return SERVICE_CATEGORY_LABELS[category];
  }

  private navigate(query: SearchQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeListQuery(query, SEARCH_QUERY_SHAPE),
      queryParamsHandling: 'merge',
    });
  }
}
