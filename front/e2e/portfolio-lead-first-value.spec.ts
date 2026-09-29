import { test, expect } from '@playwright/test';

test.describe('Portfolio Lead Slice A — First Value', () => {
  test('P0 → P3 produces a reproducible NovaGrowth reading', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('starteria.demo.enabled', 'true'));
    await page.route('**/api/v1/**', async route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }));
    await page.route('**/api/v1/auth/refresh', async route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { accessToken: 'slice-a-token' } }),
    }));
    await page.route('**/api/v1/auth/me', async route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {
        id: 'slice-a-portfolio-lead',
        name: 'Ana Portfolio',
        email: 'ana@starteria.test',
        role: 'portfolio_lead',
        roles: ['portfolio_lead'],
        permissions: ['portfolio:read', 'portfolio:write'],
        initials: 'AP',
      } }),
    }));
    await page.goto('/portfolio/setup', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Preparar mi espacio' })).toBeVisible();
    await page.getByRole('button', { name: 'Preparar mi espacio' }).click();

    await page.getByLabel('Qué quieres conseguir o tener bajo control').fill('Dirección quiere conseguir 200 nuevas ventas B2B este trimestre.');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Usar ejemplo NovaGrowth' }).click();
    await expect(page.getByLabel('Pega información existente')).toHaveValue(/Content Campaign/);
    await page.getByRole('button', { name: 'Ayúdame a ordenar esto' }).click();

    await expect(page.getByTestId('first-analytical-value')).toBeVisible();
    await expect(page.getByTestId('initiative-count')).toHaveText('7 iniciativas');
    await expect(page.getByTestId('owner-count')).toHaveText('5');
    await expect(page.getByText('Parece haber tres formas principales en las que el trabajo está intentando mover el objetivo.')).toBeVisible();
    await expect(page.getByTestId('review-signals').locator('div.border-b')).toHaveCount(3);
    await expect(page.getByText('Tu guía de inicio · 2 de 5')).toBeVisible();

    await page.getByRole('button', { name: /¿Por qué/ }).first().click();
    await expect(page.getByTestId('rationale-generate-opportunities')).toBeVisible();
    await page.getByRole('button', { name: 'Revisar cómo se relaciona' }).click();
    await expect(page.getByTestId('next-slice-placeholder')).toBeVisible();
  });
});
