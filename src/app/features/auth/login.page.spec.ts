import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthApi } from '../../core/api/auth.api';
import { SessionStore } from '../../core/auth/session.store';
import type { AuthResponse, LoginRequest } from '../../core/models/api-models';
import { authResponse, fill, problem, submit } from './auth-test-helpers';
import { LoginPageComponent } from './login.page';

class FakeAuthApi {
  readonly requests: LoginRequest[] = [];
  reply = new Subject<AuthResponse>();
  login(body: LoginRequest): Subject<AuthResponse> {
    this.requests.push(body);
    this.reply = new Subject<AuthResponse>();
    return this.reply;
  }
}

async function setup(inputs: { returnUrl?: string; motivo?: string } = {}) {
  const api = new FakeAuthApi();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthApi, useValue: api }],
  });
  const router = TestBed.inject(Router);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginPageComponent);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { api, fixture, el, navigate, navigateByUrl, session: TestBed.inject(SessionStore) };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

async function login(ctx: Ctx): Promise<void> {
  fill(ctx.el, 'E-mail', 'ana@example.com');
  fill(ctx.el, 'Senha', 'Senha12345');
  submit(ctx.el);
  await ctx.fixture.whenStable();
}

describe('LoginPage (FR-016, US2)', () => {
  afterEach(() => TestBed.inject(SessionStore).clear());

  it('401 auth.invalid_credentials mostra "E-mail ou senha inválidos." sem o fluxo de sessão expirada', async () => {
    const ctx = await setup();
    await login(ctx);
    ctx.api.reply.error(problem(401, 'auth.invalid_credentials'));
    await ctx.fixture.whenStable();

    expect(ctx.el.textContent).toContain('E-mail ou senha inválidos.');
    expect(ctx.el.textContent).not.toContain('Sua sessão expirou');
    expect(ctx.navigate).not.toHaveBeenCalled();
    expect(ctx.navigateByUrl).not.toHaveBeenCalled();
    expect(ctx.session.isAuthenticated()).toBe(false);
  });

  it('com motivo=sessao-expirada mostra "Sua sessão expirou. Entre novamente."', async () => {
    const { el } = await setup({ motivo: 'sessao-expirada' });
    expect(el.textContent).toContain('Sua sessão expirou. Entre novamente.');
  });

  it('sem motivo não mostra o aviso de sessão expirada', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toContain('Sua sessão expirou');
  });

  it('após o sucesso guarda a sessão e volta ao returnUrl compatível com o perfil', async () => {
    const ctx = await setup({ returnUrl: '/cliente/agendamentos?aba=historico' });
    await login(ctx);
    expect(ctx.api.requests[0]).toEqual({ email: 'ana@example.com', password: 'Senha12345' });
    ctx.api.reply.next(authResponse('Customer'));
    ctx.api.reply.complete();
    await ctx.fixture.whenStable();

    expect(ctx.session.role()).toBe('Customer');
    expect(ctx.navigateByUrl).toHaveBeenCalledWith('/cliente/agendamentos?aba=historico');
  });

  it('returnUrl de outra área leva à home do perfil (resolvePostLoginUrl)', async () => {
    const ctx = await setup({ returnUrl: '/admin/usuarios' });
    await login(ctx);
    ctx.api.reply.next(authResponse('Provider'));
    ctx.api.reply.complete();
    await ctx.fixture.whenStable();
    expect(ctx.navigateByUrl).toHaveBeenCalledWith('/prestador');
  });

  it('campos vazios não chamam a API', async () => {
    const ctx = await setup();
    submit(ctx.el);
    await ctx.fixture.whenStable();
    expect(ctx.api.requests).toEqual([]);
    expect(ctx.el.textContent).toContain('Campo obrigatório.');
  });
});
