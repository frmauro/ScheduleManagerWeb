import { TestBed } from '@angular/core/testing';
import { of, type Observable } from 'rxjs';
import { ScheduleApi } from '../../../core/api/schedule.api';
import { ServicesApi, type MyServicesQuery } from '../../../core/api/services.api';
import type { Page, Service, WeeklySchedule } from '../../../core/models/api-models';
import { ProviderSetupStore } from './provider-setup.store';

class FakeServicesApi {
  activeCount = 0;
  readonly queries: MyServicesQuery[] = [];
  listMine(query: MyServicesQuery): Observable<Page<Service>> {
    this.queries.push(query);
    return of({ items: [], page: 1, pageSize: 1, totalCount: this.activeCount, totalPages: 1 });
  }
}

class FakeScheduleApi {
  days: WeeklySchedule['days'] = [];
  getWeekly(): Observable<WeeklySchedule> {
    return of({ timeZoneId: 'America/Sao_Paulo', days: this.days });
  }
}

function setup() {
  const services = new FakeServicesApi();
  const schedule = new FakeScheduleApi();
  TestBed.configureTestingModule({
    providers: [
      { provide: ServicesApi, useValue: services },
      { provide: ScheduleApi, useValue: schedule },
    ],
  });
  return { services, schedule, store: TestBed.inject(ProviderSetupStore) };
}

const MONDAY: WeeklySchedule['days'] = [
  { dayOfWeek: 'Monday', intervals: [{ start: '09:00', end: '12:00' }] },
];

describe('ProviderSetupStore (FR-037)', () => {
  it('consulta só serviços ativos com pageSize 1', () => {
    const { services, store } = setup();
    store.load();
    expect(services.queries).toEqual([{ isActive: true, pageSize: 1 }]);
  });

  it('incompleto sem serviço ativo ou sem expediente', () => {
    const { services, schedule, store } = setup();
    store.load();
    expect(store.complete()).toBe(false);
    expect(store.doneCount()).toBe(0);

    services.activeCount = 1;
    store.load();
    expect(store.checklist()).toEqual({ hasActiveService: true, hasWorkingHours: false });
    expect(store.complete()).toBe(false);

    services.activeCount = 0;
    schedule.days = MONDAY;
    store.load();
    expect(store.complete()).toBe(false);
    expect(store.doneCount()).toBe(1);
  });

  it('concluído com ≥ 1 serviço ativo e ≥ 1 dia com expediente; revisar a política não bloqueia', () => {
    const { services, schedule, store } = setup();
    services.activeCount = 3;
    schedule.days = MONDAY;
    store.load();
    expect(store.policyReviewedHint()).toBe(false);
    expect(store.complete()).toBe(true);
    expect(store.doneCount()).toBe(2);
  });

  it('reaparece se todos os serviços forem desativados', () => {
    const { services, schedule, store } = setup();
    services.activeCount = 1;
    schedule.days = MONDAY;
    store.load();
    expect(store.complete()).toBe(true);

    services.activeCount = 0;
    store.load();
    expect(store.complete()).toBe(false);
  });
});
