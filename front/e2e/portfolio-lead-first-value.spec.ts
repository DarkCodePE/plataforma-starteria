import { test, expect, type Page } from '@playwright/test';

async function mockPortfolioLead(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('starteria.demo.enabled', 'true'));
  await page.route('**/api/v1/**', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
  await page.route('**/api/v1/auth/refresh', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: 'slice-a-token' } }) }));
  await page.route('**/api/v1/auth/me', async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'slice-a-portfolio-lead', name: 'Ana Portfolio', email: 'ana@starteria.test', role: 'portfolio_lead', roles: ['portfolio_lead'], permissions: ['portfolio:read', 'portfolio:write'], initials: 'AP' } }) }));
}

test.describe('Portfolio Lead Slice A — First Value', () => {
  test('P0 → P3 presents a narrative reading without technical labels', async ({ page }) => {
    await mockPortfolioLead(page);
    await page.goto('/portfolio/setup', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('portfolio-focused-setup-shell')).toBeVisible();
    await expect(page.getByText('Frentes estratégicos')).toHaveCount(0);
    await page.getByRole('button', { name: 'Preparar mi espacio' }).click();
    await page.getByLabel('Qué quieres conseguir o tener bajo control').fill('Dirección quiere conseguir 200 nuevas ventas B2B este trimestre.');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByTestId('intent-checkpoint')).toBeVisible();
    await page.getByRole('button', { name: /Está bien, continuar/ }).click();
    await expect(page.getByLabel('Pegar o escribir lo que ya tienes')).toBeVisible();
    await page.getByRole('button', { name: 'Usar ejemplo NovaGrowth' }).click();
    await expect(page.getByLabel('Pegar o escribir lo que ya tienes')).toHaveValue(/Content Campaign/);
    await page.getByRole('button', { name: 'Ayúdame a ordenar esto' }).click();
    await expect(page.getByTestId('existing-work-checkpoint')).toBeVisible();
    await expect(page.getByTestId('first-value-narrative')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sí, esto representa mi trabajo' }).click();
    await expect(page.getByTestId('first-value-narrative')).toBeVisible();
    await expect(page.getByTestId('initiative-count')).toHaveText('7 iniciativas detectadas');
    await expect(page.getByText('Esto es lo que entendí')).toBeVisible();
    await expect(page.getByText('Así parece repartirse el trabajo')).toBeVisible();
    await expect(page.getByText('Qué merece revisar')).toBeVisible();
    await expect(page.getByText('Cómo se relaciona el trabajo con el objetivo')).toBeVisible();
    await expect(page.getByText('First Analytical Value')).toHaveCount(0);
    await expect(page.getByText(/NEXT_SLICE_PLACEHOLDER|Portfolio Monitoring|siguiente slice/i)).toHaveCount(0);
    await page.getByRole('button', { name: /Continuar con esta lectura/ }).click();
    await expect(page.getByTestId('global-reading-confirmation')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar lectura y continuar' }).click();
    await expect(page.getByTestId('relationship-review-boundary')).toBeVisible();
  });

  test('setup remains accessible and supports the no-file path', async ({ page }) => {
    await mockPortfolioLead(page);
    await page.goto('/portfolio/setup', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Preparar mi espacio' }).click();
    await page.getByLabel('Qué quieres conseguir o tener bajo control').fill('200 nuevas ventas B2B en Q4');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /Está bien, continuar/ }).click();
    await expect(page.getByText('Subir archivo — Disponible próximamente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'No tengo nada organizado todavía' })).toBeVisible();
    await page.getByRole('button', { name: 'No tengo nada organizado todavía' }).click();
    await expect(page.getByTestId('existing-work-checkpoint')).toBeVisible();
    await page.getByRole('button', { name: 'Sí, esto representa mi trabajo' }).click();
    await expect(page.getByTestId('first-value-narrative')).toBeVisible();
  });
});
