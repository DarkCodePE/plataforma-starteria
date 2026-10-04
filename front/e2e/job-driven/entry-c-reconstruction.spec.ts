// Entrada C — "Ya existe mucho trabajo": reconstruction + gating retroactivo.
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §14.
import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { BASE, auth, registerAndLogin } from '../support/api';
import { GAP_TIMEOUT, gapTest } from '../support/gap';
import { ensurePortfolioLead, prisma, uiLoginLead } from '../support/portfolio-lead';

let api: APIRequestContext;

const PILOT = {
  name: 'E2E Job C Piloto autoservicio',
  summary: 'Llevamos 4 meses con un piloto de autoservicio en 2 sucursales.',
  evidence: [
    { summary: 'El costo por solicitud bajó 18% en la sucursal A', classification: 'supports' },
    { summary: 'La sucursal B no muestra cambios y subió el reclamo', classification: 'contradicts' },
  ],
};

test.describe('Entrada C · reconstruir lo que ya existe (§14)', () => {
  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE });
  });

  test.afterAll(async () => {
    await api.dispose();
    await prisma.$disconnect();
  });

  gapTest('G11', 'importar una iniciativa existente devuelve qué se puede sostener, contradicciones, gaps y la siguiente incertidumbre (§14)', async () => {
    const owner = await registerAndLogin(api, 'c-recon');
    const res = await api.post('/api/v1/initiatives/reconstruction', { headers: auth(owner.token), data: PILOT, failOnStatusCode: false });
    expect(res.ok(), await res.text()).toBeTruthy();
    const reading = (await res.json()).data;
    for (const key of ['sustainableClaims', 'availableEvidence', 'contradictions', 'gaps', 'nextMaterialUncertainty']) {
      expect(reading, key).toHaveProperty(key);
    }
    expect(reading.contradictions.length).toBeGreaterThan(0);
    // §14: gating retroactivo, no reinicio metodológico.
    expect(reading.restartFromStep0).not.toBe(true);
  });

  gapTest('G11', '"Importar iniciativas existentes" deja de ser "Siguiente fase" en /portfolio/iniciar (§14)', async ({ page }) => {
    await ensurePortfolioLead();
    await uiLoginLead(page);
    await page.goto('/portfolio/iniciar');
    // Sin esto, una página que no cargó haría "pasar" la ausencia de textos.
    await expect(page.getByText('Iniciar', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Siguiente fase/i)).toHaveCount(0, { timeout: GAP_TIMEOUT });
  });
});
