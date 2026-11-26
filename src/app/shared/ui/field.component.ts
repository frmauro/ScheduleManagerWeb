import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { validationMessage } from '../forms/validation-messages';

let nextFieldId = 0;

/**
 * Campo de formulário acessível (FR-006, FR-011): rótulo, dica e erro (do cliente ou do
 * servidor) ligados ao controle por `aria-describedby`/`aria-invalid`. O controle projetado
 * deve usar a diretiva `smFieldControl`.
 *
 * ```html
 * <sm-field label="E-mail" hint="Usaremos para avisos.">
 *   <input smFieldControl class="sm-input" type="email" formControlName="email" />
 * </sm-field>
 * ```
 */
@Component({
  selector: 'sm-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="sm-label" [attr.for]="controlId">
      {{ label() }}
      @if (optional()) {
        <span class="font-normal text-gray-600">(opcional)</span>
      }
    </label>
    <ng-content />
    @if (hint()) {
      <p class="sm-hint" [id]="hintId">{{ hint() }}</p>
    }
    @if (errorMessage(); as message) {
      <p class="sm-error" [id]="errorId">{{ message }}</p>
    }
  `,
})
export class FieldComponent {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  readonly optional = input(false);
  /** Mensagem específica para erro de `pattern` (ex.: UF, CEP). */
  readonly patternMessage = input<string>();

  readonly controlId = `sm-field-${nextFieldId++}`;
  readonly hintId = `${this.controlId}-hint`;
  readonly errorId = `${this.controlId}-error`;

  private readonly control = signal<NgControl | null>(null);
  /** Incrementado a cada evento do controle, para recalcular o estado (zoneless). */
  private readonly version = signal(0);

  readonly errorMessage = computed(() => {
    this.version();
    const ctrl = this.control()?.control;
    if (!ctrl || !ctrl.invalid || !ctrl.touched) {
      return null;
    }
    return validationMessage(ctrl.errors, this.patternMessage());
  });

  readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : null, this.errorMessage() ? this.errorId : null];
    const value = ids.filter((id): id is string => id !== null).join(' ');
    return value || null;
  });

  readonly invalid = computed(() => (this.errorMessage() ? 'true' : null));

  /** Chamado pela diretiva `smFieldControl`. */
  register(control: NgControl, destroyRef: DestroyRef): void {
    this.control.set(control);
    const subscription = control.control?.events.subscribe(() => this.version.update((v) => v + 1));
    destroyRef.onDestroy(() => subscription?.unsubscribe());
  }
}

/** Liga o controle projetado ao `sm-field` (id, descrição e estado de erro). */
@Directive({
  selector: '[smFieldControl]',
  standalone: true,
  host: {
    '[id]': 'field.controlId',
    '[attr.aria-describedby]': 'field.describedBy()',
    '[attr.aria-invalid]': 'field.invalid()',
  },
})
export class FieldControlDirective implements OnInit {
  protected readonly field = inject(FieldComponent);
  private readonly ngControl = inject(NgControl, { self: true });
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // `formControlName`/`formControl` criam o controle em ngOnChanges, antes deste ngOnInit.
    this.field.register(this.ngControl, this.destroyRef);
  }
}
