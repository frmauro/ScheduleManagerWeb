import { Subject } from 'rxjs';
import type { CreateAppointmentResult } from '../../core/api/appointments.api';
import type {
  Appointment,
  CancelRequest,
  CreateAppointmentRequest,
  Versioned,
} from '../../core/models/api-models';
import type { AppointmentStatus } from '../../core/models/enums';

/** Fixtures compartilhadas pelos testes da reserva (US3). */
export const START_AT = '2026-12-01T09:00:00-04:00';
export const OTHER_START_AT = '2026-12-01T09:30:00-04:00';

export const SELECTION = {
  providerId: 'p1',
  serviceId: 's1',
  date: '2026-12-01',
  startAt: START_AT,
} as const;

export function appointment(status: AppointmentStatus = 'Pending'): Appointment {
  return {
    id: 'a1',
    provider: { id: 'p1', displayName: 'Barbearia do Bruno', timeZoneId: 'America/Manaus' },
    customer: { id: 'c1', name: 'Ana' },
    service: { id: 's1', name: 'Corte', durationMinutes: 30, price: 50 },
    startAt: START_AT,
    endAt: OTHER_START_AT,
    status,
    notes: null,
    cancellationReason: null,
    version: '1',
    createdAt: '2026-11-27T10:00:00-03:00',
    history: [],
  };
}

export interface CreateCall {
  readonly body: CreateAppointmentRequest;
  readonly key: string;
  readonly reply: Subject<CreateAppointmentResult>;
}

export interface CancelCall {
  readonly id: string;
  readonly etag: string;
  readonly body: CancelRequest;
  readonly reply: Subject<Versioned<Appointment>>;
}

/** `AppointmentsApi` falso: cada chamada fica pendente até o teste responder. */
export class FakeAppointmentsApi {
  readonly calls: CreateCall[] = [];
  readonly cancels: CancelCall[] = [];
  readonly gets: { id: string; reply: Subject<Versioned<Appointment>> }[] = [];
  /** Ordem das operações, para verificar "cancela antes de criar". */
  readonly log: string[] = [];

  get(id: string): Subject<Versioned<Appointment>> {
    const reply = new Subject<Versioned<Appointment>>();
    this.gets.push({ id, reply });
    return reply;
  }

  cancel(id: string, etag: string, body: CancelRequest): Subject<Versioned<Appointment>> {
    const reply = new Subject<Versioned<Appointment>>();
    this.cancels.push({ id, etag, body, reply });
    this.log.push('cancel');
    return reply;
  }

  create(body: CreateAppointmentRequest, key: string): Subject<CreateAppointmentResult> {
    const reply = new Subject<CreateAppointmentResult>();
    this.calls.push({ body, key, reply });
    this.log.push('create');
    return reply;
  }

  last(): CreateCall {
    const call = this.calls.at(-1);
    if (!call) {
      throw new Error('Nenhuma chamada a create()');
    }
    return call;
  }

  succeed(status: AppointmentStatus = 'Pending', replayed = false): void {
    const { reply } = this.last();
    reply.next({ appointment: appointment(status), replayed });
    reply.complete();
  }
}
