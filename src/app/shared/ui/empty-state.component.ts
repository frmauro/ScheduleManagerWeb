import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Estado vazio com mensagem e ação opcional projetada (FR-004). */
@Component({
  selector: 'sm-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sm-card flex flex-col items-center gap-3 py-10 text-center" role="status">
      <p class="font-medium text-gray-900">{{ title() }}</p>
      @if (description()) {
        <p class="max-w-md text-sm text-gray-700">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
