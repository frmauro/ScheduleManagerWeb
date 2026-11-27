import { HttpClient, HttpStatusCode, type HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type {
  AdminCancelRequest,
  Appointment,
  CancelRequest,
  CreateAppointmentRequest,
  Uuid,
  Versioned,
} from '../models/api-models';
import { ApiError } from '../errors/api-error';
import { API } from './endpoints';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IF_MATCH_HEADER = 'If-Match';

export interface CreateAppointmentResult {
  readonly appointment: Appointment;
  /** `true` quando a API devolveu `200`: a mesma chave já tinha criado este agendamento. */
  readonly replayed: boolean;
}

function bodyOf<T>(response: HttpResponse<T>): T {
  if (response.body === null) {
    throw new ApiError({ kind: 'unknown', status: response.status });
  }
  return response.body;
}

/** `ETag` da resposta ou, na falta dele, `W/"{version}"` do corpo (concorrência otimista, R9). */
function toVersioned(response: HttpResponse<Appointment>): Versioned<Appointment> {
  const value = bodyOf(response);
  return { value, etag: response.headers.get('ETag') ?? `W/"${value.version}"` };
}

function isAdminCancel(body: CancelRequest | AdminCancelRequest): body is AdminCancelRequest {
  return 'onBehalfOf' in body;
}

/** Agendamentos: #26–#30 (contracts/api-services.md). */
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
        map((response) => ({
          appointment: bodyOf(response),
          replayed: response.status === HttpStatusCode.Ok,
        })),
      );
  }

  /** #27 — detalhe com o `etag` para as ações de status. */
  get(appointmentId: Uuid): Observable<Versioned<Appointment>> {
    return this.http
      .get<Appointment>(API.appointments.byId(appointmentId), { observe: 'response' })
      .pipe(map(toVersioned));
  }

  /** #28 — Pending → Confirmed, com `If-Match`; devolve o novo `etag`. */
  confirm(appointmentId: Uuid, etag: string): Observable<Versioned<Appointment>> {
    return this.statusAction(API.appointments.confirm(appointmentId), etag);
  }

  /** #30 — Confirmed → Completed, só após o início (`422 appointment.not_started`). */
  complete(appointmentId: Uuid, etag: string): Observable<Versioned<Appointment>> {
    return this.statusAction(API.appointments.complete(appointmentId), etag);
  }

  /**
   * #29 — cancela com `If-Match`. `onBehalfOf` só vai no corpo quando o chamador é o Admin
   * (`AdminCancelRequest`); Cliente e Prestador nunca o enviam.
   */
  cancel(
    appointmentId: Uuid,
    etag: string,
    body: CancelRequest | AdminCancelRequest,
  ): Observable<Versioned<Appointment>> {
    const payload = isAdminCancel(body)
      ? { reason: body.reason, onBehalfOf: body.onBehalfOf }
      : { reason: body.reason };
    return this.http
      .post<Appointment>(API.appointments.cancel(appointmentId), payload, {
        headers: { [IF_MATCH_HEADER]: etag },
        observe: 'response',
      })
      .pipe(map(toVersioned));
  }

  private statusAction(url: string, etag: string): Observable<Versioned<Appointment>> {
    return this.http
      .post<Appointment>(url, null, { headers: { [IF_MATCH_HEADER]: etag }, observe: 'response' })
      .pipe(map(toVersioned));
  }
}
