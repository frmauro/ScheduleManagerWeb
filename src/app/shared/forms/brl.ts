import type { ValidatorFn } from '@angular/forms';

const MAX_PRICE = 99_999.99;
/** `50`, `50,5`, `50,00`, `1.234,56` ou `1234.56`. */
const BRL_INPUT = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$|^\d+\.\d{1,2}$/;

/** Texto digitado em reais → número, ou `null` se inválido. */
export function parseBrl(text: string): number | null {
  const value = text.trim().replace(/^R\$\s*/, '');
  if (!BRL_INPUT.test(value)) {
    return null;
  }
  const normalized = value.includes(',') ? value.replaceAll('.', '').replace(',', '.') : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

/** `50` → `50,00` (valor inicial do campo). */
export function formatBrlInput(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

/** Preço de 0,00 a 99.999,99 com até 2 casas (FR-040). */
export const brlAmount: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const amount = parseBrl(value);
  return amount !== null && amount >= 0 && amount <= MAX_PRICE ? null : { brlAmount: true };
};
