import { expect, test } from '@playwright/test';

test.describe('KAN-102 public landing and Portfolio Entry convergence', () => {
  test('explains Starteria before offering its secondary strategic clarity path', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Haz que la estrategia se haga realidad.',
    })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(
      'Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.',
    )).toBeVisible();
    await expect(page.getByText(
      'Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.',
    )).toBeVisible();

    const model = page.getByLabel('Modelo conceptual de Starteria');
    for (const label of ['Objetivos', 'Necesidades', 'Iniciativas', 'Equipos', 'Contexto. Trabajo. Decisiones.', 'Foco', 'Coordinación', 'Evidencia', 'Decisión']) {
      await expect(model.getByText(label)).toBeVisible();
    }
    await expect(page.getByText('Define la meta')).toBeVisible();
    await expect(page.getByText('Alinea el trabajo')).toBeVisible();
    await expect(page.getByText('Hazlas realidad')).toBeVisible();
    await expect(page.getByText('Decide', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ya tengo claro qué quiero mover' })).toBeVisible();

    const optionalEntry = page.getByRole('heading', {
      name: 'Aclara qué quieres conseguir antes de decidir qué hacer.',
    });
    await expect(optionalEntry).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quiero alinear mi objetivo primero' })).toBeVisible();
    await page.getByRole('button', { name: 'Quiero alinear mi objetivo primero' }).click();
    await expect(page).toHaveURL(/\/public\/start$/);
    await expect(page.getByRole('heading', { name: 'Aclara qué quieres conseguir antes de decidir qué hacer.' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /necesitas conseguir o entender/i })).toBeVisible();
  });
});
