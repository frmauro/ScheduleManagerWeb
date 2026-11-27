import { expect, test, type Page } from '@playwright/test';
import type {
  AppointmentSummary,
  LocalDate,
  Page as ApiPage,
  Service,
} from '../app/core/models/api-models';
import {
  bookAppointment,
  createCustomer,
  createProvider,
  createService,
  DEFAULT_PASSWORD,
  getAvailability,
  nextWeekday,
  setWorkingHours,
  uniqueEmail,
  type Actor,
  type ProviderActor,
} from './fixtures/factories';
import { expectNoA11yViolations } from './support/a11y';
import { injectSession } from './support/session';

// US3 — reserva contra a API real: visitante → cadastro → resumo, status, idempotência e corrida.

interface Setup {
  readonly provider: ProviderActor;
  readonly service: Service;
  readonly date: LocalDate;
}

/** Prestador seg–sex 09:00–12:00/13:00–18:00, serviço de 30 min (passo padrão 15 min). */
async function providerWithService(autoConfirm = false): Promise<Setup> {
  const provider = await createProvider({ policy: { autoConfirm } });
  const service = await createService(provider, { durationMinutes: 30, price: 50 });
  await setWorkingHours(provider);
  return { provider, service, date: nextWeekday('Tuesday', provider.timeZoneId) };
}

/** Página do prestador → serviço/data → primeiro horário → resumo da reserva. */
async function openSummary(page: Page, { provider, service, date }: Setup): Promise<string> {
  await page.goto(`/prestadores/${provider.providerId}?servico=${service.id}&data=${date}`);
  await page.getByRole('button', { name: /^Reservar às 09:00/ }).click();
  await expect(page).toHaveURL(/\/agendar\?/);
  await expect(page.getByRole('heading', { name: 'Resumo da reserva' })).toBeVisible();
  return new URL(page.url()).searchParams.get('horario') ?? '';
}

function confirmButton(page: Page) {
  return page.getByRole('button', { name: 'Confirmar reserva' });
}

async function myAppointments(customer: Actor): Promise<ApiPage<AppointmentSummary>> {
  return customer.api.get<ApiPage<AppointmentSummary>>('/customers/me/appointments');
}

test('cenário 2: visitante → "Confirmar" → cadastro → volta ao mesmo resumo → reserva Pendente', async ({
  page,
}) => {
  const setup = await providerWithService(false);
  const startAt = await openSummary(page, setup);
  await expect(page.getByTestId('summary-service')).toHaveText(setup.service.name);
  await page.getByLabel('Observações').fill('Primeira vez no salão');

  await confirmButton(page).click();
  await expect(page).toHaveURL(/\/entrar\?returnUrl=/);
  await page.getByRole('link', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/cadastro\?returnUrl=/);
  await page.getByLabel('Nome completo').fill('Cliente da Reserva');
  await page.getByLabel('E-mail', { exact: true }).fill(uniqueEmail('reserva'));
  await page.getByLabel('Senha').fill(DEFAULT_PASSWORD);
  await page.getByLabel('Celular').fill('11988887777');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // De volta ao resumo, com as mesmas escolhas e o rascunho das observações.
  await expect(page).toHaveURL(/\/agendar\?/);
  expect(new URL(page.url()).searchParams.get('horario')).toBe(startAt);
  await expect(page.getByTestId('summary-provider')).toHaveText(setup.provider.displayName);
  await expect(page.getByLabel('Observações')).toHaveValue('Primeira vez no salão');

  await confirmButton(page).click();
  const success = page.getByTestId('booking-success');
  await expect(success).toContainText('aguardando confirmação do prestador');
  await expect(success).toContainText('Pendente');
  await expect(success.getByRole('link', { name: 'Ver agendamento' })).toBeVisible();
  await setup.provider.api.dispose();
});

test('cenário 3: com auto-confirmação → Confirmado; o horário e os sobrepostos somem', async ({
  page,
}) => {
  const setup = await providerWithService(true);
  const customer = await createCustomer();
  await injectSession(page, customer);
  const startAt = await openSummary(page, setup);
  await confirmButton(page).click();
  const success = page.getByTestId('booking-success');
  await expect(success).toContainText('Agendamento confirmado');
  await expect(success).toContainText('Confirmado');

  // 09:00 (reservado) e 09:15 (sobrepõe os 30 min) saíram; 09:30 continua livre.
  const after = await getAvailability(setup.provider.providerId, setup.service.id, setup.date);
  const starts = after.slots.map((s) => s.startAt);
  expect(starts).not.toContain(startAt);
  expect(starts.some((s) => s.includes('T09:15'))).toBe(false);
  expect(starts.some((s) => s.includes('T09:30'))).toBe(true);

  await page.goto(
    `/prestadores/${setup.provider.providerId}?servico=${setup.service.id}&data=${setup.date}`,
  );
  await expect(page.getByRole('button', { name: /^Reservar às 09:30/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Reservar às 09:00/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Reservar às 09:15/ })).toHaveCount(0);
  await customer.api.dispose();
  await setup.provider.api.dispose();
});

test('cenário 4: duplo clique e reenvio após falha de rede → exatamente um agendamento', async ({
  page,
}) => {
  const setup = await providerWithService(false);
  const customer = await createCustomer();
  await injectSession(page, customer);
  await openSummary(page, setup);

  // A primeira resposta se perde: a API cria, mas o navegador vê falha de rede.
  const keys: string[] = [];
  let first = true;
  await page.route('**/api/v1/appointments', async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (first) {
      first = false;
      await route.fetch();
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await confirmButton(page).dblclick();
  await expect(page.getByText('Não foi possível conectar.', { exact: false })).toBeVisible();
  await confirmButton(page).click();
  await expect(page.getByTestId('booking-success')).toBeVisible();
  await expect(page.getByTestId('booking-success')).toHaveCount(1);

  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(keys[1]).toBe(keys[0]);
  expect((await myAppointments(customer)).totalCount).toBe(1);
  await customer.api.dispose();
  await setup.provider.api.dispose();
});

test('cenário 5: outro cliente ocupa o horário antes → aviso e horários recarregados', async ({
  page,
}) => {
  const setup = await providerWithService(false);
  const customer = await createCustomer();
  const rival = await createCustomer();
  await injectSession(page, customer);
  const startAt = await openSummary(page, setup);

  await bookAppointment(rival, {
    providerId: setup.provider.providerId,
    serviceId: setup.service.id,
    startAt,
  });
  await confirmButton(page).click();

  await expect(page.getByText('Este horário acabou de ser ocupado. Escolha outro.')).toBeVisible();
  await expect(page).not.toHaveURL(/horario=/);
  const slots = page.getByRole('list', { name: 'Horários disponíveis' });
  await expect(slots.getByRole('button', { name: /^Reservar às 09:30/ })).toBeVisible();
  await expect(slots.getByRole('button', { name: /^Reservar às 09:00/ })).toHaveCount(0);
  expect((await myAppointments(customer)).totalCount).toBe(0);
  await customer.api.dispose();
  await rival.api.dispose();
  await setup.provider.api.dispose();
});

test('resumo sem violações de acessibilidade, inclusive em 360 px', async ({ page }) => {
  const setup = await providerWithService(false);
  const customer = await createCustomer();
  await injectSession(page, customer);
  await openSummary(page, setup);
  await expectNoA11yViolations(page);

  await page.setViewportSize({ width: 360, height: 740 });
  await expect(confirmButton(page)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expectNoA11yViolations(page);
  await customer.api.dispose();
  await setup.provider.api.dispose();
});
