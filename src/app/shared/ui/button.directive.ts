import { Directive, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * Botão do design system sobre o `<button>` nativo (mantém a semântica e o envio de formulário).
 * `loading` desabilita o botão e anuncia `aria-busy` durante a requisição (FR-005).
 */
@Directive({
  selector: 'button[smButton], a[smButton]',
  standalone: true,
  host: {
    class: 'sm-btn',
    '[class.sm-btn--primary]': "variant() === 'primary'",
    '[class.sm-btn--secondary]': "variant() === 'secondary'",
    '[class.sm-btn--danger]': "variant() === 'danger'",
    '[class.sm-btn--ghost]': "variant() === 'ghost'",
    '[class.sm-btn--loading]': 'loading()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[attr.disabled]': 'loading() || disabled() ? "" : null',
  },
})
export class ButtonDirective {
  /** `<button smButton>` usa `primary`; `<button smButton="secondary">` escolhe a variante. */
  readonly variant = input<ButtonVariant, ButtonVariant | ''>('primary', {
    alias: 'smButton',
    transform: (value) => value || 'primary',
  });
  readonly loading = input(false);
  readonly disabled = input(false);
}
