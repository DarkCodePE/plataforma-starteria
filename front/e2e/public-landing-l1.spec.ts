import { test, expect } from '@playwright/test';

test.describe('Public Landing L1 product framing', () => {
  test('explains Starteria before presenting optional Portfolio Entry', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Convierte estrategia e iniciativas en decisiones sustentadas.',
    })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(
      'Starteria ayuda a estructurar qué quieres mover, convertirlo en iniciativas accionables, seguir evidencia y bloqueos, y preparar mejores decisiones.',
    )).toBeVisible();

    const model = page.getByRole('list').filter({ has: page.getByText('Estrategia / necesidad') });
    await expect(model.getByRole('listitem')).toHaveText([
      'Estrategia / necesidad',
      'Iniciativas',
      'Evidencia + avance',
      'Decisiones',
    ]);

    const optionalEntry = page.getByRole('heading', {
      name: '¿Todavía no tienes claro por dónde empezar?',
    });
    await expect(optionalEntry).toBeVisible();
    await expect(optionalEntry.locator('xpath=following::textarea[1]')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
