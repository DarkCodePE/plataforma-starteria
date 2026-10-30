import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import axe from 'axe-core';

const artifacts = path.resolve(process.cwd(), '../artifacts/mvp-chat02/screenshots');
const evidenceFile = path.resolve(process.cwd(), '../artifacts/mvp-chat02/MVP_CHAT02_BROWSER_EVIDENCE.json');
const email = 'mvp-chat01.owner@starteria.test';
const password = 'demo123';

async function login(page: Page) {
  await page.goto('/auth');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page).not.toHaveURL(/\/auth/);
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
}

async function scrollSurfaceTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll<HTMLElement>('main, [class*="overflow-y-auto"]').forEach(element => { element.scrollTop = 0; });
  });
}

async function axeViolations(page: Page, selector = 'main, [data-testid="step-reasoning-panel"]') {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async (target) => {
    const root = document.querySelector(target);
    if (!root) return [{ id: 'missing-target', impact: 'critical', nodes: 1 }];
    const result = await (window as any).axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations.map((item: any) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
  }, selector);
}

test('MVP-CHAT-02 integrated browser acceptance', async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const methods: string[] = [];
  page.on('request', request => methods.push(`${request.method()} ${new URL(request.url()).pathname}`));
  const evidence: Record<string, unknown> = { generatedAt: new Date().toISOString(), baseUrl: process.env.E2E_BASE_URL, database: 'PostgreSQL descartable :55433, migrations 1-67', visualBaselineComparison: 'INCONCLUSIVE: no approved visual baseline supplied', checks: [] as string[], accessibility: [] as unknown[], screenshots: [] as string[] };
  const checks = evidence.checks as string[];
  const accessibility = evidence.accessibility as Array<Record<string, unknown>>;
  const screenshots = evidence.screenshots as string[];

  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  await page.goto('/projects/mvp-chat01-step0/step/0');
  const step0 = page.getByTestId('step-reasoning-panel');
  await expect(step0.getByRole('heading', { name: /Trabaja Step 0 conversando/i })).toBeVisible();
  await expect(step0.getByTestId('step-reasoning-composer')).toBeVisible();
  await expect(step0.getByText(/Respuesta de integración QA/i).first()).toBeVisible();
  await noOverflow(page);
  const step0Axe = await axeViolations(page, '[data-testid="step-reasoning-panel"]');
  expect(step0Axe).toEqual([]);
  accessibility.push({ surface: 'Step 0 desktop', violations: step0Axe });
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step0-1440x900.png'), fullPage: true });
  screenshots.push('step0-1440x900.png');
  checks.push('Step 0 conserva chat protagonista, historial QA honesto y composer separado del Core');

  const domainPosts = () => methods.filter(item => item.startsWith('POST ') && !item.includes('/auth/'));
  const navigationPostStart = domainPosts().length;
  await page.goto('/projects/mvp-chat01-step2/step/2');
  const step2Active = page.getByTestId('step-reasoning-panel');
  await expect(step2Active.getByRole('heading', { name: /Trabaja Step 2 conversando/i })).toBeVisible();
  await expect(step2Active.getByTestId('step-reasoning-composer')).toBeVisible();
  await expect(step2Active.getByText(/No hay un checkpoint operativo preparado/i).first()).toBeVisible();
  await expect(step2Active.getByText(/0\/0/)).toHaveCount(0);
  await expect(step2Active.getByText(/Todavía no hay un resultado confirmado disponible/i)).toBeVisible();
  await expect(step2Active.locator('[class*="minmax(0,7fr)"]')).toHaveCount(1);
  const contextButton = step2Active.getByRole('button', { name: /Ver contexto y fuentes/i });
  await expect(contextButton).toHaveAttribute('aria-expanded', 'false');
  await contextButton.press('Enter');
  await expect(contextButton).toHaveAttribute('aria-expanded', 'true');
  await contextButton.press('Enter');
  await expect(contextButton).toHaveAttribute('aria-expanded', 'false');
  await noOverflow(page);
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-en-curso-1440x900.png'), fullPage: true });
  screenshots.push('step2-en-curso-1440x900.png');
  checks.push('Step 2 en curso usa 70/30, contexto expandible, ausencia honesta de checkpoint/output y ningún 0/0');
  expect(domainPosts().length).toBe(navigationPostStart);

  await page.goto('/projects/mvp-chat01-step4/step/4');
  const step4Active = page.getByTestId('step-reasoning-panel');
  await expect(step4Active.getByRole('heading', { name: /Trabaja Step 4 conversando/i })).toBeVisible();
  await expect(step4Active.getByTestId('step-reasoning-composer')).toBeVisible();
  await expect(page.getByText(/Decisión aprobada/i)).toHaveCount(0);
  await expect(page.getByText(/Decisión humana explícita/i).first()).toBeVisible();
  await noOverflow(page);
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step4-en-curso-1440x900.png'), fullPage: true });
  screenshots.push('step4-en-curso-1440x900.png');
  checks.push('Step 4 conserva el patrón conversacional y declara la autoridad humana sin inventar decisión ejecutiva');

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/projects/mvp-chat01-step2/step/2');
  await expect(step2Active.getByTestId('step-reasoning-composer')).toBeVisible();
  await noOverflow(page);
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-tablet-768x1024.png'), fullPage: true });
  screenshots.push('step2-tablet-768x1024.png');
  checks.push('Tablet 768 no genera overflow horizontal');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(step2Active.getByTestId('step-reasoning-composer')).toBeVisible();
  const mobilePositions = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="step-reasoning-panel"]');
    const composer = panel?.querySelector('[data-testid="step-reasoning-composer"]');
    const progress = panel?.querySelector('aside[aria-labelledby*="progress-title"]');
    return { composer: composer?.getBoundingClientRect().top ?? -1, progress: progress?.getBoundingClientRect().top ?? -1 };
  });
  expect(mobilePositions.composer).toBeGreaterThanOrEqual(0);
  expect(mobilePositions.composer).toBeLessThan(mobilePositions.progress);
  await noOverflow(page);
  const mobileAxe = await axeViolations(page, '[data-testid="step-reasoning-panel"]');
  expect(mobileAxe).toEqual([]);
  accessibility.push({ surface: 'Step 2 mobile 390', violations: mobileAxe });
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-mobile-390x844.png'), fullPage: true });
  screenshots.push('step2-mobile-390x844.png');
  checks.push('Móvil 390 coloca chat/composer antes del progreso y no genera overflow');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects/mvp-chat02-step2-completed/step/2');
  const completed = page.getByTestId('step-reasoning-panel');
  await expect(page.getByRole('heading', { name: 'Step completado' })).toBeVisible();
  await expect(page.getByText('Confirmado', { exact: true })).toBeVisible();
  await expect(completed.getByText(/conversación histórica en sólo lectura/i)).toBeVisible();
  await expect(completed.getByTestId('step-reasoning-composer')).toHaveCount(0);
  const outputButton = completed.getByRole('button', { name: /Ver resultado del Step/i });
  await expect(outputButton).toHaveAttribute('aria-expanded', 'false');
  await outputButton.click();
  await expect(completed.getByText(/Piloto acotado/i)).toBeVisible();
  await expect(completed.getByText('Prueba preparada').last()).toBeVisible();
  await expect(completed.getByText(/CP-3\.1/)).toHaveCount(0);
  await expect(completed.getByText('v1')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuar Step 3/i })).toBeVisible();
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step2-completado-1440x900.png'), fullPage: true });
  screenshots.push('step2-completado-1440x900.png');
  await outputButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'step2-completado-resultado-1440x900.png'), fullPage: true });
  screenshots.push('step2-completado-resultado-1440x900.png');
  checks.push('Step 2 completado conserva conversación, oculta escrituras y presenta output canónico v1');

  await page.goto('/projects/mvp-chat02-historical-no-output/step/1');
  await expect(page.getByRole('heading', { name: /Histórico de Step 1/i })).toBeVisible();
  await expect(page.getByText(/resultado no documentado/i).first()).toBeVisible();
  await expect(page.getByText(/no lo reabre ni crea una sesión/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /confirmar/i })).toHaveCount(0);
  await scrollSurfaceTop(page);
  await page.screenshot({ path: path.join(artifacts, 'step-historico-sin-resultado-1440x900.png'), fullPage: true });
  screenshots.push('step-historico-sin-resultado-1440x900.png');
  checks.push('Step histórico sin output no aparece confirmado ni crea sesión retroactiva');

  await page.goto('/portfolio/inicio');
  await expect(page.getByTestId('portfolio-overview-home')).toBeVisible();
  await expect(page.getByText(/Último resultado confirmado: Step 2/i)).toBeVisible();
  await expect(page.getByText(/step2.execution-ready/i)).toBeVisible();
  const portfolioOutputLink = page.getByRole('link', { name: /Ver resultado confirmado de Step 2/i });
  await expect(portfolioOutputLink).toHaveAttribute('href', '/projects/mvp-chat02-step2-completed/step/2');
  await noOverflow(page);
  const portfolioAxe = await axeViolations(page, '[data-testid="portfolio-overview-home"]');
  expect(portfolioAxe).toEqual([]);
  accessibility.push({ surface: 'Portfolio Lead desktop', violations: portfolioAxe });
  await portfolioOutputLink.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'portfolio-lead-actualizado-1440x900.png'), fullPage: true });
  screenshots.push('portfolio-lead-actualizado-1440x900.png');
  checks.push('Portfolio Lead refleja el último AdaptiveStepOutput confirmado con Step, versión, timestamp y enlace');

  evidence.requests = methods;
  writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
});
