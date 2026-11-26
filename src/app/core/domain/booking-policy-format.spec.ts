import { formatDuration, joinMinutes, splitMinutes } from './booking-policy-format';

describe('formatDuration (FR-039: unidades amigáveis)', () => {
  it.each([
    [0, 'sem antecedência'],
    [1, '1 min'],
    [45, '45 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [120, '2 h'],
    [1440, '1 dia'],
    [1500, '1 dia 1 h'],
    [2880, '2 dias'],
    [10080, '7 dias'],
  ])('%i → %s', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe('splitMinutes / joinMinutes', () => {
  it('decompõe e recompõe em dias/horas/minutos', () => {
    expect(splitMinutes(1590)).toEqual({ days: 1, hours: 2, minutes: 30 });
    expect(joinMinutes({ days: 1, hours: 2, minutes: 30 })).toBe(1590);
    expect(joinMinutes(splitMinutes(10080))).toBe(10080);
  });
});
