import { expect, test } from '@playwright/test';

const HERO_HEADLINE = 'Haz que cada iniciativa aporte más.';

test.describe('Public landing — KAN-255 Platform + Fab', () => {
  test('explica, demuestra y convierte sin enlazar Portfolio Entry', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const hero = page.locator('main > section').first();
    await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
    await expect(hero.getByText(/Conecta objetivos, equipos y conocimiento/)).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute('href', '#en-accion');

    const tabs = page.getByRole('tablist', { name: 'Etapas del desarrollo de una iniciativa' });
    await expect(tabs.getByRole('tab')).toHaveCount(4);
    await expect(tabs.getByRole('tab', { name: /Clarificar/ })).toHaveAttribute('aria-selected', 'true');

    await tabs.getByRole('tab', { name: /Conectar/ }).press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: /Ejecutar/ })).toHaveAttribute('aria-selected', 'true');
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('Con el equipo', { exact: true })).toBeVisible();
    await expect(panel.getByText('Con Startería Fab', { exact: true })).toBeVisible();
    await expect(panel.getByText(/Evidencia, resultado y continuidad/)).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Conocer Startería Fab' })).toHaveAttribute(
      'href',
      'https://darkcodepe.github.io/sw-factory/',
    );

    await tabs.getByRole('tab', { name: /Aprender/ }).click();
    await expect(panel).toContainText('Lo aprendido vuelve a orientar nuevas iniciativas.');

    await expect(page.getByRole('region', { name: 'Impacto empresarial' })).toContainText('Decisiones con evidencia');
    await expect(page.getByRole('region', { name: 'Fricciones que Startería ayuda a reducir' })).toContainText('Con Startería');
    await expect(page.locator('a[href="/public/start"]')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);

    const commercialDestination = await hero.getByRole('link', { name: 'Explorar Startería para mi equipo' }).getAttribute('href');
    expect(commercialDestination).toMatch(/^https:\/\//);
    await expect(page.getByRole('link', { name: 'Hablemos de tu iniciativa' })).toHaveAttribute('href', commercialDestination!);

    // Keep the approved Team/Fab bifurcation visible in the review artifacts.
    await tabs.getByRole('tab', { name: /Ejecutar/ }).click();
    await page.waitForTimeout(600);

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
      expect(dimensions.documentWidth, 'horizontal overflow at ' + viewport.width).toBeLessThanOrEqual(dimensions.viewportWidth);
      await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('kan-255-' + viewport.width + '.png'), fullPage: true });
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

