import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { Appointment, CreateAppointmentRequest, Uuid } from '../models/api-models';
import { ApiError } from '../errors/api-error';
import { API } from './endpoints';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

export interface CreateAppointmentResult {
  readonly appointment: Appointment;
  /** `true` quando a API devolveu `200`: a mesma chave já tinha criado este agendamento. */
  readonly replayed: boolean;
}

/** Agendamentos: operação #26 (contracts/api-services.md). As demais entram com US4–US8. */
@Injectable({ providedIn: 'root' })
export class AppointmentsApi {
  private readonly http = inject(HttpClient);

  /**
   * #26 — cria a reserva. O `startAt` vai exatamente como veio do slot (FR-026) e a mesma
   * `Idempotency-Key` é reutilizada nos reenvios (FR-027): `201` criou, `200` já existia.
   */
  create(
    body: CreateAppointmentRequest,
    idempotencyKey: Uuid,
  ): Observable<CreateAppointmentResult> {
    const notes = body.notes?.trim();
    const payload: CreateAppointmentRequest = {
      providerId: body.providerId,
      serviceId: body.serviceId,
      startAt: body.startAt,
      ...(notes ? { notes } : {}),
    };
    return this.http
      .post<Appointment>(API.appointments.create, payload, {
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        observe: 'response',
      })
      .pipe(
        map((response) => {
          if (!response.body) {
            throw new ApiError({ kind: 'unknown', status: response.status });
          }
          return {
            appointment: response.body,
            replayed: response.status === HttpStatusCode.Ok,
          };
        }),
      );
  }
}
