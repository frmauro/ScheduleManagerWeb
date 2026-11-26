import {
  addDays,
  dayOfWeekOf,
  formatInZone,
  isDifferentFromBrowser,
  localDateOf,
  nowInstant,
  todayInZone,
  zonedDayRange,
  zonedWeekRange,
  zoneLabel,
  zoneOffsetLabel,
} from './zoned-time';

describe('formatInZone', () => {
  const instant = '2026-12-01T12:30:00-04:00';

  it('exibe no fuso do prestador em dd/MM/yyyy HH:mm', () => {
    expect(formatInZone(instant, 'America/Manaus')).toBe('01/12/2026 12:30');
    expect(formatInZone(instant, 'America/Sao_Paulo')).toBe('01/12/2026 13:30');
  });

  it('modos date e time', () => {
    expect(formatInZone(instant, 'America/Sao_Paulo', 'date')).toBe('01/12/2026');
    expect(formatInZone(instant, 'America/Sao_Paulo', 'time')).toBe('13:30');
  });

  it('meia-noite é 00:00 (não 24:00)', () => {
    expect(formatInZone('2026-12-02T03:00:00Z', 'America/Sao_Paulo', 'time')).toBe('00:00');
  });

  it('virada de dia: 23:30 em um fuso é o dia seguinte em outro', () => {
    const lateInManaus = '2026-12-01T23:30:00-04:00';
    expect(formatInZone(lateInManaus, 'America/Manaus')).toBe('01/12/2026 23:30');
    expect(formatInZone(lateInManaus, 'America/Sao_Paulo')).toBe('02/12/2026 00:30');
    expect(localDateOf(lateInManaus, 'America/Manaus')).toBe('2026-12-01');
    expect(localDateOf(lateInManaus, 'America/Sao_Paulo')).toBe('2026-12-02');
  });
});

describe('zoneLabel e offsets', () => {
  it('nome do fuso com o offset', () => {
    const label = zoneLabel('America/Manaus', new Date('2026-12-01T12:00:00Z'));
    expect(label).toContain('Manaus');
    expect(label).toContain('GMT-04:00');
  });

  it('fuso brasileiro com nome amigável (Bahia → Salvador)', () => {
    expect(zoneLabel('America/Bahia', new Date('2026-12-01T12:00:00Z'))).toContain('Salvador');
  });

  it('offset de meia hora', () => {
    expect(zoneOffsetLabel('Asia/Kolkata', new Date('2026-12-01T12:00:00Z'))).toBe('GMT+05:30');
  });

  it('isDifferentFromBrowser compara com o fuso do navegador', () => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(isDifferentFromBrowser(browser)).toBe(false);
    const other = browser === 'America/Manaus' ? 'Asia/Tokyo' : 'America/Manaus';
    expect(isDifferentFromBrowser(other)).toBe(true);
  });
});

describe('períodos com offset (from/to)', () => {
  it('zonedDayRange: meia-noite local até a meia-noite seguinte (to exclusivo)', () => {
    expect(zonedDayRange('2026-12-01', 'America/Sao_Paulo')).toEqual({
      from: '2026-12-01T00:00:00-03:00',
      to: '2026-12-02T00:00:00-03:00',
    });
    expect(zonedDayRange('2026-12-01', 'Asia/Kolkata')).toEqual({
      from: '2026-12-01T00:00:00+05:30',
      to: '2026-12-02T00:00:00+05:30',
    });
  });

  it('zonedDayRange respeita a mudança de horário de verão', () => {
    expect(zonedDayRange('2026-03-08', 'America/New_York')).toEqual({
      from: '2026-03-08T00:00:00-05:00',
      to: '2026-03-09T00:00:00-04:00',
    });
  });

  it('zonedWeekRange vai de domingo a domingo', () => {
    // 2026-12-02 é quarta-feira.
    expect(zonedWeekRange('2026-12-02', 'America/Sao_Paulo')).toEqual({
      from: '2026-11-29T00:00:00-03:00',
      to: '2026-12-06T00:00:00-03:00',
    });
    // Um domingo começa a própria semana.
    expect(zonedWeekRange('2026-11-29', 'America/Sao_Paulo').from).toBe(
      '2026-11-29T00:00:00-03:00',
    );
  });
});

describe('datas locais', () => {
  it('todayInZone usa o dia do fuso, não o do navegador', () => {
    const now = new Date('2026-12-02T02:30:00Z').getTime(); // 23:30 de 01/12 em São Paulo
    expect(todayInZone('America/Sao_Paulo', now)).toBe('2026-12-01');
    expect(todayInZone('Asia/Tokyo', now)).toBe('2026-12-02');
  });

  it('addDays atravessa meses e anos', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-11-29', 7)).toBe('2026-12-06');
  });

  it('dayOfWeekOf', () => {
    expect(dayOfWeekOf('2026-12-02')).toBe('Wednesday');
    expect(dayOfWeekOf('2026-11-29')).toBe('Sunday');
  });

  it('nowInstant gera ISO com offset do fuso', () => {
    const now = new Date('2026-12-01T15:00:00Z').getTime();
    expect(nowInstant('America/Sao_Paulo', now)).toBe('2026-12-01T12:00:00-03:00');
    expect(nowInstant('UTC', now)).toBe('2026-12-01T15:00:00+00:00');
  });
});
