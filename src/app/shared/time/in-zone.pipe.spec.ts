import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { InZonePipe } from './in-zone.pipe';

describe('InZonePipe', () => {
  const pipe = new InZonePipe();

  it('formata no fuso informado', () => {
    expect(pipe.transform('2026-12-01T12:30:00-04:00', 'America/Sao_Paulo')).toBe(
      '01/12/2026 13:30',
    );
    expect(pipe.transform('2026-12-01T12:30:00-04:00', 'America/Manaus', 'time')).toBe('12:30');
  });

  it('valor vazio vira string vazia', () => {
    expect(pipe.transform(null, 'America/Sao_Paulo')).toBe('');
  });
});

describe('preço em BRL com o CurrencyPipe nativo (R12)', () => {
  it('formata R$ 50,00 em pt-BR', () => {
    registerLocaleData(localePt);
    const currency = new CurrencyPipe('pt-BR', 'BRL');
    expect(currency.transform(50)?.replace(/\s/g, ' ')).toBe('R$ 50,00');
    expect(currency.transform(99999.99)?.replace(/\s/g, ' ')).toBe('R$ 99.999,99');
  });
});
