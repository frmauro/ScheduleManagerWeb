import { Directive, ElementRef, forwardRef, inject } from '@angular/core';
import {
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ControlValueAccessor,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';

const BR_PREFIX = '+55';
const MAX_DIGITS = 11; // DDD + 9 dígitos
const MIN_DIGITS = 10; // DDD + 8 dígitos

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** `11999998888` → `(11) 99999-8888`; `1133334444` → `(11) 3333-4444`. */
export function formatBrPhone(digits: string): string {
  const d = digits.slice(0, MAX_DIGITS);
  if (d.length <= 2) {
    return d.length ? `(${d}` : '';
  }
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const splitAt = rest.length > 8 ? 5 : 4;
  if (rest.length <= splitAt) {
    return `(${ddd}) ${rest}`;
  }
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
}

/**
 * Máscara brasileira de telefone (R13): o usuário vê `(11) 99999-8888`, e o modelo guarda
 * E.164 `+5511999998888`, como exige a API. Números estrangeiros já salvos são exibidos como estão.
 */
@Directive({
  selector: 'input[smPhoneBr]',
  standalone: true,
  host: {
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel-national',
    '(input)': 'onInput()',
    '(blur)': 'onTouched()',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneBrDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => PhoneBrDirective), multi: true },
  ],
})
export class PhoneBrDirective implements ControlValueAccessor, Validator {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  private incomplete = false;

  writeValue(value: unknown): void {
    const text = typeof value === 'string' ? value : '';
    this.incomplete = false;
    if (text.startsWith(BR_PREFIX)) {
      this.input.value = formatBrPhone(text.slice(BR_PREFIX.length));
    } else {
      this.input.value = text;
    }
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

  validate(): ValidationErrors | null {
    return this.incomplete ? { phone: true } : null;
  }

  protected onInput(): void {
    const raw = this.input.value;
    let digits = onlyDigits(raw);
    // Quem cola "+55 11 9…" já traz o código do país.
    if (raw.trim().startsWith('+55') && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, MAX_DIGITS);
    this.input.value = formatBrPhone(digits);
    this.incomplete = digits.length > 0 && digits.length < MIN_DIGITS;
    this.onChange(digits ? `${BR_PREFIX}${digits}` : '');
  }
}
