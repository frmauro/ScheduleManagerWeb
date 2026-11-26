import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Auditoria automática WCAG 2.1 A/AA nas telas críticas (SC-009). */
export async function expectNoA11yViolations(
  page: Page,
  exclude: readonly string[] = [],
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const selector of exclude) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, 'violações de acessibilidade').toEqual([]);
}
