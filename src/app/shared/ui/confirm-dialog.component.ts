import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';
import { ButtonDirective } from './button.directive';

export interface ConfirmDialogData {
  readonly title: string;
  readonly message: string;
  /** Texto extra (ex.: consequências da ação). */
  readonly details?: readonly string[];
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: 'primary' | 'danger';
}

/** Diálogo de confirmação (foco preso, `Esc` fecha e o foco volta ao gatilho: CDK). */
@Component({
  selector: 'sm-confirm-dialog',
  standalone: true,
  imports: [ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <h2 [id]="titleId" class="mb-2">{{ data.title }}</h2>
    <p class="text-gray-700">{{ data.message }}</p>
    @if (data.details?.length) {
      <ul class="mt-2 list-disc pl-5 text-sm text-gray-700">
        @for (item of data.details; track $index) {
          <li>{{ item }}</li>
        }
      </ul>
    }
    <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" smButton="secondary" (click)="close(false)">
        {{ data.cancelLabel ?? cancelText }}
      </button>
      <button
        type="button"
        [smButton]="data.tone === 'danger' ? 'danger' : 'primary'"
        (click)="close(true)"
      >
        {{ data.confirmLabel }}
      </button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly cancelText = COMMON_MESSAGES.actions.cancel;
  readonly titleId = 'sm-confirm-dialog-title';

  protected close(result: boolean): void {
    this.ref.close(result);
  }
}
