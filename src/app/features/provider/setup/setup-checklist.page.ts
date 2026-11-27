import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCircle, LucideCircleCheck, LucideDynamicIcon } from '@lucide/angular';
import { APP_PATHS } from '../../../core/config/app-paths';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import {
  RemoteReadyDirective,
  RemoteViewComponent,
} from '../../../shared/ui/remote-view.component';
import { ProviderSetupStore } from './provider-setup.store';

interface ChecklistStep {
  readonly id: 'services' | 'schedule' | 'policy';
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly path: string;
  readonly done: boolean;
  readonly optional: boolean;
}

/**
 * Primeiros passos (`/prestador/primeiros-passos`, FR-037): serviço → expediente → política
 * (opcional), com progresso. Concluído, leva à agenda.
 */
@Component({
  selector: 'sm-setup-checklist-page',
  standalone: true,
  imports: [
    RouterLink,
    LucideDynamicIcon,
    ButtonDirective,
    RemoteViewComponent,
    RemoteReadyDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      <div class="mt-6">
        <sm-remote-view [state]="store.state()" [skeletonRows]="3" (retry)="store.load()">
          <ng-template [smRemoteReady]="store.state()">
            @if (store.complete()) {
              <div class="sm-card mb-4" role="status" data-testid="setup-complete">
                <h2 class="text-lg">{{ text.completeTitle }}</h2>
                <p class="mt-1 text-gray-700">{{ text.completeDescription }}</p>
                <a class="mt-3" smButton="primary" [routerLink]="agendaPath">{{
                  text.goToAgenda
                }}</a>
              </div>
            } @else {
              <p class="mb-3 font-medium" data-testid="setup-progress">
                {{ text.progress(store.doneCount(), 2) }}
              </p>
            }
            <ol class="flex flex-col gap-3" [attr.aria-label]="text.stepsLabel">
              @for (step of steps(); track step.id; let i = $index) {
                <li
                  class="sm-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="flex gap-3">
                    <svg
                      [lucideIcon]="step.done ? doneIcon : pendingIcon"
                      [size]="22"
                      [class.text-tone-success-fg]="step.done"
                      aria-hidden="true"
                    ></svg>
                    <div>
                      <h2 class="text-base font-semibold">{{ i + 1 }}. {{ step.title }}</h2>
                      <p class="text-sm text-gray-700">{{ step.description }}</p>
                      <p class="mt-1 text-sm font-medium" [attr.data-testid]="'step-' + step.id">
                        {{ step.done ? text.done : step.optional ? text.optional : text.pending }}
                      </p>
                    </div>
                  </div>
                  <a [smButton]="step.done ? 'secondary' : 'primary'" [routerLink]="step.path">
                    {{ step.action }}
                  </a>
                </li>
              }
            </ol>
          </ng-template>
        </sm-remote-view>
      </div>
    </section>
  `,
})
export class SetupChecklistPageComponent implements OnInit {
  protected readonly store = inject(ProviderSetupStore);
  protected readonly text = PROVIDER_MESSAGES.setup;
  protected readonly agendaPath = APP_PATHS.providerArea.agenda;
  protected readonly doneIcon = LucideCircleCheck;
  protected readonly pendingIcon = LucideCircle;

  protected readonly steps = computed<readonly ChecklistStep[]>(() => {
    const c = this.store.checklist();
    return [
      {
        id: 'services',
        ...this.text.services,
        path: APP_PATHS.providerArea.services,
        done: c?.hasActiveService ?? false,
        optional: false,
      },
      {
        id: 'schedule',
        ...this.text.schedule,
        path: APP_PATHS.providerArea.schedule,
        done: c?.hasWorkingHours ?? false,
        optional: false,
      },
      {
        id: 'policy',
        ...this.text.policy,
        path: APP_PATHS.providerArea.policy,
        done: this.store.policyReviewedHint(),
        optional: true,
      },
    ];
  });

  ngOnInit(): void {
    this.store.load();
  }
}
