import { chromium } from '../../../front/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
const url = 'http://127.0.0.1:4175/Starteria_Landing_V4_2_Secciones.html';
const browser = await chromium.launch({ headless: true });

async function openPage(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  return page;
}

try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await openPage(viewport);
    await page.screenshot({
      path: path.join(outputDirectory, `v42_consolidated_${viewport.width}_full.png`),
      fullPage: true,
    });
    await page.close();
  }

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await openPage(viewport);
    const suffix = String(viewport.width);

    await page.locator('.hero').screenshot({
      path: path.join(outputDirectory, `v42_consolidated_hero_${suffix}.png`),
    });
    await page.addStyleTag({ content: '.nav{position:static!important}' });

    for (const state of [
      { id: 'strategy', name: 'estrategia' },
      { id: 'execution', name: 'ejecucion' },
      { id: 'return', name: 'resultados' },
    ]) {
      await page.locator(`[data-panel="${state.id}"]`).click();
      await page.waitForTimeout(120);
      await page.locator('.journey').screenshot({
        path: path.join(outputDirectory, `v42_consolidated_demo_${state.name}_${suffix}.png`),
      });
    }

    await page.locator('#para-quien').screenshot({
      path: path.join(outputDirectory, `v42_consolidated_publicos_${suffix}.png`),
    });
    await page.locator('#proposito').screenshot({
      path: path.join(outputDirectory, `v42_consolidated_proposito_${suffix}.png`),
    });
    await page.close();
  }
} finally {
  await browser.close();
}
