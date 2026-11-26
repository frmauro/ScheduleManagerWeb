import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/** Placeholder de carregamento (SC-008: conteúdo ou skeleton em até 1 s). */
@Component({
  selector: 'sm-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-live="polite" class="flex flex-col gap-3">
      <span class="sr-only">{{ loadingText }}</span>
      @for (line of lines(); track line) {
        <div class="h-14 animate-pulse rounded-md bg-gray-200" aria-hidden="true"></div>
      }
    </div>
  `,
})
export class SkeletonComponent {
  readonly rows = input(3);
  protected readonly lines = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
  protected readonly loadingText = COMMON_MESSAGES.states.loading;
}
