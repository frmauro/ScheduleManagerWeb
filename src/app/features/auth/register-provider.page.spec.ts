import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { AuthApi } from '../../core/api/auth.api';
import { SessionStore } from '../../core/auth/session.store';
import type { AuthResponse, RegisterProviderRequest } from '../../core/models/api-models';
import { authResponse, fill, problem, submit, visible } from './auth-test-helpers';
import { RegisterProviderPageComponent } from './register-provider.page';

class FakeAuthApi {
  readonly requests: RegisterProviderRequest[] = [];
  reply = new Subject<AuthResponse>();
  registerProvider(body: RegisterProviderRequest): Subject<AuthResponse> {
    this.requests.push(body);
    this.reply = new Subject<AuthResponse>();
    return this.reply;
  }
}

async function setup() {
  const api = new FakeAuthApi();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [{ path: 'cadastro/prestador', component: RegisterProviderPageComponent }],
        withComponentInputBinding(),
      ),
      { provide: AuthApi, useValue: api },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/cadastro/prestador', RegisterProviderPageComponent);
  const el = harness.routeNativeElement as HTMLElement;
  const router = TestBed.inject(Router);
  const stable = () => harness.fixture.whenStable();
  return { api, harness, el, router, stable };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

function currentStep(el: HTMLElement): string {
  return el.querySelector('[aria-current="step"]')?.textContent?.trim() ?? '';
}

async function next(ctx: Ctx): Promise<void> {
  submit(ctx.el);
  await ctx.stable();
}

async function fillAccount(ctx: Ctx): Promise<void> {
  fill(ctx.el, 'Nome completo', 'Bruno Prestador');
  fill(ctx.el, 'E-mail', 'bruno@example.com');
  fill(ctx.el, 'Senha', 'Senha12345');
  await next(ctx);
}

async function fillEstablishment(ctx: Ctx): Promise<void> {
  fill(ctx.el, 'Nome do estabelecimento', 'Barbearia do Bruno');
  fill(ctx.el, 'Categoria', 'Barbershop');
  fill(ctx.el, 'Telefone de contato', '11999998888');
  await next(ctx);
}

async function fillAddressAndSubmit(ctx: Ctx): Promise<void> {
  fill(ctx.el, 'CEP', '01001000');
  fill(ctx.el, 'Rua', 'Rua A');
  fill(ctx.el, 'Número', '10');
  fill(ctx.el, 'Bairro', 'Centro');
  fill(ctx.el, 'Cidade', 'São Paulo');
  fill(ctx.el, 'UF', 'SP');
  await next(ctx);
}

describe('RegisterProviderPage (FR-014, US2 #9)', () => {
  afterEach(() => TestBed.inject(SessionStore).clear());

  it('não avança com a etapa inválida', async () => {
    const ctx = await setup();
    expect(currentStep(ctx.el)).toContain('Conta');
    await next(ctx);
    expect(currentStep(ctx.el)).toContain('Conta');
    expect(ctx.el.textContent).toContain('Campo obrigatório.');
    expect(ctx.api.requests).toEqual([]);
  });

  it('avança Conta → Estabelecimento → Endereço e envia o cadastro completo', async () => {
    const ctx = await setup();
    await fillAccount(ctx);
    expect(currentStep(ctx.el)).toContain('Estabelecimento');
    await fillEstablishment(ctx);
    expect(currentStep(ctx.el)).toContain('Endereço');
    await fillAddressAndSubmit(ctx);

    expect(ctx.api.requests[0]).toMatchObject({
      email: 'bruno@example.com',
      category: 'Barbershop',
      contactEmail: 'bruno@example.com',
      contactPhone: '+5511999998888',
      timeZoneId: 'America/Sao_Paulo',
      address: { postalCode: '01001000', state: 'SP', complement: null },
    });
    const navigate = vi.spyOn(ctx.router, 'navigateByUrl').mockResolvedValue(true);
    ctx.api.reply.next(authResponse('Provider'));
    ctx.api.reply.complete();
    await ctx.stable();
    expect(navigate).toHaveBeenCalledWith('/prestador');
  });

  it('abrir ?etapa=endereco direto volta à primeira etapa inválida', async () => {
    const ctx = await setup();
    await ctx.harness.navigateByUrl('/cadastro/prestador?etapa=endereco');
    await ctx.stable();
    expect(currentStep(ctx.el)).toContain('Conta');
  });

  it('400 com errors["address.postalCode"] fica na etapa Endereço com o erro no CEP', async () => {
    const ctx = await setup();
    await fillAccount(ctx);
    await fillEstablishment(ctx);
    await fillAddressAndSubmit(ctx);
    ctx.api.reply.error(
      problem(400, 'validation.failed', { 'address.postalCode': ['CEP inválido.'] }),
    );
    await ctx.stable();
    expect(currentStep(ctx.el)).toContain('Endereço');
    expect(visible(ctx.el, '.sm-error')?.textContent).toContain('CEP inválido.');
  });

  it('409 user.email_taken volta à etapa Conta com o erro no e-mail', async () => {
    const ctx = await setup();
    await fillAccount(ctx);
    await fillEstablishment(ctx);
    await fillAddressAndSubmit(ctx);
    ctx.api.reply.error(problem(409, 'user.email_taken'));
    await ctx.stable();
    expect(currentStep(ctx.el)).toContain('Conta');
    const email = visible(ctx.el, 'input[type="email"]');
    expect(email?.getAttribute('aria-invalid')).toBe('true');
    expect(visible(ctx.el, '.sm-error')?.textContent).toContain('Este e-mail já está em uso.');
  });
});
