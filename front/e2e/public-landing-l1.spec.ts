import { expect, test } from '@playwright/test';

const HERO_HEADLINE = 'Convierte objetivos de negocio en iniciativas que avanzan y aprenden.';

test.describe('Public landing — KAN-258 V4.2', () => {
  test('conecta Estrategia, Ejecución y Resultados sin enlazar Portfolio Entry', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const hero = page.locator('main > section').first();
    await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
    await expect(hero.getByText(/conecta estrategia, personas y ejecución guiada/i)).toBeVisible();

    const tabs = page.getByRole('tablist', { name: 'Perspectivas del trabajo en Startería' });
    await expect(tabs.getByRole('tab')).toHaveCount(3);
    await expect(tabs.getByRole('tab', { name: /Estrategia/ })).toHaveAttribute('aria-selected', 'true');

    await tabs.getByRole('tab', { name: /Estrategia/ }).press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: /Ejecución/ })).toHaveAttribute('aria-selected', 'true');
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Guía de Startería en este momento')).toBeVisible();
    await expect(panel.getByText('Con el equipo', { exact: true })).toBeVisible();
    await expect(panel.getByText('Con Fab', { exact: true })).toBeVisible();
    await expect(panel).toContainText('sin reemplazar al equipo ejecutor ni aprobar automáticamente');

    await tabs.getByRole('tab', { name: /Resultados/ }).click();
    await expect(panel).toContainText('48 h');
    await expect(panel).toContainText('24 h');
    await expect(panel).toContainText('30 h');
    await expect(panel).toContainText('caso ficticio');
    await expect(panel).toContainText('La decisión corresponde a quienes tienen autoridad');

    await expect(page.getByRole('heading', { name: /Conecta más equipos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tu contexto. Tus decisiones. Tu control.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Que innovar no dependa de tener un gran equipo.' })).toBeVisible();
    await expect(page.locator('a[href="/public/start"]')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);

    const commercialDestination = await hero.getByRole('link', { name: /Solicitar una demo/ }).getAttribute('href');
    expect(commercialDestination).toMatch(/^https:\/\//);
    await expect(page.getByRole('link', { name: /Solicitar una demo/ }).last()).toHaveAttribute('href', commercialDestination!);

    await tabs.getByRole('tab', { name: /Estrategia/ }).click();
    for (const viewport of [
      { width: 1440, height: 900 },
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
      expect(dimensions.documentWidth, `horizontal overflow at ${viewport.width}`).toBeLessThanOrEqual(dimensions.viewportWidth);
      await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`kan-258-v42-${viewport.width}.png`), fullPage: true });
    }

    const journey = page.locator('.landing-journey');
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await tabs.getByRole('tab', { name: /Ejecución/ }).click();
      await journey.screenshot({ path: testInfo.outputPath(`kan-258-v42-ejecucion-${viewport.width}.png`) });
      await tabs.getByRole('tab', { name: /Resultados/ }).click();
      await journey.screenshot({ path: testInfo.outputPath(`kan-258-v42-resultados-${viewport.width}.png`) });
    }
  });

  test('respeta reduced-motion y conserva foco visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();

    const animationNames = await page.locator('.landing-flow, .landing-pop').evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).animationName),
    );
    expect(animationNames.every((name) => name === 'none')).toBe(true);
  });
});
