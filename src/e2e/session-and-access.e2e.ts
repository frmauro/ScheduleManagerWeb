import { expect, test, type Page } from '@playwright/test';
import { createCustomer, DEFAULT_PASSWORD, uniqueEmail } from './fixtures/factories';
import { loginViaUi } from './support/session';

// US2 — cadastro, login, sessão de 60 min e acesso por perfil, contra a API real.

const MINUTE = 60_000;

async function registerCustomerViaUi(page: Page, email: string): Promise<void> {
  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill('Cliente E2E');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha').fill(DEFAULT_PASSWORD);
  await page.getByLabel('Celular').fill('11988887777');
  await page.getByRole('button', { name: 'Criar conta' }).click();
}

test('US2 #1: cadastro de cliente entra direto em "Meus agendamentos"', async ({ page }) => {
  await registerCustomerViaUi(page, uniqueEmail('cadastro'));
  await expect(page).toHaveURL(/\/cliente\/agendamentos$/);
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
});

test('US2 #3: e-mail já usado (em maiúsculas) mostra "Este e-mail já está em uso"', async ({
  page,
}) => {
  const existing = await createCustomer();
  await registerCustomerViaUi(page, existing.email.toUpperCase());
  await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible();
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/cadastro$/);
  await existing.api.dispose();
});

test('cenário 13: aviso aos 55 min, expiração aos 60 min e volta à página após entrar', async ({
  page,
}) => {
  const customer = await createCustomer();
  const realNow = Date.now();
  await page.clock.install({ time: realNow });

  await loginViaUi(page, customer.email, customer.password);
  const original = '/cliente/agendamentos?aba=historico';
  await page.goto(original);
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

  await page.clock.fastForward(55 * MINUTE);
  await expect(page.getByTestId('session-warning')).toContainText(
    'Sua sessão expira em 5 min — salve seu trabalho.',
  );

  await page.clock.fastForward(5 * MINUTE + 1_000);
  await expect(page).toHaveURL(
    /\/entrar\?returnUrl=%2Fcliente%2Fagendamentos%3Faba%3Dhistorico&motivo=sessao-expirada$/,
  );
  await expect(page.getByText('Sua sessão expirou. Entre novamente.')).toBeVisible();

  // O novo token vem da API com o relógio real: o navegador volta a ele antes de entrar.
  await page.clock.setSystemTime(Date.now() > realNow ? Date.now() : realNow);
  await page.getByLabel('E-mail').fill(customer.email);
  await page.getByLabel('Senha').fill(customer.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(`${original.replace('?', '\\?')}$`));
  await customer.api.dispose();
});

test('US2 #6 e #7: recarregar mantém a sessão e "Sair" volta à vitrine', async ({ page }) => {
  const customer = await createCustomer();
  await loginViaUi(page, customer.email, customer.password);
  await expect(page).toHaveURL(/\/cliente\/agendamentos$/);

  await page.reload();
  await expect(page).toHaveURL(/\/cliente\/agendamentos$/);
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$/);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByRole('link', { name: 'Entrar' })).toBeVisible();

  // Depois de sair, a área do cliente volta a exigir login.
  await page.goto('/cliente/agendamentos');
  await expect(page).toHaveURL(/\/entrar\?returnUrl=/);
  await customer.api.dispose();
});

test('cenário 14: cliente em /prestador/agenda vai para "Sem permissão"', async ({ page }) => {
  const customer = await createCustomer();
  await loginViaUi(page, customer.email, customer.password);
  await page.goto('/prestador/agenda');
  await expect(page).toHaveURL(/\/sem-permissao$/);
  await expect(page.getByRole('heading', { name: 'Você não tem permissão' })).toBeVisible();
  await customer.api.dispose();
});

test('logado, /entrar leva à home do perfil (guestGuard)', async ({ page }) => {
  const customer = await createCustomer();
  await loginViaUi(page, customer.email, customer.password);
  await page.goto('/entrar');
  await expect(page).toHaveURL(/\/cliente\/agendamentos$/);
  await customer.api.dispose();
});
