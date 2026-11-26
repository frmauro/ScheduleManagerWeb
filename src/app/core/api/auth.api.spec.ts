import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_SESSION_401 } from '../http/http-contexts';
import type { AuthResponse, RegisterProviderRequest } from '../models/api-models';
import { AuthApi } from './auth.api';

const AUTH: AuthResponse = {
  accessToken: 't',
  tokenType: 'Bearer',
  expiresAt: '2026-12-01T13:00:00Z',
  user: { id: 'u', name: 'Ana', email: 'a@x.com', role: 'Customer' },
};

describe('AuthApi (operações #1–#4)', () => {
  let api: AuthApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('#1 POST /auth/register/customer', async () => {
    const body = { name: 'Ana', email: 'a@x.com', password: 'senha123', phone: '+5511999998888' };
    const promise = firstValueFrom(api.registerCustomer(body));
    const req = httpMock.expectOne('/auth/register/customer');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(AUTH, { status: 201, statusText: 'Created' });
    expect(await promise).toEqual(AUTH);
  });

  it('#2 POST /auth/register/provider', () => {
    const body: RegisterProviderRequest = {
      name: 'Bruno',
      email: 'b@x.com',
      password: 'senha123',
      displayName: 'Barbearia do Bruno',
      category: 'Barbershop',
      contactPhone: '+5511999998888',
      address: {
        street: 'Rua A',
        number: '10',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      },
      timeZoneId: 'America/Sao_Paulo',
    };
    void firstValueFrom(api.registerProvider(body));
    const req = httpMock.expectOne('/auth/register/provider');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(AUTH, { status: 201, statusText: 'Created' });
  });

  it('#3 POST /auth/login marcado com SKIP_SESSION_401', () => {
    void firstValueFrom(api.login({ email: 'a@x.com', password: 'x' }));
    const req = httpMock.expectOne('/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(SKIP_SESSION_401)).toBe(true);
    req.flush(AUTH);
  });

  it('#4 GET /auth/me', async () => {
    const promise = firstValueFrom(api.me());
    const req = httpMock.expectOne('/auth/me');
    expect(req.request.method).toBe('GET');
    req.flush(AUTH.user);
    expect((await promise).name).toBe('Ana');
  });
});
