import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PASSWORD, uniqueEmail, uniqueName } from './fixtures/factories';
import { expectNoA11yViolations } from './support/a11y';

// US2 — validação: erros do servidor nos campos certos e acessibilidade dos formulários.

async function fillProviderWizard(page: Page): Promise<void> {
  await page.goto('/cadastro/prestador');
  await page.getByLabel('Nome completo').fill('Prestador E2E');
  await page.getByLabel('E-mail', { exact: true }).fill(uniqueEmail('wizard'));
  await page.getByLabel('Senha').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Nome do estabelecimento').fill(uniqueName('Estúdio'));
  await page.getByLabel('Categoria').selectOption({ label: 'Beleza' });
  await page.getByLabel('Telefone de contato').fill('11999998888');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('CEP').fill('01001000');
  await page.getByLabel('Rua').fill('Rua dos Testes');
  await page.getByLabel('Número').fill('100');
  await page.getByLabel('Bairro').fill('Centro');
  await page.getByLabel('Cidade').fill('São Paulo');
  await page.getByLabel('UF').selectOption('SP');
}

test('cenário 17: 400 da API real aparece no campo CEP da etapa Endereço', async ({ page }) => {
  // Burla a validação do navegador para a API real responder 400 validation.failed.
  await page.route('**/api/v1/auth/register/provider', async (route) => {
    const body = route.request().postDataJSON() as { address: { postalCode: string } };
    body.address.postalCode = '123';
    await route.continue({ postData: JSON.stringify(body) });
  });

  await fillProviderWizard(page);
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();

  const cep = page.getByLabel('CEP');
  await expect(cep).toHaveAttribute('aria-invalid', 'true');
  const errorId = (await cep.getAttribute('aria-describedby')) ?? '';
  await expect(page.locator(`[id="${errorId.split(' ').at(-1) ?? ''}"]`)).not.toBeEmpty();
  await expect(page.locator('[aria-current="step"]')).toContainText('Endereço');
  await expect(page).toHaveURL(/\/cadastro\/prestador/);
});

test('cadastro de prestador completo leva aos primeiros passos (FR-037)', async ({ page }) => {
  await fillProviderWizard(page);
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(page).toHaveURL(/\/prestador\/primeiros-passos$/);
});

for (const path of ['/entrar', '/cadastro', '/cadastro/prestador']) {
  test(`${path} sem violações de acessibilidade`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  });
}

test('etapa inválida mostra os erros sem avançar', async ({ page }) => {
  await page.goto('/cadastro/prestador');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('[aria-current="step"]')).toContainText('Conta');
  await expect(page.getByLabel('Nome completo')).toHaveAttribute('aria-invalid', 'true');
  await expectNoA11yViolations(page);
});
