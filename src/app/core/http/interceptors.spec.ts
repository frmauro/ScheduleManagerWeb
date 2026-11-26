import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../errors/api-error';
import { SessionStore } from '../auth/session.store';
import { ToastService } from '../feedback/toast.service';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { SKIP_ERROR_TOAST, SKIP_SESSION_401 } from './http-contexts';

describe('interceptors HTTP', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: SessionStore;
  const navigate = vi.fn().mockResolvedValue(true);
  const toastError = vi.fn();

  beforeEach(() => {
    navigate.mockClear();
    toastError.mockClear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([apiBaseUrlInterceptor, authInterceptor, errorInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: Router, useValue: { url: '/cliente/agendamentos?aba=historico', navigate } },
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => httpMock.verify());

  function login(): void {
    session.start({
      accessToken: 'tkn',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 'u', name: 'Ana', email: 'a@x.com', role: 'Customer' },
    });
  }

  it('prefixa /api/v1 em caminhos relativos da API', () => {
    void firstValueFrom(http.get('/providers'));
    httpMock.expectOne('/api/v1/providers').flush({});
  });

  it('não altera URLs absolutas', () => {
    void firstValueFrom(http.get('https://exemplo.com/x'));
    httpMock.expectOne('https://exemplo.com/x').flush({});
  });

  it('adiciona Authorization: Bearer só com sessão', () => {
    void firstValueFrom(http.get('/auth/me'));
    expect(httpMock.expectOne('/api/v1/auth/me').request.headers.has('Authorization')).toBe(false);
    login();
    void firstValueFrom(http.get('/auth/me'));
    const req = httpMock.expectOne('/api/v1/auth/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tkn');
    req.flush({});
  });

  it('não envia o token para outras origens', () => {
    login();
    void firstValueFrom(http.get('https://exemplo.com/x'));
    expect(httpMock.expectOne('https://exemplo.com/x').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('converte erros em ApiError', async () => {
    const promise = firstValueFrom(http.get('/providers/x'));
    httpMock
      .expectOne('/api/v1/providers/x')
      .flush(
        { type: 't', title: 'x', status: 404, code: 'provider.not_found', traceId: 'tr' },
        { status: 404, statusText: 'Not Found' },
      );
    const error: unknown = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('provider.not_found');
  });

  it('401 limpa a sessão e leva ao login com returnUrl e motivo', async () => {
    login();
    const promise = firstValueFrom(http.get('/customers/me'));
    httpMock
      .expectOne('/api/v1/customers/me')
      .flush(
        { type: 't', title: 'x', status: 401, code: 'auth.unauthenticated', traceId: 'tr' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await promise.catch(() => undefined);
    expect(session.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/entrar'], {
      queryParams: { returnUrl: '/cliente/agendamentos?aba=historico', motivo: 'sessao-expirada' },
    });
  });

  it('401 com SKIP_SESSION_401 (login) não dispara o fluxo de sessão expirada', async () => {
    const promise = firstValueFrom(
      http.post('/auth/login', {}, { context: new HttpContext().set(SKIP_SESSION_401, true) }),
    );
    httpMock
      .expectOne('/api/v1/auth/login')
      .flush(
        { type: 't', title: 'x', status: 401, code: 'auth.invalid_credentials', traceId: 'tr' },
        { status: 401, statusText: 'Unauthorized' },
      );
    const error: unknown = await promise.catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('auth.invalid_credentials');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('403 mostra o toast "Você não tem permissão para esta ação."', async () => {
    const promise = firstValueFrom(http.get('/admin/users'));
    httpMock
      .expectOne('/api/v1/admin/users')
      .flush(
        { type: 't', title: 'x', status: 403, code: 'auth.forbidden', traceId: 'tr' },
        { status: 403, statusText: 'Forbidden' },
      );
    await promise.catch(() => undefined);
    expect(toastError).toHaveBeenCalledWith('Você não tem permissão para esta ação.');
  });

  it('403 com SKIP_ERROR_TOAST não mostra toast', async () => {
    const promise = firstValueFrom(
      http.get('/appointments/x', { context: new HttpContext().set(SKIP_ERROR_TOAST, true) }),
    );
    httpMock
      .expectOne('/api/v1/appointments/x')
      .flush(
        { type: 't', title: 'x', status: 403, code: 'auth.forbidden', traceId: 'tr' },
        { status: 403, statusText: 'Forbidden' },
      );
    await promise.catch(() => undefined);
    expect(toastError).not.toHaveBeenCalled();
  });
});
