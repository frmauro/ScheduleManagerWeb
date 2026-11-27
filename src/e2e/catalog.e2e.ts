import { expect, test, type Page } from '@playwright/test';
import {
  createProvider,
  createService,
  nextWeekday,
  setWorkingHours,
  uniqueName,
  type ProviderActor,
} from './fixtures/factories';
import { expectNoA11yViolations } from './support/a11y';

// US1 — vitrine pública (visitante, sem sessão), com dados criados na API real.

const CITY = uniqueName('Cidade E2E');
let manaus: ProviderActor;
let serviceName: string;
let beautyName: string;

test.beforeAll(async () => {
  manaus = await createProvider({
    timeZoneId: 'America/Manaus',
    category: 'Barbershop',
    city: CITY,
    state: 'AM',
  });
  const service = await createService(manaus, { name: uniqueName('Corte'), durationMinutes: 30 });
  serviceName = service.name;
  await setWorkingHours(manaus); // seg–sex 09:00–12:00 e 13:00–18:00
  // Outro prestador na mesma cidade, de outra categoria, para provar o filtro.
  const beauty = await createProvider({ category: 'Beauty', city: CITY, state: 'AM' });
  beautyName = beauty.displayName;
  await beauty.api.dispose();
});

test.afterAll(async () => {
  await manaus.api.dispose();
});

async function search(page: Page, category: string, city: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Categoria').selectOption({ label: category });
  await page.getByLabel('Cidade').fill(city);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test('cenário 1: filtra, abre o prestador de Manaus e vê horários no fuso dele', async ({
  page,
}) => {
  await search(page, 'Barbearia', CITY);
  await expect(page).toHaveURL(/categoria=Barbershop/);
  const results = page.getByRole('link', { name: new RegExp(manaus.displayName) });
  await expect(results).toHaveCount(1);
  await expect(page.getByRole('link', { name: new RegExp(beautyName) })).toHaveCount(0);
  await expectNoA11yViolations(page);

  await results.click();
  await expect(page.getByRole('heading', { level: 1, name: manaus.displayName })).toBeVisible();
  await expect(page.getByText(/Horário de Manaus/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Ver horários' }).click();
  await page.getByLabel('Data').fill(nextWeekday('Monday', manaus.timeZoneId));
  await page.getByLabel('Data').dispatchEvent('change');

  const slots = page.getByRole('list', { name: 'Horários disponíveis' });
  // 09:00 em Manaus (o navegador dos testes está em São Paulo, onde seriam 10:00).
  await expect(slots.getByRole('button').first()).toHaveText('09:00');
  await expect(
    page.getByRole('heading', { name: `Horários livres para ${serviceName}` }),
  ).toBeVisible();
  await expectNoA11yViolations(page);
});

test('US1 #2: os filtros sobrevivem a recarregar e a voltar', async ({ page }) => {
  await search(page, 'Barbearia', CITY);
  await page.reload();
  await expect(page.getByLabel('Categoria')).toHaveValue('Barbershop');
  await expect(page.getByLabel('Cidade')).toHaveValue(CITY);

  await page.getByRole('link', { name: new RegExp(manaus.displayName) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Cidade')).toHaveValue(CITY);
  await expect(page.getByRole('link', { name: new RegExp(manaus.displayName) })).toBeVisible();
});

test('cenário 6: data sem expediente mostra "Sem horários nesta data", sem erro', async ({
  page,
}) => {
  const services = await manaus.api.get<{ items: { id: string }[] }>(
    `/providers/${manaus.providerId}/services`,
  );
  const serviceId = services.items[0]?.id ?? '';
  const sunday = nextWeekday('Sunday', manaus.timeZoneId);
  await page.goto(`/prestadores/${manaus.providerId}?servico=${serviceId}&data=${sunday}`);
  await expect(page.getByText('Sem horários nesta data — escolha outra data')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('US1 #6: prestador inexistente mostra a página não encontrada', async ({ page }) => {
  await page.goto('/prestadores/00000000-0000-0000-0000-000000000000');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para a busca' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('US1 #7: busca sem resultado oferece "Limpar filtros"', async ({ page }) => {
  await page.goto(`/?q=${encodeURIComponent(uniqueName('inexistente'))}`);
  await expect(page.getByText('Nenhum prestador encontrado')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Limpar filtros' }).first().click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByLabel('Nome do estabelecimento')).toHaveValue('');
});
