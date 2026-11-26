import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';

// Checkpoint da Fase 2 (Base comum): não depende da API (visitante, sem sessão).

test('o shell carrega em pt-BR com o cabeçalho de visitante', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('main#conteudo')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  for (const label of ['Buscar', 'Entrar', 'Cadastrar-se', 'Sou prestador']) {
    await expect(nav.getByRole('link', { name: label })).toBeAttached();
  }
});

test('rota protegida sem sessão leva ao login com returnUrl', async ({ page }) => {
  await page.goto('/cliente/agendamentos?aba=historico');
  await expect(page).toHaveURL(/\/entrar\?returnUrl=%2Fcliente%2Fagendamentos%3Faba%3Dhistorico$/);
});

test('caminho inexistente mostra "Página não encontrada" sem violações de acessibilidade', async ({
  page,
}) => {
  await page.goto('/nao-existe');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar para a busca' })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('link "Pular para o conteúdo" é o primeiro item focável', async ({ page }) => {
  await page.goto('/nao-existe');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
});
