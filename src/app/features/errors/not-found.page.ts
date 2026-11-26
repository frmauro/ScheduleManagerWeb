import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATHS } from '../../core/config/app-paths';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/** Página "não encontrado" com caminho de volta à busca (FR-012, US1 #6). */
@Component({
  selector: 'sm-not-found-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl px-4 py-16 text-center">
      <h1>{{ text.notFoundTitle }}</h1>
      <p class="mt-3 text-gray-700">{{ text.notFoundText }}</p>
      <a class="sm-btn sm-btn--primary mt-6" [routerLink]="home">{{ text.backToSearch }}</a>
    </section>
  `,
})
export class NotFoundPageComponent {
  protected readonly text = COMMON_MESSAGES.errorPages;
  protected readonly home = APP_PATHS.home;
}
