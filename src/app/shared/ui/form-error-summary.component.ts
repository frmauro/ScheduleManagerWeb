import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/**
 * Resumo de erros sem campo correspondente (ex.: chaves do `400` que não estão no formulário)
 * e erros de regra exibidos no topo do formulário. Recebe o foco ao aparecer (FR-006, FR-011).
 */
@Component({
  selector: 'sm-form-error-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (messages().length > 0) {
      <div
        class="rounded-md border border-tone-danger-fg bg-tone-danger-bg p-3 text-tone-danger-fg"
        role="alert"
        tabindex="-1"
      >
        @if (title()) {
          <p class="font-semibold">{{ title() }}</p>
        }
        <ul class="list-disc pl-5 text-sm">
          @for (message of messages(); track $index) {
            <li>{{ message }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class FormErrorSummaryComponent {
  readonly messages = input<readonly string[]>([]);
  readonly title = input<string>(COMMON_MESSAGES.forms.summaryTitle);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect(() => {
      if (this.messages().length > 0) {
        this.host.nativeElement.querySelector<HTMLElement>('[role="alert"]')?.focus();
      }
    });
  }
}
