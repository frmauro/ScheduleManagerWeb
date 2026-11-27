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
