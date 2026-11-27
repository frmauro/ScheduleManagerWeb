import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { Page, Service } from '../models/api-models';
import { ServicesApi } from './services.api';

describe('ServicesApi (operação #14)', () => {
  let api: ServicesApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ServicesApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#14 GET /providers/{providerId}/services (público, paginado)', async () => {
    const page: Page<Service> = {
      items: [
        {
          id: 's1',
          providerId: 'p1',
          name: 'Corte',
          description: null,
          durationMinutes: 30,
          price: 50,
          isActive: true,
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    };
    const promise = firstValueFrom(api.listPublic('p1', { pageSize: 100 }));
    const req = httpMock.expectOne('/providers/p1/services?pageSize=100');
    expect(req.request.method).toBe('GET');
    req.flush(page);
    expect((await promise).items[0]?.name).toBe('Corte');
  });

  it('#14 sem paginação explícita não envia parâmetros', () => {
    void firstValueFrom(api.listPublic('p1'));
    httpMock.expectOne('/providers/p1/services').flush({ items: [] });
  });
});

describe('ServicesApi (operações #15–#19)', () => {
  let api: ServicesApi;
  let httpMock: HttpTestingController;
  const body = { name: 'Corte', description: null, durationMinutes: 30, price: 50 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ServicesApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#15 GET /providers/me/services com isActive e paginação', () => {
    void firstValueFrom(api.listMine({ isActive: false, page: 2, pageSize: 1 }));
    const req = httpMock.expectOne((r) => r.url === '/providers/me/services');
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toBe(
      '/providers/me/services?page=2&pageSize=1&isActive=false',
    );
    req.flush({ items: [], page: 2, pageSize: 1, totalCount: 0, totalPages: 0 });
  });

  it('#15 sem isActive lista ativos e inativos', () => {
    void firstValueFrom(api.listMine());
    const req = httpMock.expectOne('/providers/me/services');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  });

  it('#16 POST /providers/me/services', () => {
    void firstValueFrom(api.create(body));
    const req = httpMock.expectOne('/providers/me/services');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('#17 PUT /providers/me/services/{serviceId}', () => {
    void firstValueFrom(api.update('s1', body));
    const req = httpMock.expectOne('/providers/me/services/s1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('#18 DELETE /providers/me/services/{serviceId} → 204', async () => {
    const promise = firstValueFrom(api.delete('s1'), { defaultValue: undefined });
    const req = httpMock.expectOne('/providers/me/services/s1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(await promise).toBeNull();
  });

  it('#19 PATCH /providers/me/services/{serviceId}/status com { isActive }', () => {
    void firstValueFrom(api.setStatus('s1', false));
    const req = httpMock.expectOne('/providers/me/services/s1/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isActive: false });
    req.flush({});
  });
});
