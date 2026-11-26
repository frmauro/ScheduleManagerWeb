import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra a API real em desenvolvimento (SC-005, research R4).
 * Pré-requisito: API no ar em https://localhost:7154 (quickstart §2).
 */
export default defineConfig({
  testDir: 'src/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
