import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

const CEP_DIGITS = 8;

export function formatCep(digits: string): string {
  const d = digits.slice(0, CEP_DIGITS);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Máscara de CEP (R13): exibe `00000-000` e o modelo guarda `00000000`, como exige a API. */
@Directive({
  selector: 'input[smCep]',
  standalone: true,
  host: {
    inputmode: 'numeric',
    autocomplete: 'postal-code',
    maxlength: '9',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CepDirective), multi: true },
  ],
})
export class CepDirective implements ControlValueAccessor {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    this.input.value = formatCep(typeof value === 'string' ? value.replace(/\D/g, '') : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.input.disabled = disabled;
  }

  protected onInput(): void {
    const digits = this.input.value.replace(/\D/g, '').slice(0, CEP_DIGITS);
    this.input.value = formatCep(digits);
    this.onChange(digits);
  }
}
