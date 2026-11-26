import { FormArray, FormControl, FormGroup, type ValidatorFn } from '@angular/forms';
import {
  exceptionPeriod,
  multipleOf,
  nonOverlappingIntervals,
  periodRange,
  SmValidators,
  timeRange,
} from './validators';

function errorsOf(validators: ValidatorFn[], value: unknown) {
  return new FormControl(value, validators).errors;
}
const valid = (validators: ValidatorFn[], value: unknown) => errorsOf(validators, value) === null;

describe('SmValidators (espelham o contrato da API)', () => {
  it('nome 2–120', () => {
    expect(valid(SmValidators.name, 'A')).toBe(false);
    expect(valid(SmValidators.name, 'Ana')).toBe(true);
    expect(valid(SmValidators.name, 'a'.repeat(120))).toBe(true);
    expect(valid(SmValidators.name, 'a'.repeat(121))).toBe(false);
    expect(valid(SmValidators.name, '')).toBe(false);
  });

  it('e-mail válido ≤ 254', () => {
    expect(valid(SmValidators.email, 'ana@exemplo.com')).toBe(true);
    expect(valid(SmValidators.email, 'ana@')).toBe(false);
    expect(valid(SmValidators.email, `${'a'.repeat(250)}@x.com`)).toBe(false);
  });

  it('senha 8–128 com ao menos uma letra e um dígito', () => {
    expect(valid(SmValidators.password, 'abcdefg1')).toBe(true);
    expect(valid(SmValidators.password, 'abcdefgh')).toBe(false);
    expect(valid(SmValidators.password, '12345678')).toBe(false);
    expect(valid(SmValidators.password, 'abc1')).toBe(false);
    expect(valid(SmValidators.password, `a1${'x'.repeat(127)}`)).toBe(false);
  });

  it('telefone E.164 ^\\+[1-9]\\d{7,14}$', () => {
    expect(valid(SmValidators.phone, '+5511999998888')).toBe(true);
    expect(valid(SmValidators.phone, '+551199999')).toBe(true);
    expect(valid(SmValidators.phone, '5511999998888')).toBe(false);
    expect(valid(SmValidators.phone, '+0511999998888')).toBe(false);
    expect(valid(SmValidators.phone, '+55119999988881234')).toBe(false);
  });

  it('endereço: tamanhos, UF e CEP', () => {
    expect(valid(SmValidators.street, 'a'.repeat(200))).toBe(true);
    expect(valid(SmValidators.street, 'a'.repeat(201))).toBe(false);
    expect(valid(SmValidators.number, 'a'.repeat(21))).toBe(false);
    expect(valid(SmValidators.complement, '')).toBe(true);
    expect(valid(SmValidators.complement, 'a'.repeat(101))).toBe(false);
    expect(valid(SmValidators.district, 'a'.repeat(101))).toBe(false);
    expect(valid(SmValidators.city, 'a'.repeat(101))).toBe(false);
    expect(valid(SmValidators.state, 'SP')).toBe(true);
    expect(valid(SmValidators.state, 'sp')).toBe(false);
    expect(valid(SmValidators.state, 'SPX')).toBe(false);
    expect(valid(SmValidators.postalCode, '01001000')).toBe(true);
    expect(valid(SmValidators.postalCode, '01001-000')).toBe(false);
    expect(valid(SmValidators.postalCode, '123')).toBe(false);
  });

  it('displayName 2–120 e description ≤ 2000', () => {
    expect(valid(SmValidators.displayName, 'B')).toBe(false);
    expect(valid(SmValidators.providerDescription, 'a'.repeat(2000))).toBe(true);
    expect(valid(SmValidators.providerDescription, 'a'.repeat(2001))).toBe(false);
  });

  it('busca q ≤ 100', () => {
    expect(valid(SmValidators.searchText, 'a'.repeat(100))).toBe(true);
    expect(valid(SmValidators.searchText, 'a'.repeat(101))).toBe(false);
  });

  it('múltiplo de 5', () => {
    expect(valid([multipleOf(5)], 15)).toBe(true);
    expect(valid([multipleOf(5)], 12)).toBe(false);
    expect(valid([multipleOf(5)], null)).toBe(true);
  });

  it('LocalTime ^([01]\\d|2[0-3]):[0-5]\\d$', () => {
    expect(valid(SmValidators.localTime, '09:00')).toBe(true);
    expect(valid(SmValidators.localTime, '23:59')).toBe(true);
    expect(valid(SmValidators.localTime, '24:00')).toBe(false);
    expect(valid(SmValidators.localTime, '9:00')).toBe(false);
  });

  it('preço 0–99999.99 com 2 casas', () => {
    expect(valid(SmValidators.price, 0)).toBe(true);
    expect(valid(SmValidators.price, 99999.99)).toBe(true);
    expect(valid(SmValidators.price, 100000)).toBe(false);
    expect(valid(SmValidators.price, 10.123)).toBe(false);
    expect(valid(SmValidators.price, -1)).toBe(false);
  });
});

describe('timeRange (start < end)', () => {
  const group = (start: string, end: string) =>
    new FormGroup(
      { start: new FormControl(start), end: new FormControl(end) },
      { validators: timeRange('start', 'end') },
    );

  it('exige início antes do fim', () => {
    expect(group('09:00', '12:00').errors).toBeNull();
    expect(group('12:00', '12:00').errors).toEqual({ timeRange: true });
    expect(group('13:00', '09:00').errors).toEqual({ timeRange: true });
  });
});

describe('nonOverlappingIntervals', () => {
  const day = (...pairs: [string, string][]) =>
    new FormArray(
      pairs.map(
        ([start, end]) =>
          new FormGroup({ start: new FormControl(start), end: new FormControl(end) }),
      ),
      { validators: nonOverlappingIntervals() },
    );

  it('aceita faixas sem sobreposição e faixas encostadas', () => {
    expect(day(['09:00', '12:00'], ['13:00', '18:00']).errors).toBeNull();
    expect(day(['09:00', '12:00'], ['12:00', '18:00']).errors).toBeNull();
  });

  it('detecta sobreposição independentemente da ordem e indica as faixas', () => {
    const arr = day(['11:00', '14:00'], ['09:00', '12:00']);
    expect(arr.errors).toEqual({ overlap: { indexes: [0, 1] } });
  });
});

describe('periodRange (to > from, ≤ 366 dias)', () => {
  const group = (from: string | null, to: string | null) =>
    new FormGroup(
      { from: new FormControl(from), to: new FormControl(to) },
      { validators: periodRange('from', 'to', 366) },
    );

  it('aceita períodos válidos ou incompletos', () => {
    expect(group('2026-01-01', '2026-12-31').errors).toBeNull();
    expect(group('2026-01-01', null).errors).toBeNull();
  });

  it('rejeita fim não posterior ao início', () => {
    expect(group('2026-02-01', '2026-02-01').errors).toEqual({ periodOrder: true });
  });

  it('rejeita período maior que 366 dias', () => {
    expect(group('2026-01-01', '2027-01-03').errors).toEqual({ periodTooLong: { max: 366 } });
  });
});

describe('exceptionPeriod (endDate ≥ startDate, endDate − startDate + 1 ≤ 366)', () => {
  const group = (start: string, end: string) =>
    new FormGroup(
      { startDate: new FormControl(start), endDate: new FormControl(end) },
      { validators: exceptionPeriod('startDate', 'endDate', 366) },
    );

  it('aceita o mesmo dia e até 366 dias inclusive', () => {
    expect(group('2026-12-01', '2026-12-01').errors).toBeNull();
    expect(group('2026-01-01', '2027-01-01').errors).toBeNull();
  });

  it('rejeita fim antes do início e mais de 366 dias', () => {
    expect(group('2026-12-02', '2026-12-01').errors).toEqual({ periodOrder: true });
    expect(group('2026-01-01', '2027-01-02').errors).toEqual({ periodTooLong: { max: 366 } });
  });
});
