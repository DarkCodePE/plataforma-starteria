// Recorrido de la entrada pública (/public/start) hasta la lectura inicial.
// Versión reducida de reachHandoff() en portfolio-entry-conversion.spec.ts: sin
// las aserciones de conteo de preguntas, que ya cubre ese spec.
import { expect, type Page } from '@playwright/test';

const visible = (locator: ReturnType<Page['getByText']>) => locator.isVisible().catch(() => false);

export async function reachEntryReading(page: Page, input: string, answer: string) {
  await page.goto('/public/start');
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto('/public/start');
  await page.getByLabel(/necesitas conseguir/i).fill(input);
  await page.getByRole('button', { name: /Analizar mi situaci[oó]n/i }).click();

  const reading = page.getByText(/Esto estoy entendiendo/i);
  const provisionalRoute = page.getByRole('button', { name: /Ver mi propuesta de abordaje/i });
  const activeQuestion = page.getByTestId('portfolio-entry-active-question');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await visible(reading)) return;
    if (await visible(provisionalRoute)) {
      const res = page.waitForResponse((r) => r.request().method() === 'POST' && /\/guided-exploration$/.test(r.url()));
      await provisionalRoute.click();
      await res;
      continue;
    }
    if (await visible(activeQuestion)) {
      await page.getByLabel(/Tu respuesta/i).fill(answer);
      const res = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/portfolio-entry\/sessions\/[^/]+\/messages$/.test(r.url()),
      );
      await page.getByRole('button', { name: /Enviar respuesta/i }).click();
      await res;
      continue;
    }
    await expect
      .poll(async () => (await visible(reading)) || (await visible(provisionalRoute)) || (await visible(activeQuestion)))
      .toBe(true);
  }
  await expect(reading).toBeVisible({ timeout: 30_000 });
}
