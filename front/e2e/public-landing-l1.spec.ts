import { expect, test } from '@playwright/test';

const HERO_HEADLINE = 'De una necesidad de negocio a una solución que genera valor.';

test.describe('Public landing — Starteria Platform + Fab', () => {
  test('explains the business value without linking to Portfolio Entry', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const hero = page.locator('main > section').first();
    await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
    await expect(hero.getByText(/Combinamos estrategia, ejecución tecnológica e inteligencia artificial/)).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Explorar soluciones' })).toHaveAttribute('href', '#soluciones');

    const solutions = page.getByRole('region', { name: /Lo que necesitas para pasar de la oportunidad a la ejecución/i });
    await expect(solutions.getByText('Starteria Platform')).toBeVisible();
    await expect(solutions.getByText('Starteria Fab')).toBeVisible();
    await expect(solutions.getByText('Servicio integrado')).toBeVisible();
    await expect(solutions.getByText(/La integración completa está en evolución/)).toBeVisible();

    await expect(page.getByRole('heading', { name: 'La IA ayuda a avanzar. La responsabilidad sigue siendo humana.' })).toBeVisible();
    const preview = page.getByRole('region', { name: 'Reducir 30% el tiempo operativo' });
    await expect(preview.getByText('Caso ilustrativo', { exact: true })).toBeVisible();
    await expect(preview.locator('button, a, input, textarea, select, [tabindex]')).toHaveCount(0);

    const entryLinks = page.locator('a[href="/public/start"]');
    await expect(entryLinks).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);

    const headerDemo = page.locator('header.sticky').getByRole('link', { name: 'Hablemos' });
    const heroDemo = hero.getByRole('link', { name: 'Hablemos de tu desafío' });
    const configuredDestination = await headerDemo.getAttribute('href');
    expect(configuredDestination).toMatch(/^https:\/\//);
    await expect(headerDemo).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(heroDemo).toHaveAttribute('href', configuredDestination!);
    await expect(heroDemo).toHaveAttribute('target', '_blank');

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 900 },
      { width: 768, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.documentWidth, 'horizontal overflow at ' + viewport.width).toBeLessThanOrEqual(dimensions.viewportWidth);
      await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('platform-fab-' + viewport.width + '.png'), fullPage: true });
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await hero.getByRole('link', { name: 'Explorar soluciones' }).click();
    await expect(page).toHaveURL(/#soluciones$/);
  });
});
