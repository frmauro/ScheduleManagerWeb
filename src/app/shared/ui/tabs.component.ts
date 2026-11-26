import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';

export interface TabItem<T extends string = string> {
  readonly id: T;
  readonly label: string;
}

let nextTabsId = 0;

/**
 * Abas no padrão ARIA (tablist/tab) com setas, Home e End (FR-011).
 * O painel fica com quem usa: `<div role="tabpanel" [id]="tabs.panelId" [attr.aria-labelledby]="tabs.tabId(active)">`.
 */
@Component({
  selector: 'sm-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'smTabs',
  template: `
    <div role="tablist" class="flex gap-1 border-b border-gray-200" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          class="min-h-[44px] border-b-2 px-4 py-2 text-sm font-medium"
          [class.border-brand]="tab.id === active()"
          [class.text-brand]="tab.id === active()"
          [class.border-transparent]="tab.id !== active()"
          [class.text-gray-700]="tab.id !== active()"
          [id]="tabId(tab.id)"
          [attr.aria-selected]="tab.id === active()"
          [attr.aria-controls]="panelId"
          [attr.tabindex]="tab.id === active() ? 0 : -1"
          (click)="select(tab.id)"
          (keydown)="onKeydown($event)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class TabsComponent {
  readonly tabs = input.required<readonly TabItem[]>();
  readonly active = model.required<string>();
  readonly ariaLabel = input<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly baseId = `sm-tabs-${nextTabsId++}`;
  readonly panelId = `${this.baseId}-panel`;

  tabId(id: string): string {
    return `${this.baseId}-tab-${id}`;
  }

  protected select(id: string): void {
    this.active.set(id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const index = tabs.findIndex((t) => t.id === this.active());
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    const next = target === null ? undefined : tabs[target];
    if (!next) {
      return;
    }
    event.preventDefault();
    this.active.set(next.id);
    this.host.nativeElement
      .querySelector<HTMLElement>(`#${CSS.escape(this.tabId(next.id))}`)
      ?.focus();
  }
}
