import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../core/config/app-paths';
import { homeForRole } from '../../core/auth/return-url';
import { SessionStore } from '../../core/auth/session.store';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/** "Você não tem permissão" (FR-012, FR-020, cenário 14). */
@Component({
  selector: 'sm-forbidden-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl px-4 py-16 text-center">
      <h1>{{ text.forbiddenTitle }}</h1>
      <p class="mt-3 text-gray-700">{{ text.forbiddenText }}</p>
      <a class="sm-btn sm-btn--primary mt-6" [routerLink]="homeLink()">{{ text.goHome }}</a>
    </section>
  `,
})
export class ForbiddenPageComponent {
  private readonly session = inject(SessionStore);
  protected readonly text = COMMON_MESSAGES.errorPages;
  protected readonly homeLink = computed(() => {
    const role = this.session.role();
    return role ? homeForRole(role) : APP_PATHS.home;
  });
}
