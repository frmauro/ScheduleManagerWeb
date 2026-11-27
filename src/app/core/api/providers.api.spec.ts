import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { AvailabilityResponse, Page, ProviderSummary } from '../models/api-models';
import { ProvidersApi } from './providers.api';

const PAGE: Page<ProviderSummary> = {
  items: [
    { id: 'p1', displayName: 'Barbearia', category: 'Barbershop', city: 'Manaus', state: 'AM' },
  ],
  page: 2,
  pageSize: 10,
  totalCount: 11,
  totalPages: 2,
};

describe('ProvidersApi (operações #8, #9, #25)', () => {
  let api: ProvidersApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ProvidersApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#8 GET /providers com filtros, ordem e paginação', async () => {
    const promise = firstValueFrom(
      api.search({
        category: 'Barbershop',
        city: 'São Paulo',
        q: 'corte & cia',
        sort: '-displayName',
        page: 2,
        pageSize: 10,
      }),
    );
    const req = httpMock.expectOne((r) => r.url === '/providers');
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toBe(
      '/providers?page=2&pageSize=10&category=Barbershop&city=S%C3%A3o%20Paulo&q=corte%20%26%20cia&sort=-displayName',
    );
    req.flush(PAGE);
    expect(await promise).toEqual(PAGE);
  });

  it('#8 omite filtros vazios', () => {
    void firstValueFrom(api.search({ city: '', q: undefined }));
    const req = httpMock.expectOne('/providers');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(PAGE);
  });

  it('#9 GET /providers/{providerId}', () => {
    void firstValueFrom(api.getPublic('abc/1'));
    const req = httpMock.expectOne('/providers/abc%2F1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('#25 GET /providers/{providerId}/availability com serviceId e date yyyy-MM-dd', async () => {
    const body: AvailabilityResponse = {
      providerId: 'p1',
      serviceId: 's1',
      date: '2026-12-01',
      timeZoneId: 'America/Manaus',
      durationMinutes: 30,
      slots: [{ startAt: '2026-12-01T09:00:00-04:00', endAt: '2026-12-01T09:30:00-04:00' }],
    };
    const promise = firstValueFrom(api.availability('p1', { serviceId: 's1', date: '2026-12-01' }));
    const req = httpMock.expectOne('/providers/p1/availability?serviceId=s1&date=2026-12-01');
    expect(req.request.method).toBe('GET');
    req.flush(body);
    expect((await promise).slots[0]?.startAt).toBe('2026-12-01T09:00:00-04:00');
  });
});
