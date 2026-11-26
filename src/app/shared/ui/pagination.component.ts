import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideDynamicIcon } from '@lucide/angular';
import { DEFAULT_PAGE_SIZE } from '../../core/config/app.constants';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';
import type { PageMeta } from '../../core/models/api-models';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

let nextPaginationId = 0;

/** Paginação reutilizável (FR-008): anterior/próxima, "Página X de Y" e itens por página (1–100). */
@Component({
  selector: 'sm-pagination',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta(); as m) {
      <nav
        class="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row"
        [attr.aria-label]="text.label"
      >
        <p class="text-sm text-gray-700" aria-live="polite">
          {{ text.pageOf(m.page, m.totalPages) }} · {{ text.totalItems(m.totalCount) }}
        </p>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-700" [attr.for]="sizeId">{{ text.pageSize }}</label>
          <select
            class="sm-select w-auto"
            [id]="sizeId"
            [value]="m.pageSize"
            (change)="onSizeChange($event)"
          >
            @for (size of sizeOptions(); track size) {
              <option [value]="size" [selected]="size === m.pageSize">{{ size }}</option>
            }
          </select>
          <button
            type="button"
            class="sm-btn sm-btn--secondary"
            [disabled]="!hasPrevious()"
            (click)="pageChange.emit(m.page - 1)"
          >
            <svg [lucideIcon]="previousIcon" [size]="16" aria-hidden="true"></svg>
            {{ text.previous }}
          </button>
          <button
            type="button"
            class="sm-btn sm-btn--secondary"
            [disabled]="!hasNext()"
            (click)="pageChange.emit(m.page + 1)"
          >
            {{ text.next }}
            <svg [lucideIcon]="nextIcon" [size]="16" aria-hidden="true"></svg>
          </button>
        </div>
      </nav>
    }
  `,
})
export class PaginationComponent {
  readonly meta = input.required<PageMeta | null>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly text = COMMON_MESSAGES.pagination;
  protected readonly previousIcon = LucideChevronLeft;
  protected readonly nextIcon = LucideChevronRight;
  protected readonly sizeId = `sm-page-size-${nextPaginationId++}`;

  protected readonly hasPrevious = computed(() => (this.meta()?.page ?? 1) > 1);
  protected readonly hasNext = computed(() => {
    const m = this.meta();
    return m !== null && m.page < m.totalPages;
  });
  /** Inclui o tamanho atual se ele não for uma das opções padrão (vindo da URL). */
  protected readonly sizeOptions = computed(() => {
    const current = this.meta()?.pageSize ?? DEFAULT_PAGE_SIZE;
    const options: number[] = [...PAGE_SIZE_OPTIONS];
    return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
  });

  protected onSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isInteger(value) && value >= 1) {
      this.pageSizeChange.emit(value);
    }
  }
}
