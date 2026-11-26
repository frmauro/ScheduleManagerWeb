import { expect, test } from '@playwright/test';
import {
  bookFirstSlot,
  createCustomer,
  createProvider,
  createService,
  getAvailability,
  loginAsAdmin,
  nextWeekday,
  setWorkingHours,
  setWorkingHoursCoveringNow,
} from './fixtures/factories';
import { injectSession } from './support/session';

// Valida as fixtures E2E contra a API real (exige API + PostgreSQL rodando, quickstart §2)
// e o ciclo de sessão do shell (GET /auth/me via proxy, guards de perfil).

test.describe('fixtures contra a API real', () => {
  test('prestador com serviço e expediente gera horários e aceita reserva', async () => {
    const provider = await createProvider({ policy: { autoConfirm: true } });
    expect(provider.providerId).not.toBe('');
    const service = await createService(provider);
    await setWorkingHours(provider);

    const monday = nextWeekday('Monday', provider.timeZoneId);
    const availability = await getAvailability(provider.providerId, service.id, monday);
    expect(availability.timeZoneId).toBe(provider.timeZoneId);
    expect(availability.slots.length).toBeGreaterThan(0);
    // 09:00 no fuso do prestador (São Paulo, -03:00).
    expect(availability.slots[0]?.startAt).toMatch(/T09:00:00-03:00$/);

    const customer = await createCustomer();
    const appointment = await bookFirstSlot(customer, provider, service, monday);
    expect(appointment.status).toBe('Confirmed');
    expect(appointment.startAt).toBe(availability.slots[0]?.startAt);

    const after = await getAvailability(provider.providerId, service.id, monday);
    expect(after.slots.map((s) => s.startAt)).not.toContain(appointment.startAt);

    await Promise.all([provider.api.dispose(), customer.api.dispose()]);
  });

  test('expediente "cobrindo agora" e fuso diferente do navegador', async () => {
    const provider = await createProvider({ timeZoneId: 'America/Manaus' });
    const service = await createService(provider, { durationMinutes: 60 });
    await setWorkingHoursCoveringNow(provider);
    const date = nextWeekday('Wednesday', provider.timeZoneId);
    const availability = await getAvailability(provider.providerId, service.id, date);
    expect(availability.timeZoneId).toBe('America/Manaus');
    expect(availability.slots[0]?.startAt).toMatch(/T00:00:00-04:00$/);
    await provider.api.dispose();
  });

  test('admin provisionado consegue entrar', async () => {
    const admin = await loginAsAdmin();
    expect(admin.auth.user.role).toBe('Admin');
    await admin.api.dispose();
  });
});

test.describe('sessão injetada no shell', () => {
  test('cliente vê a navegação do perfil e entra na própria área', async ({ page }) => {
    const customer = await createCustomer();
    await injectSession(page, customer);
    await page.goto('/cliente/agendamentos');
    await expect(page).toHaveURL(/\/cliente\/agendamentos$/);
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link', { name: 'Meus agendamentos' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Sair' })).toBeAttached();
    await customer.api.dispose();
  });

  test('prestador que abre a área do cliente cai em "Você não tem permissão"', async ({ page }) => {
    const provider = await createProvider();
    await injectSession(page, provider);
    await page.goto('/cliente/agendamentos');
    await expect(page.getByRole('heading', { name: 'Você não tem permissão' })).toBeVisible();
    await provider.api.dispose();
  });

  test('token inválido é descartado na inicialização (sessão expirada)', async ({ page }) => {
    const customer = await createCustomer();
    await injectSession(page, {
      ...customer,
      auth: { ...customer.auth, accessToken: 'token-invalido' },
    });
    await page.goto('/cliente/agendamentos');
    await expect(page).toHaveURL(/\/entrar\?/);
    await customer.api.dispose();
  });
});
