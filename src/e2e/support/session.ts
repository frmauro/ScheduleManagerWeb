import { expect, type Page } from '@playwright/test';
import { STORAGE_KEYS } from '../../app/core/config/app.constants';
import type { Actor } from '../fixtures/factories';

/**
 * Injeta a sessão no `sessionStorage` antes de a página carregar, como se o usuário tivesse
 * entrado nesta aba (FR-018). Útil para cenários que não testam o login em si.
 */
export async function injectSession(page: Page, actor: Actor): Promise<void> {
  const value = JSON.stringify({
    accessToken: actor.auth.accessToken,
    expiresAt: actor.auth.expiresAt,
    user: actor.auth.user,
  });
  await page.addInitScript(
    ([key, session]) => {
      window.sessionStorage.setItem(key, session);
    },
    [STORAGE_KEYS.session, value] as const,
  );
}

/** Login pela interface (`/entrar`). */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}
