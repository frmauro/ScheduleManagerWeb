import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideDynamicIcon, LucideX } from '@lucide/angular';
import { ToastService } from '../../core/feedback/toast.service';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/**
 * Exibe os toasts. O anúncio para leitores de tela já é feito pelo `ToastService`
 * (`LiveAnnouncer`), então esta região não é `aria-live`, para não anunciar duas vezes.
 */
@Component({
  selector: 'sm-toast-outlet',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border p-3 shadow-lg"
          [class.border-tone-danger-fg]="toast.tone === 'error'"
          [class.bg-tone-danger-bg]="toast.tone === 'error'"
          [class.text-tone-danger-fg]="toast.tone === 'error'"
          [class.border-tone-success-fg]="toast.tone === 'success'"
          [class.bg-tone-success-bg]="toast.tone === 'success'"
          [class.text-tone-success-fg]="toast.tone === 'success'"
          [class.border-gray-300]="toast.tone === 'info'"
          [class.bg-white]="toast.tone === 'info'"
        >
          <p class="flex-1 text-sm">{{ toast.message }}</p>
          <button
            type="button"
            class="rounded p-1 hover:bg-black/5"
            [attr.aria-label]="closeLabel"
            (click)="dismiss(toast.id)"
          >
            <svg [lucideIcon]="closeIcon" [size]="16"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastOutletComponent {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;
  protected readonly closeIcon = LucideX;
  protected readonly closeLabel = COMMON_MESSAGES.actions.close;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
