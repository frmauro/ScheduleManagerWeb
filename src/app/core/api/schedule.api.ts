import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  LocalDate,
  Page,
  PageQuery,
  ScheduleChangeResult,
  ScheduleException,
  ScheduleExceptionCreated,
  ScheduleExceptionRequest,
  Uuid,
  WeeklySchedule,
} from '../models/api-models';
import { API } from './endpoints';
import { toHttpParams } from './http-params';

export interface ExceptionsQuery extends PageQuery {
  readonly from?: LocalDate;
  readonly to?: LocalDate;
}

/** Expediente e exceções do prestador logado: #20–#24 (contracts/api-services.md). */
@Injectable({ providedIn: 'root' })
export class ScheduleApi {
  private readonly http = inject(HttpClient);

  /** #20 — expediente semanal; `timeZoneId` é só leitura. */
  getWeekly(): Observable<WeeklySchedule> {
    return this.http.get<WeeklySchedule>(API.schedule.weekly);
  }

  /**
   * #21 — substitui o expediente **inteiro**; dia omitido = fechado. Envia só `days` (o fuso
   * é do estabelecimento). Agendamentos fora do novo expediente voltam em `affectedAppointments`.
   */
  replaceWorkingHours(body: Pick<WeeklySchedule, 'days'>): Observable<ScheduleChangeResult> {
    return this.http.put<ScheduleChangeResult>(API.schedule.workingHours, { days: body.days });
  }

  /** #22 — exceções por período (`yyyy-MM-dd`), paginadas. */
  listExceptions(query: ExceptionsQuery = {}): Observable<Page<ScheduleException>> {
    return this.http.get<Page<ScheduleException>>(API.schedule.exceptions, {
      params: toHttpParams({
        page: query.page,
        pageSize: query.pageSize,
        from: query.from,
        to: query.to,
      }),
    });
  }

  /** #23 — `201`; `422 schedule.exception_in_past` / `schedule.special_hours_overlap`. */
  createException(body: ScheduleExceptionRequest): Observable<ScheduleExceptionCreated> {
    return this.http.post<ScheduleExceptionCreated>(API.schedule.exceptions, body);
  }

  /** #24 — `204`; `404 schedule.exception_not_found`. */
  deleteException(exceptionId: Uuid): Observable<void> {
    return this.http.delete<void>(API.schedule.exceptionById(exceptionId));
  }
}
