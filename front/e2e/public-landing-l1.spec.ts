import { expect, test } from '@playwright/test';

const HERO_HEADLINE = 'Haz que la estrategia se haga realidad.';
const PRIMARY_SUPPORT = 'Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.';
const SECONDARY_SUPPORT =
  'Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.';
const DEMO_CTA = 'Reservar demo';
const HERO_ENTRY_CTA = 'Quiero alinear mi objetivo primero';
const CLOSING_CTA = 'Analizar mi situación';
const PREVIEW_TITLE = 'Meta → Alineación → Ejecución → Decisión';
const CLOSING_TITLE = 'Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.';

test.describe('KAN-113 public landing commercial alignment', () => {
  test('aligns the visual story and preserves the existing Portfolio Entry route', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const hero = page.locator('main > section').first();
    await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
    await expect(page.getByText('De la estrategia al impacto real')).toBeVisible();
    await expect(page.getByText(PRIMARY_SUPPORT)).toBeVisible();
    await expect(page.getByText(SECONDARY_SUPPORT)).toBeVisible();

    const model = page.getByRole('region', { name: 'Modelo conceptual de Starteria' });
    for (const item of ['Objetivos', 'Necesidades', 'Iniciativas', 'Equipos']) {
      await expect(model.getByRole('list').nth(0).getByText(item)).toBeVisible();
    }
    await expect(model.getByText('Starteria', { exact: true })).toBeVisible();
    await expect(model.getByText('Contexto. Trabajo. Decisiones.')).toBeVisible();
    for (const item of ['Foco', 'Coordinación', 'Evidencia', 'Decisión']) {
      await expect(model.getByRole('list').nth(1).getByText(item)).toBeVisible();
    }

    const benefits = page.getByRole('region', { name: 'Beneficios rápidos' });
    for (const benefit of [
      'Más claridad en menos tiempo',
      'Equipos alineados',
      'Decisiones con evidencia',
    ]) {
      await expect(benefits.getByText(benefit)).toBeVisible();
    }

    const valueFlow = page.getByRole('group', { name: 'Flujo conceptual de valor' });
    for (const [index, step] of ['Define la meta', 'Alinea el trabajo', 'Hazlas realidad', 'Decide'].entries()) {
      await expect(valueFlow.getByText(String(index + 1).padStart(2, '0'))).toBeVisible();
      await expect(valueFlow.getByText(step, { exact: true })).toBeVisible();
    }

    const preview = page.getByRole('region', { name: PREVIEW_TITLE });
    for (const stage of ['Meta', 'Alineación', 'Ejecución', 'Decisión']) {
      await expect(preview.getByRole('heading', { name: stage, level: 3 })).toBeVisible();
    }
    await expect(preview.getByText('Meta hipotética')).toBeVisible();
    await expect(preview.getByText('Ejemplo ilustrativo · no es un análisis real')).toBeVisible();
    await expect(preview.getByText('Contenido, nombres, relaciones y estados ficticios.')).toBeVisible();
    await expect(preview.getByText('Bloqueo ficticio: dependencia de soporte por aclarar')).toBeVisible();
    await expect(preview.getByText('Invertir')).toBeVisible();
    await expect(preview.locator('button, a, input, textarea, select, [tabindex]')).toHaveCount(0);

    const gap = page.getByRole('region', { name: 'La brecha entre estrategia y ejecución' });
    await expect(gap.getByRole('heading', { name: 'Hoy: fragmentado' })).toBeVisible();
    await expect(gap.getByRole('heading', { name: 'Con Starteria: conectado' })).toBeVisible();
    await expect(gap.getByText('La brecha', { exact: true })).toBeVisible();
    for (const item of [
      'Objetivos aislados',
      'Equipos desconectados',
      'Contexto perdido',
      'Decisiones tardías',
      'Foco compartido',
      'Trabajo coordinado',
      'Evidencia conectada',
      'Decisiones trazables',
    ]) {
      await expect(gap.getByText(item)).toBeVisible();
    }

    const trust = page.getByRole('region', {
      name: 'Starteria estructura tu contexto sin sustituir tu criterio.',
    });
    await expect(trust.getByText('Puedes empezar con contexto incompleto.')).toBeVisible();
    await expect(trust.getByText('Nada se convierte en trabajo formal sin revisión.')).toBeVisible();
    await expect(trust.getByText('La IA estructura y propone; las decisiones siguen siendo humanas.')).toBeVisible();
    await expect(trust.getByText('Tu entrada pública no crea iniciativas ni lanza trabajo automáticamente.')).toBeVisible();

    const header = page.locator('header.sticky');
    const headerDemo = header.getByRole('link', { name: DEMO_CTA, exact: true });
    const heroDemo = hero.getByRole('link', { name: DEMO_CTA, exact: true });
    const demoHref = await headerDemo.getAttribute('href');
    await expect(header.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/auth');
    await expect(headerDemo).toHaveAttribute('href', /^https:\/\//);
    await expect(headerDemo).toHaveAttribute('target', '_blank');
    await expect(headerDemo).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(heroDemo).toHaveAttribute('href', demoHref!);
    await expect(heroDemo).toHaveAttribute('target', '_blank');
    await expect(heroDemo).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(hero.getByRole('link', { name: HERO_ENTRY_CTA })).toHaveAttribute('href', '/public/start');

    const closing = page.locator('section[aria-labelledby="landing-closing-title"]');
    await expect(closing.getByRole('heading', { name: CLOSING_TITLE })).toBeVisible();
    await expect(closing.getByRole('link', { name: CLOSING_CTA })).toHaveAttribute('href', '/public/start');
    await expect(closing.getByRole('link', { name: DEMO_CTA })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Navegación del pie de página' })).toBeVisible();

    const viewportChecks = [
      { width: 1440, height: 900, name: '1440' },
      { width: 1280, height: 800, name: '1280' },
      { width: 1024, height: 900, name: '1024' },
      { width: 768, height: 900, name: '768' },
      { width: 390, height: 844, name: '390' },
    ];

    for (const viewport of viewportChecks) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.scrollTo(0, 0));

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.documentWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(
        dimensions.viewportWidth,
      );
      await expect(page.getByRole('heading', { level: 1, name: HERO_HEADLINE })).toBeVisible();
      await expect(model.getByText('Objetivos')).toBeVisible();
      await expect(model.getByText('Decisión')).toBeVisible();
      await expect(preview.getByText('Ejemplo ilustrativo · no es un análisis real')).toBeVisible();

      const heroHeadingBox = await hero.getByRole('heading', { level: 1 }).boundingBox();
      if (viewport.width < 1280) {
        const heroCtaBox = await heroDemo.boundingBox();
        const modelBox = await model.boundingBox();
        expect(modelBox?.y).toBeGreaterThan(heroCtaBox?.y ?? 0);
      } else {
        const modelBox = await model.boundingBox();
        expect(modelBox?.x).toBeGreaterThan(heroHeadingBox?.x ?? 0);
      }

      await page.screenshot({
        path: testInfo.outputPath(`kan113-${viewport.name}-full.png`),
        fullPage: true,
      });
      await hero.screenshot({ path: testInfo.outputPath(`kan113-${viewport.name}-hero.png`) });
      await preview.screenshot({ path: testInfo.outputPath(`kan113-${viewport.name}-preview.png`) });
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await closing.getByRole('link', { name: CLOSING_CTA }).click();
    await expect(page).toHaveURL(/\/public\/start$/);
    await expect(page.getByRole('heading', {
      name: 'Aclara qué quieres conseguir antes de decidir qué hacer.',
    })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /necesitas conseguir o entender/i })).toBeVisible();
  });
});
