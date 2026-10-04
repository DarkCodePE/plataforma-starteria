// Marca de gaps del E2E Job-Driven (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md).
//
// Un gapTest describe lo que el doc pide y el producto todavía no hace. Corre con
// test.fail(): mientras el gap siga abierto la suite queda verde; el día que el
// producto lo cumple, Playwright lo reporta como "expected to fail but passed" y
// obliga a cambiar gapTest por test. La lista viva está en e2e/job-driven/COVERAGE.md.
import { test, type Page, type TestInfo } from '@playwright/test';

// Los gaps buscan algo que no existe: no tiene sentido esperar el timeout completo.
export const GAP_TIMEOUT = 5_000;

type Fixtures = { page: Page };

export function gapTest(id: string, title: string, body: (fixtures: Fixtures, testInfo: TestInfo) => Promise<void>) {
  // Playwright exige desestructurar los fixtures en la firma: no se puede reenviar el objeto entero.
  test(`[${id}] ${title}`, async ({ page }, testInfo) => {
    test.fail(true, `${id} abierto: ver e2e/job-driven/COVERAGE.md`);
    testInfo.annotations.push({ type: 'gap', description: id });
    await body({ page }, testInfo);
  });
}
