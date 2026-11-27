import { expect, test, type Page } from '@playwright/test';
import {
  bookFirstSlot,
  createCustomer,
  createProvider,
  createService,
  minutesUntilMidnight,
  nextWeekday,
  setWorkingHours,
  setWorkingHoursCoveringNow,
} from './fixtures/factories';
import { expectNoA11yViolations } from './support/a11y';
import { injectSession } from './support/session';
import { todayInZone } from '../app/shared/time/zoned-time';

// US5 — gestão da agenda pelo prestador contra a API real.

const TZ = 'America/Sao_Paulo';
const CONFLICT = 'Este agendamento foi alterado por outra pessoa. Veja o status atual.';

function status(page: Page) {
  return page.getByTestId('appointment-status');
}

test('cenário 11: confirma um Pendente, "Concluir" só após o início e conclui', async ({
  page,
}) => {
  test.skip(minutesUntilMidnight(TZ) < 15, 'janela insuficiente antes da meia-noite');
  const provider = await createProvider({
    timeZoneId: TZ,
    policy: { slotStepMinutes: 5, minBookingNoticeMinutes: 0 },
  });
  const service = await createService(provider);
  await setWorkingHoursCoveringNow(provider);
  const customer = await createCustomer();
  const appointment = await bookFirstSlot(customer, provider, service, todayInZone(TZ));
  // Espera até o início (≤ 5 min com passo de 5) + folga para o relógio do detalhe (15 s).
  const waitMs = Math.max(0, Date.parse(appointment.startAt) - Date.now());
  test.slow();
  test.setTimeout(waitMs + 3 * 60_000);
  await injectSession(page, provider);

  // A agenda do dia mostra o pendente destacado e leva ao detalhe.
  await page.goto('/prestador/agenda?visao=dia');
  const item = page.locator(`[data-testid="agenda-appointment"][data-status="Pending"]`);
  await expect(item).toContainText('Pendente');
  await expect(page.getByTestId('agenda-summary')).toContainText('1 agendamento aguardando');
  await expectNoA11yViolations(page);
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/prestador/agendamentos/${appointment.id}$`));

  await expect(status(page)).toContainText('Pendente');
  await expect(page.getByTestId('appointment-customer')).toContainText('Cliente E2E');
  await expect(page.getByTestId('appointment-customer')).toContainText('@');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(status(page)).toContainText('Confirmado');
  await expect(
    page.getByTestId('history-entry').filter({ hasText: 'Pendente → Confirmado' }),
  ).toBeVisible();

  if (Date.now() < Date.parse(appointment.startAt)) {
    await expect(page.getByRole('button', { name: 'Concluir' })).toHaveCount(0);
    await expect(page.getByTestId('complete-hint')).toBeVisible();
  }
  await expectNoA11yViolations(page);

  const remaining = Math.max(0, Date.parse(appointment.startAt) - Date.now());
  await page.waitForTimeout(remaining + 1_000);
  const complete = page.getByRole('button', { name: 'Concluir' });
  await expect(complete).toBeVisible({ timeout: 30_000 });
  await complete.click();
  await expect(status(page)).toContainText('Concluído');
  await expect(
    page.getByTestId('history-entry').filter({ hasText: 'Confirmado → Concluído' }),
  ).toBeVisible();

  await customer.api.dispose();
  await provider.api.dispose();
});

test('cenário 12: duas abas — cancela na primeira, confirmar na segunda avisa o conflito', async ({
  page,
  context,
}) => {
  const provider = await createProvider({ timeZoneId: TZ });
  const service = await createService(provider);
  await setWorkingHours(provider);
  const customer = await createCustomer();
  const appointment = await bookFirstSlot(customer, provider, service, nextWeekday('Thursday', TZ));
  await injectSession(page, provider);
  const second = await context.newPage();
  await injectSession(second, provider);

  const url = `/prestador/agendamentos/${appointment.id}`;
  await page.goto(url);
  await second.goto(url);
  await expect(status(page)).toContainText('Pendente');
  await expect(status(second)).toContainText('Pendente');

  await page.getByRole('button', { name: 'Cancelar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Motivo do cancelamento').fill('Imprevisto no estabelecimento');
  await expectNoA11yViolations(page);
  await dialog.getByRole('button', { name: 'Cancelar agendamento' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(status(page)).toContainText('Cancelado pelo prestador');

  await second.getByRole('button', { name: 'Confirmar' }).click();
  await expect(second.getByTestId('action-notice')).toHaveText(CONFLICT);
  await expect(status(second)).toContainText('Cancelado pelo prestador');
  await expect(second.getByRole('button', { name: 'Confirmar' })).toHaveCount(0);

  await second.close();
  await customer.api.dispose();
  await provider.api.dispose();
});

test('agenda: semana com filtro de status e lista paginada sem violações', async ({ page }) => {
  const provider = await createProvider({ timeZoneId: TZ });
  const service = await createService(provider);
  await setWorkingHours(provider);
  const customer = await createCustomer();
  const date = nextWeekday('Tuesday', TZ);
  await bookFirstSlot(customer, provider, service, date);
  await injectSession(page, provider);

  await page.goto(`/prestador/agenda?visao=semana&data=${date}`);
  await expect(page.getByTestId('agenda-appointment')).toHaveCount(1);
  await expectNoA11yViolations(page);

  await page.getByLabel('Confirmado').check();
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/status=Confirmed/);
  await expect(page.getByTestId('agenda-appointment')).toHaveCount(0);
  await expect(page.getByTestId('agenda-summary')).toContainText('Nenhum agendamento');

  await page.getByRole('tab', { name: 'Lista' }).click();
  await page.getByLabel('Confirmado').uncheck();
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByTestId('agenda-item')).toHaveCount(1);
  await expect(page.getByTestId('agenda-item')).toContainText('Pendente');
  await expectNoA11yViolations(page);

  await customer.api.dispose();
  await provider.api.dispose();
});
