import { FormControl } from '@angular/forms';
import { brlAmount, formatBrlInput, parseBrl } from './brl';

describe('BRL', () => {
  it('interpreta os formatos brasileiros', () => {
    expect(parseBrl('50')).toBe(50);
    expect(parseBrl('50,5')).toBe(50.5);
    expect(parseBrl('R$ 1.234,56')).toBe(1234.56);
    expect(parseBrl('1234.56')).toBe(1234.56);
    expect(parseBrl('0,00')).toBe(0);
  });

  it('recusa texto inválido e mais de 2 casas', () => {
    expect(parseBrl('abc')).toBeNull();
    expect(parseBrl('10,123')).toBeNull();
    expect(parseBrl('-5')).toBeNull();
  });

  it('valida o limite de 99.999,99', () => {
    expect(brlAmount(new FormControl('99.999,99'))).toBeNull();
    expect(brlAmount(new FormControl('100.000,00'))).toEqual({ brlAmount: true });
    expect(brlAmount(new FormControl(''))).toBeNull();
  });

  it('formata o valor inicial', () => {
    expect(formatBrlInput(50)).toBe('50,00');
    expect(formatBrlInput(12.5)).toBe('12,50');
  });
});
