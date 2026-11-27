import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Component, DEFAULT_CURRENCY_CODE, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, type Observable } from 'rxjs';
import { AppointmentsApi } from '../../core/api/appointments.api';
import { ProvidersApi } from '../../core/api/providers.api';
import { ServicesApi } from '../../core/api/services.api';
import { SessionStore } from '../../core/auth/session.store';
import type {
  AvailabilityResponse,
  Page,
  ProviderPublicProfile,
  Service,
} from '../../core/models/api-models';
import type { Role } from '../../core/models/enums';
import { authResponse, fill, problem, submit } from '../auth/auth-test-helpers';
import { FakeAppointmentsApi, OTHER_START_AT, START_AT } from './booking-test-helpers';
import { BookingPageComponent } from './booking.page';

const PROVIDER: ProviderPublicProfile = {
  id: 'p1',
  displayName: 'Barbearia do Bruno',
  description: null,
  category: 'Barbershop',
  contactPhone: '+5511999998888',
  address: {
    street: 'Rua A',
    number: '10',
    complement: null,
    district: 'Centro',
    city: 'Manaus',
    state: 'AM',
    postalCode: '69000000',
  },
  timeZoneId: 'America/Manaus',
};

const SERVICE: Service = {
  id: 's1',
  providerId: 'p1',
  name: 'Corte masculino',
  description: null,
  durationMinutes: 30,
  price: 50,
  isActive: true,
};

class FakeProvidersApi {
  availabilityCalls = 0;
  getPublic(): Observable<ProviderPublicProfile> {
    return of(PROVIDER);
  }
  availability(): Observable<AvailabilityResponse> {
    this.availabilityCalls += 1;
    return of({
      providerId: 'p1',
      serviceId: 's1',
      date: '2026-12-01',
      timeZoneId: 'America/Manaus',
      durationMinutes: 30,
      slots: [{ startAt: OTHER_START_AT, endAt: '2026-12-01T10:00:00-04:00' }],
    });
  }
}

class FakeServicesApi {
  listPublic(): Observable<Page<Service>> {
    return of({ items: [SERVICE], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
  }
}

@Component({ standalone: true, template: 'login' })
class LoginStubComponent {}

const BOOKING_URL = `/prestadores/p1/agendar?servico=s1&data=2026-12-01&horario=${encodeURIComponent(START_AT)}`;

registerLocaleData(localePt);

async function setup(role: Role | null = 'Customer') {
  const appointments = new FakeAppointmentsApi();
  const providers = new FakeProvidersApi();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'prestadores/:providerId/agendar', component: BookingPageComponent },
          { path: 'entrar', component: LoginStubComponent },
        ],
        withComponentInputBinding(),
      ),
      { provide: AppointmentsApi, useValue: appointments },
      { provide: ProvidersApi, useValue: providers },
      { provide: ServicesApi, useValue: new FakeServicesApi() },
      { provide: LOCALE_ID, useValue: 'pt-BR' },
      { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    ],
  });
  if (role) {
    TestBed.inject(SessionStore).start(authResponse(role));
  }
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(BOOKING_URL, BookingPageComponent);
  await harness.fixture.whenStable();
  const el = harness.routeNativeElement as HTMLElement;
  const router = TestBed.inject(Router);
  const stable = () => harness.fixture.whenStable();
  return { appointments, providers, harness, el, router, stable };
}

function confirmButton(el: HTMLElement): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>('button[type="submit"]');
}

describe('BookingPage (FR-024–FR-030, US3)', () => {
  afterEach(() => {
    TestBed.inject(SessionStore).clear();
    sessionStorage.clear();
  });

  it('o resumo mostra prestador, serviço, duração, preço, data/hora no fuso do prestador e observações', async () => {
    const { el } = await setup();
    const text = (id: string) =>
      el.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text('summary-provider')).toBe('Barbearia do Bruno');
    expect(text('summary-service')).toBe('Corte masculino');
    expect(text('summary-duration')).toBe('30 min');
    expect(text('summary-price')).toMatch(/^R\$\s50,00$/);
    expect(text('summary-when')).toContain('01/12/2026 09:00');
    expect(el.querySelector('textarea')).not.toBeNull();
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Revise e confirme');
  });

  it('envia o startAt do slot intacto e mostra o sucesso Confirmado', async () => {
    const ctx = await setup();
    fill(ctx.el, 'Observações', 'Chego 5 min antes');
    submit(ctx.el);
    await ctx.stable();
    expect(ctx.appointments.last().body).toMatchObject({
      providerId: 'p1',
      serviceId: 's1',
      startAt: START_AT,
      notes: 'Chego 5 min antes',
    });
    ctx.appointments.succeed('Confirmed');
    await ctx.stable();
    expect(ctx.el.querySelector('[data-testid="booking-success"]')?.textContent).toContain(
      'Agendamento confirmado',
    );
  });

  it('observações com mais de 500 caracteres bloqueiam o envio e mostram o limite (US3 #8)', async () => {
    const ctx = await setup();
    fill(ctx.el, 'Observações', 'a'.repeat(501));
    await ctx.stable();
    submit(ctx.el);
    await ctx.stable();
    expect(ctx.appointments.calls).toHaveLength(0);
    expect(ctx.el.textContent).toContain('Use no máximo 500 caracteres.');
    expect(ctx.el.querySelector('[data-testid="notes-counter"]')?.textContent).toContain('501/500');
  });

  it('visitante em "Confirmar" vai para /entrar?returnUrl=<url da reserva> sem chamar a API', async () => {
    const ctx = await setup(null);
    expect(ctx.el.querySelector('[data-testid="login-notice"]')).not.toBeNull();
    const reservationUrl = ctx.router.url;
    submit(ctx.el);
    await ctx.stable();
    expect(ctx.appointments.calls).toHaveLength(0);
    const tree = ctx.router.parseUrl(ctx.router.url);
    expect(ctx.router.url.startsWith('/entrar?')).toBe(true);
    expect(tree.queryParams['returnUrl']).toBe(reservationUrl);
    expect(reservationUrl).toContain('/prestadores/p1/agendar?servico=s1');
  });

  it('o botão fica desabilitado durante o envio', async () => {
    const ctx = await setup();
    submit(ctx.el);
    await ctx.stable();
    expect(confirmButton(ctx.el)?.disabled).toBe(true);
    expect(confirmButton(ctx.el)?.getAttribute('aria-busy')).toBe('true');
    submit(ctx.el);
    expect(ctx.appointments.calls).toHaveLength(1);
  });

  it('409 slot_unavailable: avisa, tira o horário da URL e recarrega os horários', async () => {
    const ctx = await setup();
    const before = ctx.providers.availabilityCalls;
    submit(ctx.el);
    await ctx.stable();
    ctx.appointments.last().reply.error(problem(409, 'appointment.slot_unavailable'));
    await ctx.stable();
    expect(ctx.router.url).not.toContain('horario=');
    expect(ctx.el.textContent).toContain('Este horário acabou de ser ocupado. Escolha outro.');
    expect(ctx.providers.availabilityCalls).toBeGreaterThan(before);
    expect(ctx.el.querySelector('[aria-label="Horários disponíveis"]')).not.toBeNull();
  });

  it('sessão de prestador não pode reservar', async () => {
    const ctx = await setup('Provider');
    expect(ctx.el.textContent).toContain('Somente clientes podem fazer reservas.');
    expect(confirmButton(ctx.el)?.disabled).toBe(true);
  });
});
