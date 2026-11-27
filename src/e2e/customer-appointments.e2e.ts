import { expect, test, type Page } from '@playwright/test';
import type { Appointment } from '../app/core/models/api-models';
import { addDays, todayInZone } from '../app/shared/time/zoned-time';
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

// US6 — área do cliente contra a API real.

const TZ = 'America/Sao_Paulo';
const NOTICE = 'Cancelamentos estão sujeitos à antecedência mínima definida pelo prestador.';

function status(page: Page) {
  return page.getByTestId('appointment-status');
}

async function cancelWithReason(page: Page, reason: string): Promise<void> {
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('cancel-customer-notice')).toHaveText(NOTICE);
  await dialog.getByLabel('Motivo do cancelamento').fill(reason);
  await dialog.getByRole('button', { name: 'Cancelar agendamento' }).click();
}

test('cenário 7: cancela com antecedência; dentro da janela a recusa explica a política', async ({
  page,
}) => {
  test.skip(minutesUntilMidnight(TZ) < 15, 'janela insuficiente antes da meia-noite');
  const provider = await createProvider({
    timeZoneId: TZ,
    policy: {
      slotStepMinutes: 5,
      minBookingNoticeMinutes: 0,
      minCancellationNoticeMinutes: 120,
    },
  });
  const service = await createService(provider);
  await setWorkingHoursCoveringNow(provider);
  const customer = await createCustomer();
  const later = await bookFirstSlot(customer, provider, service, addDays(todayInZone(TZ), 3));
  const soon = await bookFirstSlot(customer, provider, service, todayInZone(TZ));
  await injectSession(page, customer);

  // "Próximos": os dois, do mais próximo ao mais distante.
  await page.goto('/cliente/agendamentos');
  const items = page.getByTestId('my-appointment');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText(provider.displayName);
  await expectNoA11yViolations(page);

  // Com antecedência suficiente: cancela com motivo.
  await page.goto(`/cliente/agendamentos/${later.id}`);
  await expect(page.getByText(NOTICE).first()).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expectNoA11yViolations(page);
  await page.getByRole('dialog').getByLabel('Motivo do cancelamento').fill('Viagem');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar agendamento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(status(page)).toContainText('Cancelado pelo cliente');

  // Dentro da janela mínima: "Cancelar" visível com o aviso; a recusa mantém o agendamento.
  await page.goto(`/cliente/agendamentos/${soon.id}`);
  await expect(page.getByText(NOTICE).first()).toBeVisible();
  await cancelWithReason(page, 'Imprevisto');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('exige antecedência mínima');
  await dialog.getByRole('button', { name: 'Manter agendamento' }).click();
  await expect(status(page)).toContainText('Pendente');
  await expect(page.getByTestId('provider-contacts')).toContainText('+5511999998888');
  const current = await customer.api.get<Appointment>(`/appointments/${soon.id}`);
  expect(current.status).toBe('Pending');

  await customer.api.dispose();
  await provider.api.dispose();
});

test('reagendar: escolhe o novo horário, cancela o atual e reserva o novo', async ({ page }) => {
  const provider = await createProvider({ timeZoneId: TZ });
  const service = await createService(provider);
  await setWorkingHours(provider);
  const customer = await createCustomer();
  const original = await bookFirstSlot(customer, provider, service, nextWeekday('Tuesday', TZ));
  await injectSession(page, customer);

  await page.goto(`/cliente/agendamentos/${original.id}`);
  await page.getByRole('link', { name: 'Reagendar' }).click();
  await expect(page).toHaveURL(new RegExp(`reagendar=${original.id}`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reagendar');

  await page.getByLabel('Data').fill(nextWeekday('Wednesday', TZ));
  await page.getByLabel('Data').dispatchEvent('change');
  await page.getByRole('button', { name: /^Reservar às 10:00/ }).click();
  await expect(page.getByTestId('summary-current')).toBeVisible();
  await expect(page.getByTestId('reschedule-notice')).toContainText(
    'o horário atual será cancelado primeiro',
  );
  await expect(page.getByLabel('Motivo do cancelamento do horário atual')).toHaveValue(
    'Reagendamento solicitado pelo cliente',
  );
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Confirmar reagendamento' }).click();

  await expect(page.getByTestId('booking-success')).toBeVisible();
  const old = await customer.api.get<Appointment>(`/appointments/${original.id}`);
  expect(old.status).toBe('CancelledByCustomer');
  expect(old.cancellationReason).toBe('Reagendamento solicitado pelo cliente');

  await customer.api.dispose();
  await provider.api.dispose();
});

test('US6 #6: perfil com e-mail de outra conta → erro no campo e-mail', async ({ page }) => {
  const customer = await createCustomer();
  const other = await createCustomer();
  await injectSession(page, customer);

  await page.goto('/cliente/perfil');
  const email = page.getByLabel('E-mail');
  await expect(email).toHaveValue(customer.email);
  await email.fill(other.email);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible();

  // Nome novo é salvo e aparece no cabeçalho.
  await email.fill(customer.email);
  await page.getByLabel('Nome completo').fill('Cliente Renomeado');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Perfil atualizado.')).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Cliente Renomeado');
  await expectNoA11yViolations(page);

  await customer.api.dispose();
  await other.api.dispose();
});
