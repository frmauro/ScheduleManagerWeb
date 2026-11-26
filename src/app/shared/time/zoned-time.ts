/**
 * Fusos horários só com `Intl` (research R7). Funções puras:
 * - exibição no fuso do prestador (FR-003);
 * - `from`/`to` com offset explícito para os filtros da API;
 * - datas locais (`yyyy-MM-dd`) do calendário.
 * O `startAt` de um slot **nunca** passa por aqui para ser reenviado (FR-026).
 */
import { DAY_OF_WEEK_VALUES, type DayOfWeek } from '../../core/models/enums';
import type { Instant, LocalDate } from '../../core/models/api-models';
import { MS_PER_DAY, MS_PER_MINUTE } from '../../core/config/app.constants';
import { TIME_ZONE_OPTIONS } from '../../core/config/time-zones';

export type FormatMode = 'datetime' | 'date' | 'time';

interface ZonedParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const result: ZonedParts = { year: '', month: '', day: '', hour: '', minute: '', second: '' };
  for (const part of partsFormatter(timeZone).formatToParts(ms)) {
    if (part.type in result) {
      result[part.type as keyof ZonedParts] = part.value;
    }
  }
  return result;
}

function toMs(value: Instant | number | Date): number {
  return typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Date.parse(value)
      : value.getTime();
}

/** `dd/MM/yyyy HH:mm` (ou só data/hora) no fuso indicado (FR-002, FR-003). */
export function formatInZone(
  instant: Instant | number | Date,
  timeZone: string,
  mode: FormatMode = 'datetime',
): string {
  const p = zonedParts(toMs(instant), timeZone);
  const date = `${p.day}/${p.month}/${p.year}`;
  const time = `${p.hour}:${p.minute}`;
  return mode === 'date' ? date : mode === 'time' ? time : `${date} ${time}`;
}

/** Offset do fuso em minutos no instante dado (ex.: `-180` para `-03:00`). */
export function offsetMinutes(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MS_PER_MINUTE);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** `GMT-04:00` para o fuso no instante dado. */
export function zoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  return `GMT${formatOffset(offsetMinutes(at.getTime(), timeZone))}`;
}

function zoneCityName(timeZone: string): string {
  const featured = TIME_ZONE_OPTIONS.find((z) => z.featured && z.id === timeZone);
  if (featured) {
    return featured.label.replace(/\s*\(.*\)$/, '');
  }
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replaceAll('_', ' ');
}

/** Nome legível e offset (ex.: `Manaus (GMT-04:00)`), para a indicação de fuso. */
export function zoneLabel(timeZone: string, at: Date = new Date()): string {
  return `${zoneCityName(timeZone)} (${zoneOffsetLabel(timeZone, at)})`;
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** A indicação de fuso aparece quando o fuso do prestador difere do dispositivo (FR-003). */
export function isDifferentFromBrowser(timeZone: string): boolean {
  return timeZone !== browserTimeZone();
}

/** ISO 8601 com o offset do fuso: `yyyy-MM-ddTHH:mm:ss±HH:MM`. */
export function toZonedIso(ms: number, timeZone: string): Instant {
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${formatOffset(offsetMinutes(ms, timeZone))}`;
}

function parseLocalDate(date: LocalDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y ?? NaN, m: m ?? NaN, d: d ?? NaN };
}

/** Instante (ms) da meia-noite local de `date` no fuso (correto em mudanças de horário de verão). */
function zonedMidnightMs(date: LocalDate, timeZone: string): number {
  const { y, m, d } = parseLocalDate(date);
  const wallAsUtc = Date.UTC(y, m - 1, d);
  let ms = wallAsUtc - offsetMinutes(wallAsUtc, timeZone) * MS_PER_MINUTE;
  const corrected = wallAsUtc - offsetMinutes(ms, timeZone) * MS_PER_MINUTE;
  if (corrected !== ms) {
    ms = corrected;
  }
  return ms;
}

export interface InstantRange {
  from: Instant;
  /** Exclusivo. */
  to: Instant;
}

export function zonedDayRange(date: LocalDate, timeZone: string): InstantRange {
  return {
    from: toZonedIso(zonedMidnightMs(date, timeZone), timeZone),
    to: toZonedIso(zonedMidnightMs(addDays(date, 1), timeZone), timeZone),
  };
}

/** Semana de domingo a domingo que contém `date`. */
export function zonedWeekRange(date: LocalDate, timeZone: string): InstantRange {
  const start = startOfWeek(date);
  return {
    from: toZonedIso(zonedMidnightMs(start, timeZone), timeZone),
    to: toZonedIso(zonedMidnightMs(addDays(start, 7), timeZone), timeZone),
  };
}

export function startOfWeek(date: LocalDate): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, -weekday);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  return new Date(Date.UTC(y, m - 1, d) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function dayOfWeekOf(date: LocalDate): DayOfWeek {
  const { y, m, d } = parseLocalDate(date);
  return DAY_OF_WEEK_VALUES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? 'Sunday';
}

/** Data local (`yyyy-MM-dd`) de um instante no fuso. */
export function localDateOf(instant: Instant | number, timeZone: string): LocalDate {
  const p = zonedParts(toMs(instant), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hoje no fuso do prestador, para o calendário de reserva. */
export function todayInZone(timeZone: string, now: number = Date.now()): LocalDate {
  return localDateOf(now, timeZone);
}

/** Agora, em ISO com offset (ex.: `from` da aba "Próximos"). */
export function nowInstant(
  timeZone: string = browserTimeZone(),
  now: number = Date.now(),
): Instant {
  return toZonedIso(now, timeZone);
}

/** Diferença inteira em dias entre duas datas locais (`b − a`). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / MS_PER_DAY);
}
