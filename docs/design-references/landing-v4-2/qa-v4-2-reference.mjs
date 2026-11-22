import assert from 'node:assert/strict';
import { chromium } from '../../../front/node_modules/playwright/index.mjs';

const url = 'http://127.0.0.1:4175/Starteria_Landing_V4_2_Secciones.html';
const viewports = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(url, { waitUntil: 'networkidle' });

    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.scroll, dimensions.client, `Horizontal overflow at ${viewport.width}px`);
    assert.equal(errors.length, 0, `Runtime errors at ${viewport.width}px: ${errors.join('; ')}`);
    const brokenInternalLinks = await page.locator('a[href^="#"]').evaluateAll((links) => links
      .map((link) => link.getAttribute('href'))
      .filter((href) => href && href !== '#' && !document.querySelector(href)));
    assert.deepEqual(brokenInternalLinks, [], `Broken internal anchors at ${viewport.width}px`);
    assert.equal(await page.locator('a[href="/public/start"]').count(), 0, 'Landing must not expose Portfolio Entry');
    assert.equal(await page.locator('a[href="/public/start"]').count(), 0, 'Landing must not link to /public/start');

    await assert.doesNotReject(() => page.getByRole('heading', { name: 'Empieza donde estás. Avanza a tu manera.' }).waitFor());
    await assert.doesNotReject(() => page.getByRole('heading', { name: 'Conecta más equipos. Sin perder el foco.' }).waitFor());
    await assert.doesNotReject(() => page.getByRole('heading', { name: 'Una necesidad. Una prueba concreta.' }).waitFor());
    await assert.doesNotReject(() => page.getByRole('heading', { name: 'De la mejora a una solución real.' }).waitFor());
    await assert.doesNotReject(() => page.getByRole('heading', { name: 'Que innovar no dependa de tener un gran equipo.' }).waitFor());
    await assert.doesNotReject(() => page.getByText('Democratizar la innovación desde el hacer.', { exact: true }).waitFor());

    const audienceBoxes = await Promise.all([
      page.locator('.v42-aud-feature').boundingBox(),
      page.locator('.v42-aud-small').boundingBox(),
      page.locator('.v42-aud-medium').boundingBox(),
    ]);
    assert(audienceBoxes.every(Boolean), `Audience compositions missing at ${viewport.width}px`);

    const tabs = page.getByRole('tab');
    assert.equal(await tabs.count(), 3, `Three demo perspectives required at ${viewport.width}px`);
    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      assert(box && box.height >= 44 && box.width >= 44, `Tab target below 44px at ${viewport.width}px`);
    }

    await page.getByRole('tab', { name: /Estrategia/ }).click();
    await page.getByRole('heading', { name: 'De un objetivo a iniciativas con propósito.' }).waitFor();
    await page.getByRole('tab', { name: /Ejecución/ }).click();
    await page.getByRole('heading', { name: 'Del encargo al trabajo guiado.' }).waitFor();
    await page.getByRole('tab', { name: /Resultados/ }).click();
    await page.getByRole('heading', { name: 'La evidencia regresa a la estrategia.' }).waitFor();
    for (const metric of ['48 h', '24 h', '30 h']) {
      await page.getByText(metric, { exact: true }).waitFor();
    }

    const fabLink = page.getByRole('link', { name: /Explorar Startería Fab/ });
    assert.equal(await fabLink.getAttribute('href'), 'https://darkcodepe.github.io/sw-factory/');
    assert.equal(await fabLink.getAttribute('rel'), 'noopener noreferrer');
    console.log(`${viewport.width}x${viewport.height}: V4.2 sections render without overflow or runtime errors`);
    await page.close();
  }

  const keyboardPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await keyboardPage.goto(url, { waitUntil: 'networkidle' });
  await keyboardPage.getByRole('tab', { name: /Estrategia/ }).focus();
  const tabFocus = await keyboardPage.getByRole('tab', { name: /Estrategia/ }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  assert.notEqual(tabFocus.style, 'none');
  assert.notEqual(tabFocus.width, '0px');
  await keyboardPage.keyboard.press('ArrowRight');
  assert.equal(await keyboardPage.getByRole('tab', { name: /Ejecución/ }).getAttribute('aria-selected'), 'true');
  await keyboardPage.keyboard.press('End');
  assert.equal(await keyboardPage.getByRole('tab', { name: /Resultados/ }).getAttribute('aria-selected'), 'true');

  const menu = keyboardPage.locator('#mobmenu');
  assert.equal(await menu.getAttribute('aria-label'), 'Abrir menú');
  const menuBox = await menu.boundingBox();
  assert(menuBox && menuBox.height >= 44 && menuBox.width >= 44, 'Mobile menu target below 44px');
  await menu.focus();
  const menuFocus = await menu.evaluate((element) => getComputedStyle(element).outlineStyle);
  assert.notEqual(menuFocus, 'none');
  await keyboardPage.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  assert.equal(await keyboardPage.locator('#mobnav').evaluate((element) => getComputedStyle(element).display), 'block');
  await keyboardPage.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');

  const firstDisclosure = keyboardPage.locator('.faq-list details').first();
  const firstSummary = firstDisclosure.locator('summary');
  await firstSummary.focus();
  await keyboardPage.keyboard.press('Enter');
  assert.equal(await firstDisclosure.getAttribute('open'), '');
  assert.equal(await firstDisclosure.locator('p').isVisible(), true);
  console.log('Keyboard and interactions: tabs, visible focus, mobile menu and FAQ pass');
  await keyboardPage.close();

  const reducedPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await reducedPage.goto(url, { waitUntil: 'networkidle' });
  const reducedMotion = await reducedPage.evaluate(() => ({
    matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animation: getComputedStyle(document.querySelector('.wire-moving')).animationName,
  }));
  assert.equal(reducedMotion.matches, true);
  assert.equal(reducedMotion.animation, 'none');
  console.log('Reduced motion regression: pass');
  await reducedPage.close();
} finally {
  await browser.close();
}
