import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { Appointment, CreateAppointmentRequest } from '../models/api-models';
import { AppointmentsApi } from './appointments.api';

const START_AT = '2026-12-01T09:00:00-04:00';

const APPOINTMENT: Appointment = {
  id: 'a1',
  provider: { id: 'p1', displayName: 'Barbearia', timeZoneId: 'America/Manaus' },
  customer: { id: 'c1', name: 'Ana' },
  service: { id: 's1', name: 'Corte', durationMinutes: 30, price: 50 },
  startAt: START_AT,
  endAt: '2026-12-01T09:30:00-04:00',
  status: 'Pending',
  notes: null,
  cancellationReason: null,
  version: '1',
  createdAt: '2026-11-27T10:00:00-03:00',
  history: [],
};

describe('AppointmentsApi (operação #26)', () => {
  let api: AppointmentsApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AppointmentsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#26 POST /appointments com Idempotency-Key e o startAt do slot intacto; 201 → replayed=false', async () => {
    const body: CreateAppointmentRequest = {
      providerId: 'p1',
      serviceId: 's1',
      startAt: START_AT,
      notes: 'Primeira vez',
    };
    const promise = firstValueFrom(api.create(body, 'key-1'));
    const req = httpMock.expectOne('/appointments');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(req.request.body).toEqual({
      providerId: 'p1',
      serviceId: 's1',
      startAt: START_AT,
      notes: 'Primeira vez',
    });
    req.flush(APPOINTMENT, { status: 201, statusText: 'Created' });
    expect(await promise).toEqual({ appointment: APPOINTMENT, replayed: false });
  });

  it('#26 omite notes vazias ou só com espaços', () => {
    void firstValueFrom(
      api.create({ providerId: 'p1', serviceId: 's1', startAt: START_AT, notes: '   ' }, 'k'),
    );
    const req = httpMock.expectOne('/appointments');
    expect(req.request.body).toEqual({ providerId: 'p1', serviceId: 's1', startAt: START_AT });
    req.flush(APPOINTMENT, { status: 201, statusText: 'Created' });
  });

  it('#26 200 (mesma chave já processada) → replayed=true, tratado como sucesso', async () => {
    const promise = firstValueFrom(
      api.create({ providerId: 'p1', serviceId: 's1', startAt: START_AT }, 'key-1'),
    );
    httpMock.expectOne('/appointments').flush(APPOINTMENT, { status: 200, statusText: 'OK' });
    expect(await promise).toEqual({ appointment: APPOINTMENT, replayed: true });
  });
});
