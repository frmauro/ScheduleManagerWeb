import { Pipe, type PipeTransform } from '@angular/core';
import type { Instant } from '../../core/models/api-models';
import { formatInZone, type FormatMode } from './zoned-time';

/**
 * `{{ appointment.startAt | inZone: appointment.provider.timeZoneId }}` → `01/12/2026 09:00`.
 * O `DatePipe` nativo não aceita fusos IANA, apenas offsets fixos; por isso este pipe existe.
 */
@Pipe({ name: 'inZone', standalone: true })
export class InZonePipe implements PipeTransform {
  transform(
    instant: Instant | null | undefined,
    timeZone: string,
    mode: FormatMode = 'datetime',
  ): string {
    return instant ? formatInZone(instant, timeZone, mode) : '';
  }
}
