# ADR-011 — Public Landing V2 Platform + Fab narrative and Portfolio Entry disconnection

- **Estado:** ACCEPTED
- **Fecha:** 2026-11-19
- **Aprobado por:** responsable de producto de Startería para KAN-255
- **Ratificación registrada:** Jira `KAN-255`, comentario `10862`, 2026-11-19
- **Ámbito:** Landing pública `/` exclusivamente
- **Core vigente:** v0.2, sin cambios

## 1. Contexto

ADR-006 separó correctamente la explicación pública de Startería, Portfolio Entry y la conversión
comercial. Sin embargo, fijó un funnel donde Portfolio Entry debía permanecer accesible desde `/` y
Early Access y Demo debían presentarse como dos caminos independientes.

La implementación actual y KAN-255 adoptan una frontera más simple: `/` explica Startería Platform,
la asistencia de IA y la capacidad complementaria de Fab; `/public/start` sigue disponible como
superficie directa de Portfolio Entry, pero ya no forma parte del funnel ni de los accesos de la
Landing. La conversión pública utiliza un único destino comercial configurado.

## 2. Decisión aceptada

1. `/` es la superficie comercial y explicativa de Startería Platform. Debe comunicar valor para
   equipos de innovación, transformación, TI, estrategia, producto, procesos y mejora continua sin
   exigir interacción previa.
2. `/public/start` permanece disponible como ruta directa, pre-Core y gobernada íntegramente por
   Portfolio Entry. La Landing no ofrece enlaces, botones ni continuaciones hacia esa ruta.
3. La Landing utiliza una única familia de CTAs comerciales, todos dirigidos a
   `PUBLIC_LANDING_CONFIG.demoBookingUrl`. El destino inicia una conversación; no concede acceso,
   reserva, piloto, contratación ni resultado.
4. Fab se presenta como capacidad tecnológica opcional para iniciativas que necesitan desarrollo.
   No es un producto competidor de Platform, no implica integración automática Platform–Fab y no
   certifica capacidades no demostradas.
5. La Landing contiene una única demostración ilustrativa con cuatro etapas: clarificar un objetivo,
   conectar y priorizar iniciativas, ejecutar y preparar una decisión, y reutilizar aprendizaje.
6. Durante ejecución se muestran dos rutas no excluyentes: con el equipo y con Fab. Ambas convergen
   visualmente en entregables, evidencia, resultados y continuidad.
7. No se autorizan métricas, ROI, ahorros, capacidades BYO LLM, integración E2E o resultados no
   verificados.
8. KAN-255 es frontend-only. No cambia rutas, Portfolio Entry, Core, Steps 0–4, backend, IA
   productiva, Prisma/schema, persistencia, permisos, autenticación ni `sw-factory`.

## 3. Relación con ADR-006

```text
ADR-006: PARTIALLY SUPERSEDED BY ADR-011
```

### Se conserva

- `/` como Landing pública principal y fuera del auth guard;
- separación conceptual y técnica entre Landing y Portfolio Entry;
- `/public/start` como superficie directa, pública y pre-Core;
- representación ilustrativa, autoridad humana y no canonicalización;
- límites de Core, Steps, handoff, auth y conversiones;
- la conversión comercial no crea objetos ni autoridad de dominio.

### Queda superseded para `/`

- la obligación de que Portfolio Entry sea alcanzable desde la Landing;
- el funnel `Landing → Portfolio Entry`;
- la obligación de presentar Early Access y Demo como dos CTAs independientes;
- la obligación de explicar Copilot o Portfolio Entry dentro de la Landing.

ADR-011 no elimina Portfolio Entry ni cambia `/public/start`, su lógica, handoff o continuaciones.

## 4. Reconciliación de contratos de Landing

- `STARTERIA_PUBLIC_LANDING_UX_SPEC_v0.1.md` queda
  `SUPERSEDED_FOR_ROOT_LANDING_BY_ADR_011` en sus bloques obligatorios de Portfolio Entry y en el
  funnel Early Access/Demo.
- `STARTERIA_PUBLIC_LANDING_PORTFOLIO_ENTRY_CONTINUATION_ARCHITECTURE_v0.1.md` queda
  `PARTIALLY_SUPERSEDED_FOR_ROOT_LANDING_BY_ADR_011`; conserva valor histórico para la separación y
  la continuación de Portfolio Entry.
- `KAN-102_LANDING_ENTRY_CONVERGENCE_v0.1.md` permanece como evidencia histórica de KAN-102, no como
  autoridad del nuevo `/`.
- `PORTFOLIO_ENTRY_LOGIC_CONTRACT_v0.1.md`, ADR-002, ADR-003, ADR-004, ADR-005 y ADR-007 permanecen
  sin cambios.
- Design System Contract v0.1 y Page Anatomy System v0.1 continúan gobernando foundations,
  accesibilidad y anatomía pública.

## 5. Claims y conversión autorizados

La Landing puede afirmar que Startería combina plataforma, asistencia de IA y capacidad tecnológica
de Fab para ayudar a desarrollar iniciativas con claridad, ejecución y aprendizaje. Debe distinguir
lo ilustrativo de capacidades o resultados verificados.

La CTA puede explicar que la primera conversación permite conocer la situación y evaluar una demo
contextualizada o un posible piloto acordado. No puede prometer que la conversación produzca acceso,
aceptación, reserva, piloto o entrega.

## 6. No regresión

- Cero enlaces desde `/` a `/public/start`.
- `/public/start` sigue siendo accesible directamente y no cambia.
- Ninguna visual crea o representa como real `Organization`, `StrategicFront`, `Challenge`,
  `Initiative`, `Step`, `Evidence` o `Decision`.
- La IA asiste; las decisiones y autoridad organizacional siguen siendo humanas.
- Fab se enlaza como información externa y capacidad complementaria, sin cambiar su repositorio.
- No se crean rutas comerciales nuevas ni captura de datos en la Landing.

## 7. Autorización de implementación

La ratificación de KAN-255 autoriza materializar este ADR, reconciliar Authority Map, Manifest y
Current State, y ejecutar el slice frontend descrito. La implementación requiere
`V2_CHANGE_GUARDRAIL_CHECK: Proceed YES`, pruebas, evidencia renderizada, revisión humana y PR.

No autoriza merge ni despliegue automático.

## 8. Fuentes

- Jira KAN-255 y comentario de ratificación `10862`.
- `docs/implementation/public-landing/KAN-255_AUTHORITY_RECONCILIATION_PROPOSAL_v0.1.md`.
- `doc/product-adr/ADR-006-landing-and-portfolio-entry-separation.md`.
- `docs/STARTERIA_AUTHORITY.md`.
- `STARTERIA_V2_MANIFEST.md`.
- Design System Contract v0.1 y Page Anatomy System v0.1.

