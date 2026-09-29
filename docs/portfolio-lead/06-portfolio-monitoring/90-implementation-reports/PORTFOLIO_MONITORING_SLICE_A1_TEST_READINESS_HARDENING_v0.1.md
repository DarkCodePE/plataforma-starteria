# Portfolio Monitoring — Slice A.1 Test Readiness Hardening

**Estado:** IMPLEMENTATION REPORT  
**Branch:** `feat/portfolio-monitoring-product-definition`  
**Base SHA:** `de7e652ff213acc2e750f208b6afcbcad047b46d`  
**Scope:** hardening de Slice A; no Slice B

## 1. Fixes applied

### Navigation isolation

`PortfolioLeadLayout` incorpora un modo focused únicamente para `/portfolio/setup`:

- conserva el layout y el gate de autenticación existentes;
- oculta la navegación ontology-first durante el setup;
- mantiene identidad Startería/Portfolio Lead;
- ofrece salida segura a `/portfolio/inicio`;
- no modifica ni elimina la navegación productiva fuera de esta ruta.

### Upload state

La affordance ya no parece un botón roto. Se muestra como capacidad futura:

```text
Subir información
No disponible durante esta prueba.
```

Pegar información y usar el fixture permanecen como caminos principales.

### Provenance hierarchy

P3 separa visualmente:

- `Declarado por ti` para la meta interpretada desde el texto del usuario;
- `Encontrado en tu información` para counts, señales e inventario;
- `Lectura Startería` para la interpretación y las agrupaciones propuestas.

No se creó ningún badge system global.

### Volume stress

Se añadió `NOVAGROWTH_EXPANDED_READING` y su input asociado, únicamente para dev/test:

- 24 iniciativas;
- 4 agrupaciones propuestas;
- owners completos e incompletos;
- 3 señales, reutilizando el límite de P3.

Cuando el reading supera el volumen base, P3 no renderiza 24 cards. Muestra agrupaciones, counts, señales y un resumen compacto del inventario. La CTA permanece visible.

### Prototype instrumentation

`prototypeInstrumentation.ts` proporciona un adapter local sin proveedor externo:

```text
portfolio_setup_started
portfolio_goal_submitted
portfolio_existing_work_submitted
portfolio_first_value_rendered
portfolio_rationale_opened
portfolio_interpretation_corrected
portfolio_relationship_review_clicked
```

Los eventos quedan disponibles mediante `subscribeToPortfolioSetupEvents`, `getPortfolioSetupEvents` y, en runtime de prueba, `window.__starteriaPrototypeEvents`. No hay backend ni analytics provider.

### Accessibility

Se corrigieron issues directamente relacionados con Slice A:

- se eliminó el `main` anidado dentro del layout;
- P1, P2 y processing tienen headings `h1` adecuados;
- textarea conserva labels reales;
- rationale conserva `aria-expanded`;
- processing conserva `aria-live`;
- upload future-state se comunica como nota explicativa;
- focused shell conserva landmark principal único.

La auditoría automatizada implementada para este slice verifica landmarks, headings, labels, disabled/future state, botones semánticos y estado expandido de rationale. No se añadió una dependencia axe pesada.

## 2. Files changed

- `front/src/app/layout/PortfolioLeadLayout.tsx`
- `front/src/features/portfolio-lead/first-value/PortfolioLeadFirstValuePage.tsx`
- `front/src/features/portfolio-lead/first-value/novaGrowthFixture.ts`
- `front/src/features/portfolio-lead/first-value/prototypeInstrumentation.ts`
- `front/src/features/portfolio-lead/first-value/__tests__/PortfolioLeadFirstValuePage.test.tsx`
- `front/e2e/portfolio-lead-first-value.spec.ts`
- `docs/portfolio-lead/06-portfolio-monitoring/90-implementation-reports/PORTFOLIO_MONITORING_SLICE_A1_TEST_READINESS_HARDENING_v0.1.md`

No se modificaron Core, Steps 0–4, Handoff, backend, Prisma, migrations, schemas ni eventos productivos.

## 3. Tests

### Unit/component

```text
npm run test:front -- --run src/features/portfolio-lead/first-value/__tests__/PortfolioLeadFirstValuePage.test.tsx
PASS — 1 file, 4 tests
```

Cubre focused-compatible journey, NovaGrowthExpanded, límite de 3 señales, ausencia de 24 cards, provenance y eventos locales.

### E2E

```text
npx playwright test e2e/portfolio-lead-first-value.spec.ts
PASS — 2 tests, 2 passed
```

Incluye:

- P0→P3 con focused navigation y provenance;
- eventos clave verificables desde `window.__starteriaPrototypeEvents`;
- audit estructural de accessibility P0–P3.

### Typecheck

```text
npm run typecheck:front
PASS
```

### Docker E2E

El runner completo `npm run test:e2e -- ...` sigue sin ejecutarse porque el daemon Docker no está disponible en este entorno. No bloquea A.1 según el Hardening Spec; el E2E aislado contra Vite con APIs mockeadas sí pasa.

## 4. Deviations

- Se mantuvo `/portfolio/setup` como ruta aislada.
- La navegación focused se implementó dentro de `PortfolioLeadLayout`, sin layout permanente nuevo.
- El audit de accesibilidad es estructural y específico del slice; no pretende sustituir una auditoría global WCAG/axe.
- NovaGrowthExpanded es accesible solo con copy explícito `dev/test` y no representa funcionalidad productiva.

## 5. Remaining risks

- El fixture expanded valida jerarquía con 24 iniciativas, pero no sustituye user testing con portfolios reales.
- El adapter de instrumentación es local y volátil; no persiste sesiones ni sustituye analytics productivo.
- El contraste visual completo no se ha auditado con una herramienta externa automatizada.
- P4 Relationship Review sigue fuera de alcance.

## 6. Final readiness

**READY_FOR_USER_TEST**

Slice A.1 elimina los problemas críticos de navegación, provenance y accesibilidad identificados en Acceptance Review. No se implementó Slice B ni ninguna superficie posterior a P3.
