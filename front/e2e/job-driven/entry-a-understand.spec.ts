// Entrada A — "Necesito entender y ordenar lo que realmente debemos mover".
// doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §5, §3, §25.
import { expect, test } from '@playwright/test';
import { reachEntryReading } from '../support/entry';

const INPUT = 'Me pidieron reducir el abandono de clientes pero no se por donde empezar.';
const ANSWER = 'Necesitamos entender que esta pasando antes de decidir si movilizar un equipo.';

test.describe('Entrada A · entender antes de movilizar (§5)', () => {
  test('texto libre → interpretación → qué entendimos → decisión a habilitar → qué falta (§5)', async ({ page }) => {
    await reachEntryReading(page, INPUT, ANSWER);

    await expect(page.getByText(/Esto estoy entendiendo/i)).toBeVisible();
    await expect(page.getByText(/Decisión (a|que necesitas) habilitar/i).first()).toBeVisible();
    await expect(page.getByText(/Lo que todavía puede cambiar la decisión/i).first()).toBeVisible();
    // §1/§25: la entrada pública no le pide al usuario elegir un objeto de dominio.
    await expect(page.getByText(/Crear (frente|reto) /i)).toHaveCount(0);
    await expect(page.getByText(/Step 0/i)).toHaveCount(0);
  });

  // La regla vive en suggestedRoute.ts: decisión abierta y una meta que no dijo la persona → no
  // hay mandato que movilizar. Es una orientación de presentación: no agrega destinos al handoff
  // ni cambia la continuidad (PORTFOLIO_ENTRY_LOGIC_CONTRACT §10/§22.1, POST_ENTRY §4).
  test('la ruta sugerida puede ser "todavía no activar trabajo" (§5 Resultado)', async ({ page }) => {
    await reachEntryReading(
      page,
      'Escuche que la competencia lanzo algo con IA, no tengo un problema concreto ni presupuesto.',
      'No hay un objetivo ni un dueno definido todavia, solo curiosidad.',
    );
    const route = page.getByTestId('portfolio-entry-suggested-route');
    await expect(route).toHaveAttribute('data-destination', 'not_now', { timeout: 15_000 });
    await expect(route).toContainText('Todavía no activar trabajo');
  });

  test('la lectura muestra una ruta sugerida, sin cambiar el destino (§3, §5)', async ({ page }) => {
    await reachEntryReading(page, INPUT, ANSWER);
    await expect(page.getByTestId('portfolio-entry-suggested-route')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('portfolio-entry-suggested-route')).toHaveAttribute(
      'data-destination',
      /portfolio_setup|portfolio_analysis|organization_context|initiative|explore|not_now/,
    );
  });
});
