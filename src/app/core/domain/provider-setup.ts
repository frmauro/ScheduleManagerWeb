import { forkJoin, map, type Observable } from 'rxjs';
import type { ScheduleApi } from '../api/schedule.api';
import type { ServicesApi } from '../api/services.api';

/** Checklist de primeiros passos do prestador (data-model §4, FR-037). */
export interface SetupChecklist {
  /** Ao menos um serviço ativo. */
  readonly hasActiveService: boolean;
  /** Ao menos um dia com expediente. */
  readonly hasWorkingHours: boolean;
}

/** Concluído = serviço ativo **e** expediente; revisar a política é opcional. */
export function isSetupComplete(checklist: SetupChecklist): boolean {
  return checklist.hasActiveService && checklist.hasWorkingHours;
}

/** Deriva o checklist de 2 GETs: `listMine({ isActive: true, pageSize: 1 })` e `getWeekly()`. */
export function loadSetupChecklist(
  services: ServicesApi,
  schedule: ScheduleApi,
): Observable<SetupChecklist> {
  return forkJoin({
    active: services.listMine({ isActive: true, pageSize: 1 }),
    weekly: schedule.getWeekly(),
  }).pipe(
    map(({ active, weekly }) => ({
      hasActiveService: active.totalCount >= 1,
      hasWorkingHours: weekly.days.some((day) => day.intervals.length > 0),
    })),
  );
}
