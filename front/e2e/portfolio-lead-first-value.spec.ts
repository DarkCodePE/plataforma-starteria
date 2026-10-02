import { expect, test } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || 'portfolio.e2e@starteria.test';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123';

test('portfolio lead entra autenticado a la única ruta First Value', async ({ page }) => {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).toHaveURL(/\/(dashboard|portfolio\/inicio)/, { timeout: 20_000 });

  await page.goto('/portfolio/setup');
  await expect(page).toHaveURL(/\/portfolio\/setup$/);
  await expect(page.getByTestId('portfolio-lead-first-value')).toBeVisible();
  await expect(page.getByRole('heading', { name: /organiza el trabajo alrededor de lo que quieres conseguir/i })).toBeVisible();
  await expect(page.getByLabel('Qué quieres conseguir')).toBeVisible();
});
