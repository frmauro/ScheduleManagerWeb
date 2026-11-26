const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

export function splitMinutes(total: number): DurationParts {
  const safe = Math.max(0, Math.floor(total));
  return {
    days: Math.floor(safe / MINUTES_PER_DAY),
    hours: Math.floor((safe % MINUTES_PER_DAY) / MINUTES_PER_HOUR),
    minutes: safe % MINUTES_PER_HOUR,
  };
}

export function joinMinutes(parts: DurationParts): number {
  return parts.days * MINUTES_PER_DAY + parts.hours * MINUTES_PER_HOUR + parts.minutes;
}

/** Minutos em unidades amigáveis para a política de reservas (FR-039): `90` → `1 h 30 min`. */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return 'sem antecedência';
  }
  const { days, hours, minutes } = splitMinutes(totalMinutes);
  const parts: string[] = [];
  if (days > 0) {
    parts.push(days === 1 ? '1 dia' : `${days} dias`);
  }
  if (hours > 0) {
    parts.push(`${hours} h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }
  return parts.join(' ');
}
