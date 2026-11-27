import { TestBed } from '@angular/core/testing';
import { AppointmentsApi } from '../../core/api/appointments.api';
import { STORAGE_KEYS } from '../../core/config/app.constants';
import { ApiError } from '../../core/errors/api-error';
import { ERROR_MESSAGES } from '../../core/errors/error-messages';
import { problem } from '../auth/auth-test-helpers';
import { FakeAppointmentsApi, OTHER_START_AT, SELECTION, START_AT } from './booking-test-helpers';
import { BookingStore } from './booking.store';

function setup() {
  const api = new FakeAppointmentsApi();
  TestBed.configureTestingModule({
    providers: [BookingStore, { provide: AppointmentsApi, useValue: api }],
  });
  return { api, store: TestBed.inject(BookingStore) };
}

describe('BookingStore (FR-026, FR-027, FR-030)', () => {
  afterEach(() => sessionStorage.clear());

  it('a chave nasce ao abrir o resumo e o reenvio reutiliza a mesma chave', () => {
    const { api, store } = setup();
    expect(store.idempotencyKey()).toBeNull();
    store.review(SELECTION);
    const key = store.idempotencyKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.phase()).toBe('reviewing');

    store.submit();
    api.last().reply.error(new ApiError({ kind: 'network', status: 0 }));
    store.submit();
    expect(api.calls.map((c) => c.key)).toEqual([key, key]);
    expect(api.calls[0]?.body).toEqual({
      providerId: 'p1',
      serviceId: 's1',
      startAt: START_AT,
      notes: '',
    });
  });

  it('ignora o segundo clique enquanto o primeiro envio está em andamento', () => {
    const { api, store } = setup();
    store.review(SELECTION);
    store.submit();
    store.submit();
    expect(store.phase()).toBe('submitting');
    expect(api.calls).toHaveLength(1);
  });

  it('a chave só muda quando providerId/serviceId/startAt/notes mudam', () => {
    const { store } = setup();
    store.review(SELECTION);
    const first = store.idempotencyKey();
    store.review({ ...SELECTION });
    expect(store.idempotencyKey()).toBe(first);

    store.setNotes('Chego 5 min antes');
    const second = store.idempotencyKey();
    expect(second).not.toBe(first);
    store.setNotes('Chego 5 min antes');
    expect(store.idempotencyKey()).toBe(second);

    store.review({ ...SELECTION, startAt: OTHER_START_AT });
    expect(store.idempotencyKey()).not.toBe(second);
  });

  it('201 e 200 (já processado) são sucesso', () => {
    const { api, store } = setup();
    store.review(SELECTION);
    store.submit();
    api.succeed('Confirmed', true);
    expect(store.phase()).toBe('success');
    expect(store.result()?.appointment.status).toBe('Confirmed');
    expect(store.error()).toBeNull();
  });

  it('409 appointment.slot_unavailable volta à escolha e dispara a recarga dos horários', () => {
    const { api, store } = setup();
    store.review(SELECTION);
    store.submit();
    api.last().reply.error(problem(409, 'appointment.slot_unavailable'));
    expect(store.phase()).toBe('choosing');
    expect(store.slotsReloads()).toBe(1);
    expect(store.errorMessage()).toBe('Este horário acabou de ser ocupado. Escolha outro.');
  });

  it('409 appointment.customer_overlap avisa sem recarregar nem sair do resumo', () => {
    const { api, store } = setup();
    store.review(SELECTION);
    store.submit();
    api.last().reply.error(problem(409, 'appointment.customer_overlap'));
    expect(store.phase()).toBe('error');
    expect(store.slotsReloads()).toBe(0);
    expect(store.errorMessage()).toBe('Você já tem um agendamento nesse horário.');
  });

  it('422 idempotency.key_reused gera uma nova chave', () => {
    const { api, store } = setup();
    store.review(SELECTION);
    const key = store.idempotencyKey();
    store.submit();
    api.last().reply.error(problem(422, 'idempotency.key_reused'));
    expect(store.phase()).toBe('error');
    expect(store.idempotencyKey()).not.toBe(key);
    store.submit();
    expect(api.last().key).toBe(store.idempotencyKey());
  });

  for (const code of [
    'availability.outside_working_hours',
    'availability.closed',
    'availability.misaligned_start',
    'availability.too_soon',
    'availability.beyond_horizon',
    'availability.date_in_past',
    'service.inactive',
    'provider.inactive',
  ] as const) {
    it(`422 ${code} volta à escolha de horário com a mensagem do catálogo`, () => {
      const { api, store } = setup();
      store.review(SELECTION);
      store.submit();
      api.last().reply.error(problem(422, code));
      expect(store.phase()).toBe('choosing');
      expect(store.errorMessage()).toBe(ERROR_MESSAGES[code].message);
    });
  }

  it('escolher outro horário depois de um erro limpa a mensagem', () => {
    const { api, store } = setup();
    store.review(SELECTION);
    store.submit();
    api.last().reply.error(problem(409, 'appointment.slot_unavailable'));
    store.review({ ...SELECTION, startAt: OTHER_START_AT });
    expect(store.error()).toBeNull();
    expect(store.phase()).toBe('reviewing');
  });

  it("o rascunho das observações fica em sessionStorage['sm.booking-draft'] e volta no resumo", () => {
    const first = setup();
    first.store.review(SELECTION);
    first.store.setNotes('Prefiro máquina 2');
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.bookingDraft) ?? '{}')).toMatchObject({
      providerId: 'p1',
      serviceId: 's1',
      notes: 'Prefiro máquina 2',
    });

    TestBed.resetTestingModule();
    const second = setup();
    second.store.review(SELECTION);
    expect(second.store.notes()).toBe('Prefiro máquina 2');

    second.store.submit();
    second.api.succeed();
    expect(sessionStorage.getItem(STORAGE_KEYS.bookingDraft)).toBeNull();
  });

  it('o rascunho de outro serviço não é reaproveitado', () => {
    const first = setup();
    first.store.review(SELECTION);
    first.store.setNotes('Outro serviço');
    TestBed.resetTestingModule();
    const second = setup();
    second.store.review({ ...SELECTION, serviceId: 's2' });
    expect(second.store.notes()).toBe('');
  });
});
