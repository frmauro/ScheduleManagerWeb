import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ApiError } from '../../core/errors/api-error';
import { resolveErrorMessage } from '../../core/errors/error-messages';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';
import { ButtonDirective } from './button.directive';

/**
 * Erro inline com mensagem do catálogo, código de rastreio quando houver e "Tentar novamente"
 * (FR-006, FR-012).
 */
@Component({
  selector: 'sm-error-state',
  standalone: true,
  imports: [ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col gap-3 rounded-md border border-tone-danger-fg bg-tone-danger-bg p-4 text-tone-danger-fg"
      role="alert"
    >
      <p class="font-medium">{{ message() }}</p>
      @if (showTrace()) {
        <p class="text-sm">
          {{ text.states.supportCode }}: <code>{{ error().traceId }}</code>
        </p>
      }
      @if (retryable()) {
        <div>
          <button type="button" smButton="secondary" (click)="retry.emit()">
            {{ text.actions.retry }}
          </button>
        </div>
      }
    </div>
  `,
})
export class ErrorStateComponent {
  readonly error = input.required<ApiError>();
  readonly retryable = input(true);
  readonly retry = output<void>();

  protected readonly text = COMMON_MESSAGES;
  protected readonly message = computed(() => resolveErrorMessage(this.error()));
  /** O código já aparece na mensagem quando o catálogo o interpola. */
  protected readonly showTrace = computed(() => {
    const traceId = this.error().traceId;
    return !!traceId && !this.message().includes(traceId);
  });
}
