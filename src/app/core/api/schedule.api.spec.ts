import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { ScheduleExceptionRequest, WeeklySchedule } from '../models/api-models';
import { ScheduleApi } from './schedule.api';

describe('ScheduleApi (operações #20–#24)', () => {
  let api: ScheduleApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ScheduleApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#20 GET /providers/me/schedule', () => {
    void firstValueFrom(api.getWeekly());
    const req = httpMock.expectOne('/providers/me/schedule');
    expect(req.request.method).toBe('GET');
    req.flush({ timeZoneId: 'America/Sao_Paulo', days: [] });
  });

  it('#21 PUT /providers/me/schedule/working-hours envia só days, sem timeZoneId', () => {
    const schedule: WeeklySchedule = {
      timeZoneId: 'America/Sao_Paulo',
      days: [{ dayOfWeek: 'Monday', intervals: [{ start: '09:00', end: '12:00' }] }],
    };
    void firstValueFrom(api.replaceWorkingHours(schedule));
    const req = httpMock.expectOne('/providers/me/schedule/working-hours');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ days: schedule.days });
    expect(Object.keys(req.request.body as object)).toEqual(['days']);
    req.flush({ schedule, affectedAppointments: [] });
  });

  it('#22 GET /providers/me/schedule/exceptions com from/to e paginação', () => {
    void firstValueFrom(api.listExceptions({ from: '2026-12-01', to: '2026-12-31', page: 1 }));
    const req = httpMock.expectOne((r) => r.url === '/providers/me/schedule/exceptions');
    expect(req.request.urlWithParams).toBe(
      '/providers/me/schedule/exceptions?page=1&from=2026-12-01&to=2026-12-31',
    );
    req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  });

  it('#23 POST /providers/me/schedule/exceptions', () => {
    const body: ScheduleExceptionRequest = {
      type: 'Closure',
      startDate: '2026-12-24',
      endDate: '2026-12-25',
      startTime: null,
      endTime: null,
      reason: 'Natal',
    };
    void firstValueFrom(api.createException(body));
    const req = httpMock.expectOne('/providers/me/schedule/exceptions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ exception: { id: 'e1', ...body }, affectedAppointments: [] });
  });

  it('#24 DELETE /providers/me/schedule/exceptions/{exceptionId}', () => {
    void firstValueFrom(api.deleteException('e1'), { defaultValue: undefined });
    const req = httpMock.expectOne('/providers/me/schedule/exceptions/e1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
