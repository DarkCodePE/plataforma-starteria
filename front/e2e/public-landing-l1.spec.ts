import { expect, test } from '@playwright/test';

const HERO_HEADLINE = 'Haz que la estrategia se haga realidad.';
const PRIMARY_SUPPORT = 'Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.';
const SECONDARY_SUPPORT =
  'Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.';
const OPTIONAL_ENTRY_TITLE = 'Aclara qué quieres conseguir antes de decidir qué hacer.';
const OPTIONAL_ENTRY_CTA = 'Quiero alinear mi objetivo primero';

test.describe('KAN-112 public landing visual preview', () => {
  test('preserves the product framing and existing Portfolio Entry journey', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
    await expect(page.getByText(PRIMARY_SUPPORT)).toBeVisible();
    await expect(page.getByText(SECONDARY_SUPPORT)).toBeVisible();

    const model = page.getByRole('region', {
      name: 'De la meta a una decisión mejor preparada.',
    });
    await expect(model.getByText('Objetivos / Necesidades / Iniciativas / Equipos')).toBeVisible();
    await expect(model.getByText('Starteria', { exact: true })).toBeVisible();
    await expect(model.getByText('Foco / Coordinación / Evidencia / Decisión')).toBeVisible();
    for (const step of ['Define la meta', 'Alinea el trabajo', 'Hazlas realidad', 'Decide']) {
      await expect(model.getByText(step, { exact: true })).toBeVisible();
    }

    const preview = page.getByRole('region', {
      name: 'Así puede verse el trabajo cuando está conectado',
    });
    await expect(preview.getByText('Ejemplo ilustrativo · no es un análisis real')).toBeVisible();
    await expect(preview.getByText('Contenido, nombres, relaciones y estados ficticios.')).toBeVisible();
    await expect(preview.getByText('Mejorar adopción del canal digital')).toBeVisible();
    await expect(preview.getByText('Bloqueo ilustrativo: dependencia de soporte por aclarar')).toBeVisible();
    await expect(preview.getByText('Decisión a preparar')).toBeVisible();

    await expect(page.getByRole('link', { name: /ya tengo claro qué quiero mover/i })).toHaveAttribute('href', '/auth');
    await expect(page.getByRole('link', { name: OPTIONAL_ENTRY_CTA })).toHaveAttribute('href', '/public/start');
    await expect(page.getByRole('link', { name: /early access|demo/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /early access|demo/i })).toHaveCount(0);

    const entrySection = page.locator('section[aria-labelledby="portfolio-entry-heading"]');
    await expect(entrySection.getByRole('heading', { name: OPTIONAL_ENTRY_TITLE })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('kan112-desktop-1440-full.png'),
      fullPage: true,
    });
    await page.locator('main > section').first().screenshot({
      path: testInfo.outputPath('kan112-desktop-1440-hero.png'),
    });
    await preview.screenshot({
      path: testInfo.outputPath('kan112-desktop-1440-preview.png'),
    });
    await entrySection.screenshot({
      path: testInfo.outputPath('kan112-desktop-1440-entry.png'),
    });

    await page.getByRole('link', { name: 'Producto', exact: true }).click();
    const stickyHeaderBox = await page.getByRole('banner').boundingBox();
    const anchoredPreviewHeadingBox = await preview
      .getByRole('heading', { name: 'Así puede verse el trabajo cuando está conectado' })
      .boundingBox();
    expect(anchoredPreviewHeadingBox?.y).toBeGreaterThanOrEqual(
      (stickyHeaderBox?.y ?? 0) + (stickyHeaderBox?.height ?? 0),
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const previewHeadingBox = await page
      .getByRole('heading', { name: 'Así puede verse el trabajo cuando está conectado' })
      .boundingBox();
    expect(previewHeadingBox?.y).toBeLessThan(800);
    await page.screenshot({
      path: testInfo.outputPath('kan112-laptop-1280-full.png'),
      fullPage: true,
    });
    await page.locator('main > section').first().screenshot({
      path: testInfo.outputPath('kan112-laptop-1280-hero.png'),
    });
    await page.getByRole('region', {
      name: 'Así puede verse el trabajo cuando está conectado',
    }).screenshot({
      path: testInfo.outputPath('kan112-laptop-1280-preview.png'),
    });
    await entrySection.screenshot({
      path: testInfo.outputPath('kan112-laptop-1280-entry.png'),
    });

    for (const width of [1024, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
      await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
      await expect(preview.getByText('Ejemplo ilustrativo · no es un análisis real')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`kan112-tablet-${width}-full.png`),
        fullPage: true,
      });

      if (width === 768) {
        await preview.scrollIntoViewIfNeeded();
        const frontBox = await preview.getByText('Experiencia digital').boundingBox();
        const challengeBox = await preview.getByText('Facilitar la activación inicial').boundingBox();
        expect(frontBox?.y).toBeLessThan(challengeBox?.y ?? 0);
      }
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('link', { name: OPTIONAL_ENTRY_CTA }).click();
    await expect(page).toHaveURL(/\/public\/start$/);
    await expect(page.getByRole('heading', { name: OPTIONAL_ENTRY_TITLE })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /necesitas conseguir o entender/i })).toBeVisible();
  });

  test('keeps hierarchy and disclaimer readable at 390px without horizontal overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
    const heroCta = page.getByRole('link', { name: /ya tengo claro qué quiero mover/i });
    await expect(heroCta).toBeVisible();

    const modelHeadingBox = await page
      .getByRole('heading', { name: 'De la meta a una decisión mejor preparada.' })
      .boundingBox();
    const heroHeadingBox = await page.getByRole('heading', { level: 1, name: HERO_HEADLINE }).boundingBox();
    const heroCtaBox = await heroCta.boundingBox();
    const entrySection = page.locator('section[aria-labelledby="portfolio-entry-heading"]');
    const entryHeadingBox = await entrySection.getByRole('heading', { name: OPTIONAL_ENTRY_TITLE }).boundingBox();
    await expect(entrySection.getByRole('heading', { name: OPTIONAL_ENTRY_TITLE })).toBeVisible();
    await expect(entrySection.getByRole('link', { name: OPTIONAL_ENTRY_CTA })).toHaveAttribute('href', '/public/start');
    const preview = page.getByRole('region', {
      name: 'Así puede verse el trabajo cuando está conectado',
    });
    const previewHeadingBox = await preview
      .getByRole('heading', { name: 'Así puede verse el trabajo cuando está conectado' })
      .boundingBox();
    expect(heroHeadingBox?.y).toBeLessThan(heroCtaBox?.y ?? 0);
    expect(heroCtaBox?.y).toBeLessThan(modelHeadingBox?.y ?? 0);
    expect(modelHeadingBox?.y).toBeLessThan(previewHeadingBox?.y ?? 0);
    expect(previewHeadingBox?.y).toBeLessThan(entryHeadingBox?.y ?? 0);

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

    await preview.scrollIntoViewIfNeeded();
    await expect(preview.getByText('Ejemplo ilustrativo · no es un análisis real')).toBeVisible();
    await expect(preview.getByText('Evidencia pendiente: qué facilita la activación inicial')).toBeVisible();
    await expect(preview.getByText('Bloqueo ilustrativo: dependencia de soporte por aclarar')).toBeVisible();
    await expect(preview.getByText('La decisión sigue siendo de las personas.')).toBeVisible();

    const frontBox = await preview.getByText('Experiencia digital').boundingBox();
    const challengeBox = await preview.getByText('Facilitar la activación inicial').boundingBox();
    const initiativeBox = await preview.getByText('Rediseño onboarding').boundingBox();
    const signalsBox = await preview.getByRole('heading', { name: 'Señales y evidencia' }).boundingBox();
    const gapBox = await preview.getByText(/Gap de evidencia:/).boundingBox();
    const decisionBox = await preview.getByRole('heading', { name: 'Decisión a preparar' }).boundingBox();
    expect(frontBox?.y).toBeLessThan(challengeBox?.y ?? 0);
    expect(challengeBox?.y).toBeLessThan(initiativeBox?.y ?? 0);
    expect(initiativeBox?.y).toBeLessThan(signalsBox?.y ?? 0);
    expect(signalsBox?.y).toBeLessThan(gapBox?.y ?? 0);
    expect(gapBox?.y).toBeLessThan(decisionBox?.y ?? 0);

    await page.screenshot({
      path: testInfo.outputPath('kan112-mobile-390-full.png'),
      fullPage: true,
    });
    await page.locator('main > section').first().screenshot({
      path: testInfo.outputPath('kan112-mobile-390-hero.png'),
    });
    const previewTop = await preview.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
    await page.evaluate(top => window.scrollTo(0, Math.max(0, top - 80)), previewTop);
    await page.screenshot({
      path: testInfo.outputPath('kan112-mobile-390-preview.png'),
    });
    await entrySection.screenshot({
      path: testInfo.outputPath('kan112-mobile-390-entry.png'),
    });
  });
});
