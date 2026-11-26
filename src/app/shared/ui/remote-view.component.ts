import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  input,
  output,
  TemplateRef,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { RemoteState } from '../state/remote-state';
import { EmptyStateComponent } from './empty-state.component';
import { ErrorStateComponent } from './error-state.component';
import { SkeletonComponent } from './skeleton.component';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';

/** Template do conteúdo pronto, tipado pelo estado: `<ng-template [smRemoteReady]="state()" let-value>`. */
@Directive({ selector: 'ng-template[smRemoteReady]', standalone: true })
export class RemoteReadyDirective<T> {
  readonly smRemoteReady = input.required<RemoteState<T>>();
  readonly template = inject<TemplateRef<{ $implicit: T }>>(TemplateRef);

  /** Assinatura exigida pelo compilador de templates para tipar `let-value`. */
  static ngTemplateContextGuard<T>(
    _dir: RemoteReadyDirective<T>,
    _ctx: unknown,
  ): _ctx is { $implicit: T } {
    return true;
  }
}

/**
 * Renderiza os 4 estados de dados remotos (FR-004): skeleton, vazio, erro com "Tentar
 * novamente" e o conteúdo pronto.
 */
@Component({
  selector: 'sm-remote-view',
  standalone: true,
  imports: [NgTemplateOutlet, SkeletonComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ('loading') {
        <sm-skeleton [rows]="skeletonRows()" />
      }
      @case ('empty') {
        <sm-empty-state [title]="emptyTitle()" [description]="emptyDescription()">
          <ng-content select="[smEmptyAction]" />
        </sm-empty-state>
      }
      @case ('error') {
        @if (errorOf(state()); as error) {
          <sm-error-state [error]="error" (retry)="retry.emit()" />
        }
      }
      @case ('ready') {
        @if (ready(); as tpl) {
          <ng-container
            *ngTemplateOutlet="tpl.template; context: { $implicit: valueOf(state()) }"
          />
        }
      }
    }
  `,
})
export class RemoteViewComponent<T> {
  readonly state = input.required<RemoteState<T>>();
  readonly emptyTitle = input<string>(COMMON_MESSAGES.states.empty);
  readonly emptyDescription = input<string>();
  readonly skeletonRows = input(3);
  readonly retry = output<void>();

  protected readonly ready = contentChild(RemoteReadyDirective<T>);

  protected errorOf(state: RemoteState<T>) {
    return state.status === 'error' ? state.error : null;
  }

  protected valueOf(state: RemoteState<T>): T | null {
    return state.status === 'ready' ? state.value : null;
  }
}
