import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { CustomerProfile } from '../models/api-models';
import { CustomersApi } from './customers.api';

const PROFILE: CustomerProfile = {
  id: 'c1',
  name: 'Ana',
  email: 'ana@example.com',
  phone: '+5511988887777',
  createdAt: '2026-11-01T10:00:00-03:00',
};

describe('CustomersApi (operações #5–#7)', () => {
  let api: CustomersApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CustomersApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#5 GET /customers/me', async () => {
    const promise = firstValueFrom(api.getMe());
    const req = httpMock.expectOne('/customers/me');
    expect(req.request.method).toBe('GET');
    req.flush(PROFILE);
    expect(await promise).toEqual(PROFILE);
  });

  it('#6 PUT /customers/me com nome, e-mail e telefone', () => {
    const body = { name: 'Ana Maria', email: 'ana@example.com', phone: '+5511988887777' };
    void firstValueFrom(api.updateMe(body));
    const req = httpMock.expectOne('/customers/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ ...PROFILE, ...body });
  });

  it('#7 GET /customers/me/appointments com status repetido, from/to com offset, providerId e sort', () => {
    void firstValueFrom(
      api.listMyAppointments({
        status: ['Pending', 'Confirmed'],
        from: '2026-12-01T10:00:00+05:30',
        to: '2026-12-31T00:00:00-03:00',
        providerId: 'p1',
        sort: 'startAt',
        page: 2,
        pageSize: 10,
      }),
    );
    const req = httpMock.expectOne((r) => r.url === '/customers/me/appointments');
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toBe(
      '/customers/me/appointments?page=2&pageSize=10&status=Pending&status=Confirmed' +
        '&from=2026-12-01T10:00:00%2B05:30&to=2026-12-31T00:00:00-03:00&providerId=p1&sort=startAt',
    );
    req.flush({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 });
  });

  it('#7 sem filtros não envia parâmetros', () => {
    void firstValueFrom(api.listMyAppointments());
    const req = httpMock.expectOne('/customers/me/appointments');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  });
});
