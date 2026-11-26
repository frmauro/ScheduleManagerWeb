import {
  Validators,
  type AbstractControl,
  type FormArray,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

/**
 * Validadores que espelham o contrato da API (FR-007, data-model §2). A API continua soberana:
 * o objetivo é dar retorno imediato, sem substituir a validação do servidor.
 */

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const STATE = /^[A-Z]{2}$/;
const POSTAL_CODE = /^\d{8}$/;
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;
const MAX_PRICE = 99_999.99;
const MS_PER_DAY = 86_400_000;

/** Senha com ao menos uma letra e um dígito. */
export const passwordComposition: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  return HAS_LETTER.test(value) && HAS_DIGIT.test(value) ? null : { passwordComposition: true };
};

export function multipleOf(step: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return typeof value === 'number' && Number.isInteger(value / step)
      ? null
      : { multipleOf: { step } };
  };
}

/** No máximo 2 casas decimais. */
export const twoDecimals: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'number') {
    return null;
  }
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6 ? null : { decimals: { max: 2 } };
};

export const SmValidators = {
  name: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
  email: [Validators.required, Validators.email, Validators.maxLength(254)],
  optionalEmail: [Validators.email, Validators.maxLength(254)],
  password: [
    Validators.required,
    Validators.minLength(8),
    Validators.maxLength(128),
    passwordComposition,
  ],
  phone: [Validators.required, Validators.pattern(E164)],
  street: [Validators.required, Validators.maxLength(200)],
  number: [Validators.required, Validators.maxLength(20)],
  complement: [Validators.maxLength(100)],
  district: [Validators.required, Validators.maxLength(100)],
  city: [Validators.required, Validators.maxLength(100)],
  state: [Validators.required, Validators.pattern(STATE)],
  postalCode: [Validators.required, Validators.pattern(POSTAL_CODE)],
  displayName: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
  providerDescription: [Validators.maxLength(2000)],
  searchText: [Validators.maxLength(100)],
  localTime: [Validators.required, Validators.pattern(LOCAL_TIME)],
  price: [Validators.required, Validators.min(0), Validators.max(MAX_PRICE), twoDecimals],
} satisfies Record<string, ValidatorFn[]>;

function controlValue(group: AbstractControl, key: string): unknown {
  return group.get(key)?.value;
}

/** Faixa de horário: `start < end` (strings `HH:mm` comparáveis lexicograficamente). */
export function timeRange(startKey: string, endKey: string): ValidatorFn {
  return (group): ValidationErrors | null => {
    const start = controlValue(group, startKey);
    const end = controlValue(group, endKey);
    if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) {
      return null;
    }
    return start < end ? null : { timeRange: true };
  };
}

/**
 * Faixas de um dia sem sobreposição: ordena por `start` e exige `end[i] ≤ start[i+1]`.
 * Faixas encostadas são válidas (a lacuna entre elas é o intervalo, ex.: almoço).
 * O erro indica as posições originais das faixas em conflito.
 */
export function nonOverlappingIntervals(startKey = 'start', endKey = 'end'): ValidatorFn {
  return (control): ValidationErrors | null => {
    const array = control as FormArray;
    const intervals = array.controls
      .map((c, index) => ({
        index,
        start: controlValue(c, startKey),
        end: controlValue(c, endKey),
      }))
      .filter(
        (i): i is { index: number; start: string; end: string } =>
          typeof i.start === 'string' && typeof i.end === 'string' && !!i.start && !!i.end,
      )
      .sort((a, b) => a.start.localeCompare(b.start));
    const conflicting = new Set<number>();
    for (let i = 0; i + 1 < intervals.length; i++) {
      const current = intervals[i];
      const next = intervals[i + 1];
      if (current && next && current.end > next.start) {
        conflicting.add(current.index);
        conflicting.add(next.index);
      }
    }
    return conflicting.size === 0
      ? null
      : { overlap: { indexes: [...conflicting].sort((a, b) => a - b) } };
  };
}

function dateMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const ms = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(ms) ? null : ms;
}

/** Filtro de período: `to > from` e no máximo `maxDays` dias. */
export function periodRange(fromKey: string, toKey: string, maxDays: number): ValidatorFn {
  return (group): ValidationErrors | null => {
    const from = dateMs(controlValue(group, fromKey));
    const to = dateMs(controlValue(group, toKey));
    if (from === null || to === null) {
      return null;
    }
    if (to <= from) {
      return { periodOrder: true };
    }
    return (to - from) / MS_PER_DAY > maxDays ? { periodTooLong: { max: maxDays } } : null;
  };
}

/** Exceção de agenda: `endDate ≥ startDate` e `endDate − startDate + 1 ≤ maxDays`. */
export function exceptionPeriod(startKey: string, endKey: string, maxDays: number): ValidatorFn {
  return (group): ValidationErrors | null => {
    const start = dateMs(controlValue(group, startKey));
    const end = dateMs(controlValue(group, endKey));
    if (start === null || end === null) {
      return null;
    }
    if (end < start) {
      return { periodOrder: true };
    }
    return Math.round((end - start) / MS_PER_DAY) + 1 > maxDays
      ? { periodTooLong: { max: maxDays } }
      : null;
  };
}
