import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideDynamicIcon, LucideTriangleAlert, LucideX } from '@lucide/angular';
import { sanitizeReturnUrl } from '../../core/auth/return-url';
import { LOGIN_PATH } from '../../core/auth/session-expiry';
import { SessionStore } from '../../core/auth/session.store';
import { SessionTimerService } from '../../core/auth/session-timer.service';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/**
 * Aviso de sessão 5 min antes de expirar (FR-017a): não bloqueante, anunciado a leitores de tela
 * (`aria-live="polite"`, sempre presente no DOM para o anúncio funcionar) e exibido uma vez.
 * "Entrar novamente" faz um novo login preservando a página atual; não há renovação na API.
 */
@Component({
  selector: 'sm-session-warning',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div aria-live="polite" class="fixed inset-x-0 top-2 z-50 flex justify-center px-4">
      @if (visible()) {
        <div
          class="flex w-full max-w-xl items-center gap-3 rounded-md border border-tone-warning-fg bg-tone-warning-bg p-3 text-tone-warning-fg shadow-lg"
          data-testid="session-warning"
        >
          <svg [lucideIcon]="warningIcon" [size]="20" aria-hidden="true"></svg>
          <p class="flex-1 text-sm font-medium">{{ text.expiresSoon }}</p>
          <button type="button" class="sm-btn sm-btn--secondary" (click)="loginAgain()">
            {{ text.loginAgain }}
          </button>
          <button
            type="button"
            class="rounded p-1 hover:bg-black/5"
            [attr.aria-label]="closeLabel"
            (click)="dismiss()"
          >
            <svg [lucideIcon]="closeIcon" [size]="16" aria-hidden="true"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class SessionWarningComponent {
  private readonly timer = inject(SessionTimerService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly visible = this.timer.warningVisible;
  protected readonly text = COMMON_MESSAGES.session;
  protected readonly closeLabel = COMMON_MESSAGES.actions.close;
  protected readonly warningIcon = LucideTriangleAlert;
  protected readonly closeIcon = LucideX;

  protected dismiss(): void {
    this.timer.dismissWarning();
  }

  /** Novo login: descarta a sessão atual e volta a esta página depois (SC-010). */
  protected loginAgain(): void {
    const returnUrl = sanitizeReturnUrl(this.router.url);
    this.timer.cancel();
    this.session.clear();
    void this.router.navigate([LOGIN_PATH], {
      queryParams: returnUrl ? { returnUrl } : {},
    });
  }
}
