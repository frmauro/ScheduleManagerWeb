import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../core/config/app-paths';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/** "Erro inesperado" com o código de rastreio (`/erro?trace=`) para suporte (FR-012). */
@Component({
  selector: 'sm-unexpected-error-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl px-4 py-16 text-center">
      <h1>{{ text.errorPages.unexpectedTitle }}</h1>
      <p class="mt-3 text-gray-700">{{ text.errorPages.unexpectedText }}</p>
      @if (trace()) {
        <p class="mt-3 text-sm text-gray-700">
          {{ text.states.supportCode }}: <code>{{ trace() }}</code>
        </p>
      }
      <a class="sm-btn sm-btn--primary mt-6" [routerLink]="home">{{ text.errorPages.goHome }}</a>
    </section>
  `,
})
export class UnexpectedErrorPageComponent {
  /** Vem da query `trace` (withComponentInputBinding). */
  readonly trace = input<string>();
  protected readonly text = COMMON_MESSAGES;
  protected readonly home = APP_PATHS.home;
}
