import { expect, test, type Page } from '@playwright/test';
import {
  bookFirstSlot,
  createCustomer,
  createProvider,
  createService,
  DEFAULT_PASSWORD,
  nextWeekday,
  setWorkingHours,
  uniqueEmail,
  uniqueName,
} from './fixtures/factories';
import { expectNoA11yViolations } from './support/a11y';
import { injectSession } from './support/session';

// US4 — configuração do prestador contra a API real.

const WEEKDAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

async function registerProviderViaUi(page: Page): Promise<void> {
  await page.goto('/cadastro/prestador');
  await page.getByLabel('Nome completo').fill('Prestador Novo');
  await page.getByLabel('E-mail', { exact: true }).fill(uniqueEmail('setup'));
  await page.getByLabel('Senha').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Nome do estabelecimento').fill(uniqueName('Barbearia Nova'));
  await page.getByLabel('Categoria').selectOption({ label: 'Barbearia' });
  await page.getByLabel('Telefone de contato').fill('11999998888');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('CEP').fill('01001000');
  await page.getByLabel('Rua').fill('Rua dos Testes');
  await page.getByLabel('Número').fill('100');
  await page.getByLabel('Bairro').fill('Centro');
  await page.getByLabel('Cidade').fill('São Paulo');
  await page.getByLabel('UF').selectOption('SP');
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
}

function dayGroup(page: Page, day: string) {
  return page.getByRole('group', { name: day, exact: true });
}

async function setInterval(
  page: Page,
  day: string,
  n: number,
  start: string,
  end: string,
): Promise<void> {
  const interval = page.getByRole('group', { name: `${day}, faixa ${n}`, exact: true });
  await interval.getByLabel('Início').fill(start);
  await interval.getByLabel('Fim').fill(end);
}

test('cenário 8: checklist → serviço → expediente com almoço → checklist some e não há horários 12:00–13:00', async ({
  page,
}) => {
  test.slow(); // cadastro + serviço + 5 dias de expediente pela interface
  await registerProviderViaUi(page);
  await expect(page).toHaveURL(/\/prestador\/primeiros-passos$/);
  await expect(page.getByTestId('setup-progress')).toContainText('0 de 2');

  // Serviço "Corte" 30 min R$ 50,00.
  await page.getByRole('link', { name: 'Ir para serviços' }).click();
  await page.getByRole('button', { name: 'Novo serviço' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome', { exact: true }).fill('Corte');
  await dialog.getByLabel('Duração (minutos)').fill('30');
  await dialog.getByLabel('Preço (R$)').fill('50,00');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialog).toHaveCount(0);
  const item = page.getByTestId('service-item').filter({ hasText: 'Corte' });
  await expect(item).toContainText('30 min');
  await expect(item).toContainText('R$ 50,00');

  // Expediente seg–sex 09:00–12:00 e 13:00–18:00.
  await page.goto('/prestador/expediente');
  for (const day of WEEKDAYS) {
    const add = dayGroup(page, day).getByRole('button', { name: `Adicionar faixa — ${day}` });
    await add.click();
    await add.click();
    await setInterval(page, day, 1, '09:00', '12:00');
    await setInterval(page, day, 2, '13:00', '18:00');
  }
  await page.getByRole('button', { name: 'Salvar expediente' }).click();
  await expect(page.getByText('Expediente salvo.')).toBeVisible();

  // Checklist concluído: /prestador vai direto para a agenda.
  await page.goto('/prestador');
  await expect(page).toHaveURL(/\/prestador\/agenda$/);

  // Página pública numa segunda-feira: nenhum início entre 12:00 e 13:00.
  await page.goto('/prestador/estabelecimento');
  await page.getByRole('link', { name: 'Ver minha página pública' }).click();
  await page.getByRole('button', { name: 'Ver horários' }).click();
  await page.getByLabel('Data').fill(nextWeekday('Monday', 'America/Sao_Paulo'));
  await page.getByLabel('Data').dispatchEvent('change');
  const slots = page.getByRole('list', { name: 'Horários disponíveis' });
  await expect(slots.getByRole('button', { name: /^Reservar às 13:00/ })).toBeVisible();
  await expect(slots.getByRole('button', { name: /^Reservar às 11:30/ })).toBeVisible();
  await expect(slots.getByRole('button', { name: /^Reservar às 12:/ })).toHaveCount(0);
  await expect(slots.getByRole('button', { name: /^Reservar às 11:45/ })).toHaveCount(0);
});

test('cenário 9: faixa 11:00–14:00 sobreposta numa segunda → erro na faixa e nenhum PUT', async ({
  page,
}) => {
  const provider = await createProvider();
  await setWorkingHours(provider);
  await injectSession(page, provider);
  const puts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/schedule/working-hours')) {
      puts.push(request.url());
    }
  });

  await page.goto('/prestador/expediente');
  await setInterval(page, 'Segunda-feira', 2, '11:00', '14:00');
  await page.getByRole('button', { name: 'Salvar expediente' }).click();

  const second = page.getByRole('group', { name: 'Segunda-feira, faixa 2', exact: true });
  await expect(second.getByText('As faixas de horário não podem se sobrepor.')).toBeVisible();
  await expect(second.getByLabel('Início')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Revise as faixas destacadas antes de salvar.')).toBeVisible();
  expect(puts).toEqual([]);
  await expectNoA11yViolations(page);
  await provider.api.dispose();
});

test('cenário 10: fechamento cobrindo a data lista o agendamento afetado', async ({ page }) => {
  const provider = await createProvider();
  const service = await createService(provider);
  await setWorkingHours(provider);
  const customer = await createCustomer();
  const date = nextWeekday('Tuesday', provider.timeZoneId);
  await bookFirstSlot(customer, provider, service, date);
  await injectSession(page, provider);

  await page.goto('/prestador/excecoes');
  await page.getByRole('button', { name: 'Nova exceção' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tipo').selectOption({ label: 'Fechamento' });
  await dialog.getByLabel('Data inicial').fill(date);
  await dialog.getByLabel('Data final').fill(date);
  await dialog.getByLabel('Motivo').fill('Manutenção');
  await dialog.getByRole('button', { name: 'Salvar exceção' }).click();

  const panel = page.getByTestId('affected-panel');
  await expect(panel).toContainText('não foram cancelados automaticamente');
  await expect(panel.getByTestId('affected-appointment')).toHaveCount(1);
  await expect(panel).toContainText('Cliente E2E');
  await expect(page.getByTestId('exception-item').filter({ hasText: 'Manutenção' })).toBeVisible();
  await customer.api.dispose();
  await provider.api.dispose();
});

test('US4 #7: excluir serviço já agendado oferece desativar', async ({ page }) => {
  const provider = await createProvider();
  const service = await createService(provider, { name: uniqueName('Barba') });
  await setWorkingHours(provider);
  const customer = await createCustomer();
  await bookFirstSlot(customer, provider, service, nextWeekday('Wednesday', provider.timeZoneId));
  await injectSession(page, provider);

  await page.goto('/prestador/servicos');
  const item = page.getByTestId('service-item').filter({ hasText: service.name });
  await item.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();

  const offer = page.getByRole('dialog');
  await expect(offer).toContainText(
    'Este serviço já foi agendado e não pode ser excluído. Você pode desativá-lo.',
  );
  await offer.getByRole('button', { name: 'Desativar' }).click();
  await expect(item.getByTestId('service-status')).toHaveText('Inativo');
  await customer.api.dispose();
  await provider.api.dispose();
});
