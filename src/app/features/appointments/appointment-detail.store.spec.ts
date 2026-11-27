import { TestBed } from '@angular/core/testing';
import { of, Subject, type Observable } from 'rxjs';
import { AppointmentsApi } from '../../core/api/appointments.api';
import { ProvidersApi } from '../../core/api/providers.api';
import { SessionStore } from '../../core/auth/session.store';
import type { Appointment, CancelRequest, Uuid, Versioned } from '../../core/models/api-models';
import type { AppointmentStatus, Role } from '../../core/models/enums';
import { authResponse, problem } from '../auth/auth-test-helpers';
import { AppointmentDetailStore } from './appointment-detail.store';

const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
const PAST = new Date(Date.now() - 10 * 60_000).toISOString();

function appointment(
  status: AppointmentStatus = 'Pending',
  version = '1',
  startAt = FUTURE,
): Appointment {
  return {
    id: 'a1',
    provider: { id: 'p1', displayName: 'Barbearia', timeZoneId: 'America/Sao_Paulo' },
    customer: { id: 'c1', name: 'Ana', email: 'ana@example.com', phone: '+5511988887777' },
    service: { id: 's1', name: 'Corte', durationMinutes: 30, price: 50 },
    startAt,
    endAt: startAt,
    status,
    notes: null,
    cancellationReason: null,
    version,
    createdAt: '2026-11-27T10:00:00-03:00',
    history: [],
  };
}

function versioned(value: Appointment): Versioned<Appointment> {
  return { value, etag: `W/"${value.version}"` };
}

interface Call {
  readonly kind: 'get' | 'confirm' | 'complete' | 'cancel';
  readonly id: Uuid;
  readonly etag?: string;
  readonly body?: CancelRequest;
  readonly reply: Subject<Versioned<Appointment>>;
}

/** `AppointmentsApi` falso: cada chamada fica pendente até o teste responder. */
class FakeAppointmentsApi {
  readonly calls: Call[] = [];

  private push(call: Omit<Call, 'reply'>): Observable<Versioned<Appointment>> {
    const reply = new Subject<Versioned<Appointment>>();
    this.calls.push({ ...call, reply });
    return reply;
  }

  get(id: Uuid) {
    return this.push({ kind: 'get', id });
  }
  confirm(id: Uuid, etag: string) {
    return this.push({ kind: 'confirm', id, etag });
  }
  complete(id: Uuid, etag: string) {
    return this.push({ kind: 'complete', id, etag });
  }
  cancel(id: Uuid, etag: string, body: CancelRequest) {
    return this.push({ kind: 'cancel', id, etag, body });
  }

  last(kind: Call['kind']): Call {
    const call = this.calls.filter((c) => c.kind === kind).at(-1);
    if (!call) {
      throw new Error(`nenhuma chamada ${kind}`);
    }
    return call;
  }

  count(kind: Call['kind']): number {
    return this.calls.filter((c) => c.kind === kind).length;
  }
}

function reply(call: Call, value: Appointment): void {
  call.reply.next(versioned(value));
  call.reply.complete();
}

class FakeProvidersApi {
  readonly calls: string[] = [];
  getPublic(id: string) {
    this.calls.push(id);
    return of({ contactEmail: 'contato@barbearia.com', contactPhone: '+5511999998888' });
  }
}

function setup(role: Role = 'Provider') {
  const api = new FakeAppointmentsApi();
  const providers = new FakeProvidersApi();
  TestBed.configureTestingModule({
    providers: [
      AppointmentDetailStore,
      { provide: AppointmentsApi, useValue: api },
      { provide: ProvidersApi, useValue: providers },
    ],
  });
  TestBed.inject(SessionStore).start(authResponse(role));
  const store = TestBed.inject(AppointmentDetailStore);
  return { api, providers, store };
}

function loaded(role: Role = 'Provider', value = appointment()) {
  const ctx = setup(role);
  ctx.store.load('a1');
  reply(ctx.api.last('get'), value);
  return ctx;
}

const CONFLICT = 'Este agendamento foi alterado por outra pessoa. Veja o status atual.';

describe('AppointmentDetailStore (FR-046..048)', () => {
  it('load guarda appointment e etag', () => {
    const { store } = loaded();
    expect(store.status()).toBe('ready');
    expect(store.appointment()?.id).toBe('a1');
    expect(store.etag()).toBe('W/"1"');
    expect(store.actions()).toEqual(['confirm', 'cancel']);
  });

  it('erro no load → status error com o ApiError', () => {
    const { api, store } = setup();
    store.load('a1');
    api.last('get').reply.error(problem(404, 'appointment.not_found'));
    expect(store.status()).toBe('error');
    expect(store.loadError()?.code).toBe('appointment.not_found');
  });

  it('confirm envia o etag exibido e guarda o novo', () => {
    const { api, store } = loaded();
    store.confirm();
    expect(store.pendingAction()).toBe('confirm');
    expect(api.last('confirm').etag).toBe('W/"1"');
    reply(api.last('confirm'), appointment('Confirmed', '2'));
    expect(store.pendingAction()).toBeNull();
    expect(store.etag()).toBe('W/"2"');
    expect(store.appointment()?.status).toBe('Confirmed');
  });

  it('ignora um segundo clique enquanto a ação está em andamento', () => {
    const { api, store } = loaded();
    store.confirm();
    store.confirm();
    expect(api.count('confirm')).toBe(1);
  });

  it('complete envia o etag exibido e guarda o novo', () => {
    const { api, store } = loaded('Provider', appointment('Confirmed', '4', PAST));
    expect(store.actions()).toEqual(['complete']);
    store.complete();
    expect(api.last('complete').etag).toBe('W/"4"');
    reply(api.last('complete'), appointment('Completed', '5', PAST));
    expect(store.etag()).toBe('W/"5"');
    expect(store.actions()).toEqual([]);
  });

  it('cancelRequest envia o etag exibido e guarda o novo', () => {
    const { api, store } = loaded();
    let done = false;
    store.cancelRequest({ reason: 'Imprevisto' }).subscribe(() => (done = true));
    expect(api.last('cancel')).toMatchObject({ etag: 'W/"1"', body: { reason: 'Imprevisto' } });
    reply(api.last('cancel'), appointment('CancelledByProvider', '2'));
    expect(done).toBe(true);
    expect(store.etag()).toBe('W/"2"');
  });

  for (const [status, code] of [
    [412, 'appointment.precondition_failed'],
    [409, 'appointment.concurrency_conflict'],
  ] as const) {
    it(`${status} ${code} avisa "alterado por outra pessoa" e recarrega`, () => {
      const { api, store } = loaded();
      store.confirm();
      api.last('confirm').reply.error(problem(status, code));
      expect(store.notice()).toBe(CONFLICT);
      expect(api.count('get')).toBe(2);
      reply(api.last('get'), appointment('CancelledByCustomer', '2'));
      expect(store.appointment()?.status).toBe('CancelledByCustomer');
      expect(store.etag()).toBe('W/"2"');
      expect(store.notice()).toBe(CONFLICT);
    });
  }

  for (const code of ['appointment.invalid_transition', 'appointment.already_started']) {
    it(`422 ${code} recarrega`, () => {
      const { api, store } = loaded();
      store.confirm();
      api.last('confirm').reply.error(problem(422, code));
      expect(store.notice()).not.toBeNull();
      expect(api.count('get')).toBe(2);
    });
  }

  it('422 appointment.not_started mostra a mensagem sem recarregar', () => {
    const { api, store } = loaded('Provider', appointment('Confirmed', '1', PAST));
    store.complete();
    api.last('complete').reply.error(problem(422, 'appointment.not_started'));
    expect(store.notice()).toBe(
      'O atendimento ainda não começou. Só é possível concluí-lo após o horário de início.',
    );
    expect(api.count('get')).toBe(1);
  });

  it('conflito no cancelamento repassa o erro ao diálogo e recarrega', () => {
    const { api, store } = loaded();
    let failed = false;
    store.cancelRequest({ reason: 'Imprevisto' }).subscribe({ error: () => (failed = true) });
    api.last('cancel').reply.error(problem(412, 'appointment.precondition_failed'));
    expect(failed).toBe(true);
    expect(api.count('get')).toBe(2);
  });

  it('o Cliente vê cancelar e reagendar, nunca confirmar', () => {
    const { store } = loaded('Customer');
    expect(store.actions()).toEqual(['cancel', 'reschedule']);
  });

  it('Cliente: 422 cancellation_window mantém o agendamento e busca os contatos do prestador', () => {
    const { api, providers, store } = loaded('Customer');
    store.cancelRequest({ reason: 'Imprevisto' }).subscribe({ error: () => undefined });
    api.last('cancel').reply.error(problem(422, 'appointment.cancellation_window'));
    expect(store.notice()).toContain('antecedência mínima');
    expect(store.appointment()?.status).toBe('Pending');
    expect(api.count('get')).toBe(1);
    expect(providers.calls).toEqual(['p1']);
    expect(store.providerContacts()).toEqual({
      email: 'contato@barbearia.com',
      phone: '+5511999998888',
    });
  });
});
