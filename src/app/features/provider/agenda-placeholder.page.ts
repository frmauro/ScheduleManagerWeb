import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PROVIDER_MESSAGES } from '../../core/i18n/provider.messages';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

/** Placeholder de `/prestador/agenda` até a US5 (T114). */
@Component({
  selector: 'sm-agenda-placeholder-page',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl px-4 py-8">
      <h1>{{ text.title }}</h1>
      <div class="mt-6">
        <sm-empty-state [title]="text.title" [description]="text.description" />
      </div>
    </section>
  `,
})
export class AgendaPlaceholderPageComponent {
  protected readonly text = PROVIDER_MESSAGES.agendaPlaceholder;
}
