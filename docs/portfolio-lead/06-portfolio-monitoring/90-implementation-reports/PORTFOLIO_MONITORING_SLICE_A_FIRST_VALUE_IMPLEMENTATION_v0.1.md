# Portfolio Monitoring — Slice A First Value Implementation v0.1

**Estado:** PROTOTYPE IMPLEMENTATION REPORT  
**Vertical:** Portfolio Lead → Initiative Portfolio Monitoring & Intervention  
**Slice:** A — First Value  
**Base SHA:** `812cb3a2259c8d5702eb821a1cc05a83c4342585`  
**Branch:** `feat/portfolio-monitoring-product-definition`

## 1. Scope delivered

Se implementó únicamente el journey local de prototipo:

```text
P0 Primera visita
→ Preparar mi espacio
→ P1 Definir qué quieres conseguir
→ P2 Añadir trabajo existente
→ procesamiento mock
→ P3 First Analytical Value
→ Revisar cómo se relaciona
```

La última CTA termina en `NEXT_SLICE_PLACEHOLDER`. No se implementó P4 Relationship Review.

## 2. Route

La ruta aislada utilizada es:

```text
/portfolio/setup
```

Está registrada bajo `PortfolioLeadLayout` en `front/src/app/routes.ts`. La ruta existente `/portfolio/iniciar` y la Home actual no fueron reemplazadas ni refactorizadas.

## 3. Reused surfaces

- `PortfolioLeadLayout` como shell autenticado y de acceso Portfolio Lead.
- Primitives del Design System: `Button`, `Card` y `Textarea` desde `front/src/app/components/ui/`.
- Patrones visuales existentes: jerarquía de cards, estados accesibles, CTA semánticas y composición local.
- La decisión de aislamiento sigue el audit: no se altera el Bootstrap persistido ni la Home estable porque su flujo actual requiere continuación/backend y contiene estados posteriores al alcance de Slice A.

## 4. New prototype files

- `front/src/features/portfolio-lead/first-value/PortfolioLeadFirstValuePage.tsx`
- `front/src/features/portfolio-lead/first-value/novaGrowthFixture.ts`
- `front/src/features/portfolio-lead/first-value/__tests__/PortfolioLeadFirstValuePage.test.tsx`
- `front/e2e/portfolio-lead-first-value.spec.ts`

El único archivo existente modificado de producto/frontend es `front/src/app/routes.ts`, exclusivamente para registrar `/portfolio/setup`.

## 5. Fixture and mocks

`novaGrowthFixture.ts` contiene el fixture controlado con:

- 7 iniciativas;
- 5 responsables mencionados;
- 3 agrupaciones propuestas;
- 3 señales de revisión como máximo;
- goal/horizon interpretados de forma determinista;
- rationale y provenance explícitos.

`analyzeNovaGrowth()` es un mock local de interpretación. El procesamiento usa un retardo corto controlado en frontend. No se llama a IA, backend nuevo, base de datos ni analytics productivo.

El CTA `Usar ejemplo NovaGrowth` está rotulado como disponible únicamente para prototipo/dev/test y no se expone como funcionalidad productiva normal fuera de esta ruta aislada.

## 6. Tests and validation

### Unit/component

```text
npm run test:front -- --run src/features/portfolio-lead/first-value/__tests__/PortfolioLeadFirstValuePage.test.tsx
PASS — 1 test file, 2 tests
```

Cubierto:

- CTA `Preparar mi espacio`;
- goal input y transición de guía;
- fixture NovaGrowth;
- First Analytical Value;
- 7 iniciativas, 5 owners, 3 groups;
- máximo 3 señales;
- rationale y provenance;
- CTA de frontera hacia placeholder P4.

### E2E

```text
npx playwright test e2e/portfolio-lead-first-value.spec.ts
PASS — 1 test, 1 passed
```

La ejecución reproducible se realizó contra Vite con APIs de autenticación/datos mockeadas en Playwright. La envoltura completa `npm run test:e2e -- ...` no pudo iniciar su Postgres aislado porque el daemon Docker no estaba disponible en el entorno; no es un fallo del test del slice.

### Typecheck

```text
npm run typecheck:front
PASS
```

## 7. Spec deviations

- Se eligió `/portfolio/setup` como ruta aislada en lugar de sustituir `/portfolio/iniciar`, para no romper la experiencia activa ontology-first mientras se valida el prototipo.
- `Subir información` aparece como affordance visible pero deshabilitada: el camino canónico probado es pegar/usarlo con fixture, y el spec permite mockear upload sin convertirlo en backend.
- El progreso de guía se muestra como `1 de 5` durante setup y `2 de 5` en P3. P4 y posteriores se mantienen como pendientes explícitos.
- Copilot contextual no se añadió visualmente en esta primera implementación porque la validación P0–P3 queda cubierta sin una dependencia adicional; no se modifica el Copilot existente ni se introduce uno nuevo.

## 8. Known risks and constraints

- La ruta está bajo el layout existente y, por tanto, conserva su gate de autenticación; no redefine autorización.
- El fixture es una representación de testing, no un contrato de dominio ni un read model.
- La lectura y las agrupaciones son propuestas, no Challenges, relaciones confirmadas, owners confirmados ni estados canónicos.
- El processing mock no mide precisión de IA.
- No se modificaron Handoff, Core, Steps 0–4, backend, schemas, migrations, events ni persistence.

## 9. Readiness for Slice B

Slice A está listo para revisión manual del comportamiento P0–P3. Slice B puede evaluar una Relationship Review aislada sobre el output provisional, reutilizando el fixture y los patrones de rationale/provenance, pero no debe arrancar automáticamente en esta ejecución ni promover las agrupaciones a Challenge canónico.
