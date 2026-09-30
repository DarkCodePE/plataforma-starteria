# Starteria Public Landing — Frontend Current State Audit

**Documento:** `docs/implementation/public-landing/STARTERIA_PUBLIC_LANDING_FRONTEND_CURRENT_STATE_AUDIT_v0.1.md`  
**Versión:** v0.1  
**Estado:** AUDIT / IMPLEMENTATION PLANNING ONLY  
**Fecha:** 2026-09-30  
**Alcance observado:** ruta `/` y dependencias de presentación directamente relevantes.  
**Cambios runtime en esta ejecución:** ninguno.

## 1. Executive summary

La ruta `/` ya tiene una landing de plataforma con headline, explicación del proceso, bloques de confianza e indicios de producto. Sin embargo, el componente monta `PortfolioEntryExperience` dentro del hero como superficie interactiva principal, y el usuario debe introducir contexto para avanzar. No hay CTA directo visible para Early Access ni demo, tampoco un preview reconocible de workspace. La implementación presenta un modelo mixto: el texto habla de plataforma, mientras que la interacción y la composición hacen que Portfolio Entry/Copilot parezca el producto y la puerta general.

ADR-006 está `ACCEPTED`; la UX Spec está `DOCUMENTAL ONLY / LISTA PARA REVISIÓN` e indica `Implementación autorizada: NO`. Este documento es evidencia y planificación, no autoriza código, rutas ni integración comercial. Core v0.2 se conserva en su estado factual “Base fundacional revisada / Por validar”; `docs/core/STARTERIA_CORE_LOGIC_CONTRACT.md` es candidato y no autoridad promovida.

Recomendación: comenzar una futura implementación con **L1 — Landing framing / Hero**, tras emitir su autorización de slice y guardrail. Desacoplar primero la explicación de plataforma del formulario de Portfolio Entry; conservar el flujo `/public/start` intacto. Los caminos comerciales directos dependen de contratos ya aceptados pero sin superficies runtime autorizadas ni rutas definidas.

## 2. Routes and entry points

- `front/src/app/routes.ts`: el index de `RootLayout` renderiza `LandingPage` en `/`. Está fuera de `AppLayout`/guard de autenticación; `/auth` y `/dashboard` son destinos existentes.
- `/public/start` monta `PublicStartPage` bajo `PublicLayout`. La landing incrusta `PortfolioEntryExperience` con `variant="landing"`, `recoverExisting={false}` y `redirectAfterStart="/public/start"`.
- `LandingPage` no ofrece enlaces a `/public/start` que eviten iniciar el widget, ni rutas comerciales directas. No se inventan destinos Early Access/Demo en esta auditoría.
- Login navega a `/auth`; visitante autenticado navega a `/dashboard` desde el mismo control del header.

## 3. Current page architecture

`front/src/app/pages/LandingPage.tsx` es una página monolítica de composición y contenido. Define arrays locales para ruta de plataforma, problemas, pasos, señales y principios; incluye `PlatformStructure` local y monta la experiencia de Portfolio Entry directamente. No se observan subcomponentes de landing separados ni un layout público compartido para `/`.

Estructura actual: header sticky; hero en dos columnas con texto y formulario; estructura de plataforma (desktop dentro del texto, móvil debajo del formulario); panel “Del texto a la estructura”; problema; “Cómo funciona”; señales de claridad; confianza; CTA final. No hay footer de landing. `PublicLayout` no envuelve `/` y corresponde a páginas públicas de entrada/continuación.

## 4. Component inventory

| Path | Responsabilidad / semántica actual | Dependencia DS; genérico o producto | Tests asociados | Recomendación |
|---|---|---|---|---|
| `front/src/app/pages/LandingPage.tsx` | Página `/`: header, hero, contenido, CTA y montaje de entrada; semántica de plataforma mezclada con entrada conversacional obligatoria de facto | `Button`, `Badge`, Tailwind utility classes; contenido Starteria específico | No se encontró test dedicado `LandingPage` | **ADAPT**; extraer secciones si la slice lo hace demostrable |
| `front/src/app/layout/RootLayout.tsx` | Proveedor/contexto raíz para rutas, no layout visual de landing | Infraestructura transversal | Route tests cubren montaje indirectamente | **KEEP** |
| `front/src/app/layout/PublicLayout.tsx` | Header/footer notice para rutas públicas de Portfolio Entry; el logo vuelve a `/public/start` y login a `/auth` | Tailwind; componente de aplicación específico para entry pública | No localizado test de layout específico | **KEEP** fuera de `/`; no reutilizar automáticamente como landing |
| `front/src/features/portfolio-entry/public/PortfolioEntryExperience.tsx` | Entrada guiada conversacional/formulario y telemetría propia; actualmente incrustada en el hero | Experiencia de producto específica; importa analytics del feature | `PortfolioEntryExperience.test.tsx`, `routes.public-entry.test.tsx` | **ADAPT** solo presentación/ubicación desde Landing; lógica interna **KEEP** congelada |
| `front/src/app/components/ui/button.tsx`, `badge.tsx`, `card.tsx` | Primitives UI reutilizables | DS primitives; genéricos | Tests de Button/Badge; no hallado test específico Card | **KEEP** |
| `front/src/app/components/design-system/patterns/PageHeader.tsx` | Patrón de header de páginas de producto autenticadas | Patrón DS genérico orientado a workspace, no necesariamente marketing | `page-patterns.test.tsx` | **KEEP**; no forzar su uso en landing |
| `PlatformStructure` (local en `LandingPage.tsx`) | Chips de prioridad→reto→iniciativa→evidencia→decisión | Utility classes; representación Starteria específica | Ninguno dedicado | **ADAPT** al preview ilustrativo, revisando vocabulario contra Core/Spec |

No se identificó primitive comercial específico para tarjetas Early Access/Demo ni un componente de workspace preview que se pueda reutilizar sin adaptación. Componentes autenticados de portfolio no deben presentarse como estado real de un visitante.

## 5. Current CTA map

| CTA/control actual | Qué hace hoy | Destino | ¿Sigue válido? / tratamiento |
|---|---|---|---|
| Marca “Starteria” (button) | Navega a `/` | `/` | Válido; **KEEP**, preferible semántica de enlace para navegación |
| Navegación “Problema” | Ancla a `#problema` | Misma página | **ADAPT** si se renombra/reestructura sección |
| Navegación “Como funciona” | Ancla a `#como-funciona` | Misma página | Válido; **KEEP/ADAPT** al destino final |
| Navegación “Confianza” | Ancla a `#confianza` | Misma página | Válido como soporte, quizá footer/section; **ADAPT** |
| “Iniciar sesión” / “Ir al panel” | Navega según autenticación | `/auth` o `/dashboard` | Válido como acción secundaria de acceso; **KEEP**, validar jerarquía en mobile |
| Submit dentro de `PortfolioEntryExperience` | Inicia la experiencia de entrada y luego redirige según su implementación | `/public/start` indicado como redirect | Mantener experiencia; desde landing reubicar y explicar como opcional (**ADAPT**) |
| “Analizar mi situacion” | Ejecuta `window.scrollTo({top:0})`; no inicia análisis ni navega | Scroll al top del mismo `/` | Acción confusa y duplicada respecto al widget; **REMOVE/REPLACE** por jerarquía CTA aprobada, sin inventar destino |

No hay CTAs actuales para solicitar Early Access o demo. No hay destinos productivos que esta auditoría pueda asignarles; deben definirse bajo sus contratos y autorización propia.

## 6. Current mental model assessment

**Evaluación: mezcla con predominio funcional de B — “Starteria = Portfolio Entry / Copilot”.** La evidencia textual apoya A: badge “Plataforma de decisiones para portafolios”, headline sobre decisiones conectadas al negocio, y explicación de prioridades, retos, iniciativas, evidencia y decisiones. La evidencia de interacción pesa más: `PortfolioEntryExperience` ocupa la columna derecha del hero y pide acción para que la persona avance; el CTA final dice “Analizar mi situación”; no existe una vista de workspace. Por tanto, la plataforma se describe, pero la entrada conversacional se experimenta como producto principal.

## 7. UX Spec gap analysis

Tratamientos `KEEP / ADAPT / REMOVE / NEW` se usan según la taxonomía solicitada. “Risk” señala riesgos de una futura implementación, no defectos confirmados.

| Sección UX Spec | Current state | Target state | Gap | Treatment | Files likely affected | Risk | Test requirement |
|---|---|---|---|---|---|---|---|
| 1. Hero | Headline y subcopy de plataforma; formulario de Portfolio Entry en el hero; sin jerarquía de tres caminos | Comprender Starteria antes de introducir contexto; producto/workspace visible; acciones claras y opcionales | Widget domina sobre explicación; no hay CTA directos comerciales ni visual preview clara | **ADAPT** Hero; **ADAPT** colocación PE | `LandingPage.tsx`, primitives UI, quizá nuevo componente local | Alto: framing y promesa; riesgo de convertir PE en gate o representar datos ficticios como reales | Component test de jerarquía, links y modelo; axe/manual keyboard; responsive visual |
| 2. How Starteria Works | Cuatro pasos orientados a la lectura de contexto del visitante, no al recorrido plataforma→trabajo→evidencia→decisión | Explicar proceso de Starteria y valor de plataforma sin exigir input | Hay material reutilizable, secuencia conceptual parcial | **ADAPT** | `LandingPage.tsx` | Medio: no afirmar automatización/autoridad IA no aprobada | Component assertions de orden/contenido y mobile |
| 3. Product Preview | Chips estructurales y tarjetas de señales ilustrativas; no workspace reconocible ni composición de producto | Preview conceptual de workspace, explícitamente ilustrativa y sin análisis real | Presencia rudimentaria y no representa seguimiento/decisión en contexto | **ADAPT** local `PlatformStructure`; **NEW** preview si se requiere panel compuesto | `LandingPage.tsx`, posible nuevo `front/src/app/components/landing/*` | Alto: confundir ilustración con datos reales o canonicalización | Test de disclaimer/semántica y visual desktop/mobile |
| 4. Optional Portfolio Entry | Experiencia real embebida en hero; sin encuadre explícito “opcional” y no hay acceso alternativo equivalente | Bloque separado, opción para quien necesita ordenar punto de partida; link de entrada sin forzarla | La lógica permanece válida, su ubicación y framing no | **ADAPT** presentación únicamente | `LandingPage.tsx`, `PortfolioEntryExperience.tsx` solo si se necesita prop de presentación; rutas no cambian | Alto: regresión inadvertida al flujo público o a analytics/redirect | Mantener tests de feature y route; test landing muestra opción opcional y navegación existente |
| 5. Continuation / Commercial Paths | No existen opciones directas Early Access/Demo; tampoco bloque de continuidad | Dos caminos independientes y elección clara; continuación post-entry preserva origen/contexto | Superficies y destinos no están implementados; contratos definen semántica pero no rutas/proveedores | **NEW** superficies cuando existan rutas autorizadas; **ADAPT** integración PE→continuation en slice propia | Futuros componentes/páginas/rutas, fuera del cambio actual | Muy alto: rutas/consentimiento/persistencia/integración sin autoridad técnica concreta | Contratos, tests de journeys directos y de continuation; idempotencia/privacy si hay envío |
| 6. Final CTA / Footer | CTA final scroll-to-top; no footer; navegación superior parcial | Cierre que presenta caminos sin competir; footer con navegación/acceso pertinente | CTA no realiza la promesa nominal; footer ausente | **REMOVE** CTA actual; **NEW** cierre/footer según la Spec | `LandingPage.tsx`; links solo cuando destinos aprobados | Alto: invitar a rutas no definidas o repetir CTA principales | Tests de destino/semántica y keyboard; responsive footer |

## 8. KEEP / ADAPT / REMOVE / NEW matrix

| Clasificación | Elementos |
|---|---|
| **KEEP** | Ruta `/` pública fuera del guard; acceso `/auth` y `/dashboard`; principios de confianza compatibles con revisión humana; primitives Button/Badge/Card; tests existentes de Portfolio Entry sin cambios |
| **ADAPT** | Framing y headline/subcopy; header y jerarquía de navegación; orden y contenido How it Works; `PlatformStructure` hacia preview ilustrativa; widget Portfolio Entry a bloque explícitamente opcional; anclas y adaptación mobile |
| **REMOVE** | CTA “Analizar mi situación” en su forma actual de scroll-to-top; cualquier presentación implícita de Portfolio Entry como única acción principal (no retirar el feature) |
| **NEW** | Preview de workspace reconocible y declarada ilustrativa; superficies directas de Early Access y Demo cuando estén autorizadas; bloque de opciones comerciales; footer de landing; tests dedicados de landing y journeys |

## 9. Design System reuse

- Tokens/estilos activos: Tailwind utilities y CSS variables/tema en `front/src/styles/theme.css`; revisar valores reales antes de modificar. Evitar valores de color arbitrarios nuevos.
- Primitives reutilizables: `front/src/app/components/ui/button.tsx`, `badge.tsx`, `card.tsx`; la jerarquía debe mantener una acción dominante y alternativa visible según Page Anatomy.
- Estructura y steps: los artículos numerados actuales son candidatos; convertir en proceso compacto y legible, no usar patrones de workflow autenticado como si fueran marketing.
- Preview: `PlatformStructure` y cards de señales son el único material local cercano; adaptar con datos estáticos claramente ilustrativos. No reutilizar datos reales ni componentes autenticados ligados a entidades del portfolio.
- Portfolio Entry block: conservar `PortfolioEntryExperience` como experiencia de producto, pero enmarcarlo con copy y una acción secundaria. No crear otro design system ni cambiar su lógica.
- Early Access/Demo: Card primitive sirve para choices, con botones accesibles y promesas separadas conforme a ambos Experience Contracts. No agregar campos, consentimiento, calendario o persistencia desde el landing.

## 10. Responsive gaps

- Producto visible antes del input: en desktop el widget ocupa la columna derecha del primer viewport; en móvil el formulario viene antes de `PlatformStructure`, por lo que el producto se ve después de la interacción potencial. Gaps claros.
- CTA visibility: la entrada conversacional sí queda muy visible; login también. Los caminos directos comerciales no existen. La navegación desktop se oculta bajo `md` sin menú equivalente, aunque login persiste.
- Preview density: chips se distribuyen en cinco columnas en `sm` (≥640px), con riesgo de densidad/anchos; móvil estrecho usa stack. La preview no muestra evolución/decisión de workspace.
- Mobile hierarchy: móvil ordena texto → Portfolio Entry → estructura; refuerza “input primero”. Landing larga con bloques repetidos de cards; falta validar scroll, foco y CTA de cierre en viewport estrecho.
- Evidencia de QA visual existente en `docs/design-system/visual-direction-vd03/` y `visual-direction-vd04/`; los scripts E2E cubren screenshots con viewports declarados, no acreditan por sí mismos legibilidad o accesibilidad.

## 11. Accessibility gaps

Fortalezas observadas: landmarks `header`, `nav` con `aria-label`, `main`, secciones, headings jerárquicos, botones nativos, CTA con texto y estilos `focus-visible` al menos en marca. Los anchors nativos son operables por teclado.

Gaps a confirmar/corregir en implementación posterior: marca como `<button>` para navegación en vez de link; revisar focus-visible para todos los anchors/Buttons (delegación al primitive no comprobada en esta inspección); contraste del texto pequeño sobre fondos translúcidos; orden de lectura vs orden visual responsive; anclas/header sticky y foco al llegar; labels/errores del widget dependen del feature y quedan fuera de scope; iconos decorativos verificando `aria-hidden`; ausencia de test axe identificado para landing. Requisito: revisión por teclado y lector, contraste automatizado/manual y test accesible de componente sin modificar el feature PE.

## 12. Analytics current state

No se encontró integración general de analytics de Landing en `front/src`. Portfolio Entry tiene módulo propio `features/portfolio-entry/public/analytics` y eventos de ese funnel, probado vía mock en `PortfolioEntryExperience.test.tsx`/`routes.public-entry.test.tsx`. No se deben atribuir esos eventos al resto de la landing. La UX Spec/contracts piden eventos conceptuales separados por camino; futura slice deberá acordar implementación, privacidad y taxonomía, evitando texto sensible. No instrumentar en esta ejecución.

## 13. Test inventory

- **Unit/component de landing:** no se localizó `LandingPage.test.tsx` ni test de `PlatformStructure`.
- **Route:** `front/src/app/routes.public-entry.test.tsx` cubre acceso/rutas públicas relacionadas con Portfolio Entry; verificar su escenario exacto antes de depender en futura implementación.
- **Portfolio Entry:** `front/src/features/portfolio-entry/public/__tests__/PortfolioEntryExperience.test.tsx`; además tests de servicios/analytics según feature. No tocar ni sustituir.
- **E2E de `/`:** `front/e2e/visual-direction-vd02-public-entry.spec.ts`, `visual-direction-vd03-landing-narrative.spec.ts`, `visual-direction-vd04-chat-first-landing.spec.ts` toman screenshots. No hay journey funcional específico de la Landing identificado.
- **E2E `/public/start`:** `front/e2e/public-start-access.spec.ts`, `public-pdf-autofill.spec.ts`, `portfolio-entry-conversion.spec.ts`, y capturas visuales de VD01/VD02. Deben permanecer intactos y pasar cuando se autoricen cambios relacionados.
- **Tests futuros:** unit/component para sección, headline, modelo de plataforma, CTA, preview ilustrativa y footer; test de ruta pública `/` sin auth; E2E de acceso PE opcional y sus rutas existentes; journeys directos Early Access/Demo solo después de que existan rutas/contracts de implementación aprobados; continuation preservando origen; regresión de `/public/start` y handoff; visual desktop/tablet/móvil; a11y/teclado. No correr tests en esta auditoría.

## 14. Files likely affected

**Probables para slices de landing:**

- `front/src/app/pages/LandingPage.tsx`
- nuevos componentes acotados bajo `front/src/app/components/landing/` (solo si facilitan tests/reuso)
- `front/src/app/components/ui/button.tsx`, `badge.tsx`, `card.tsx` solo si se demuestra una necesidad DS compatible
- `front/src/styles/theme.css` únicamente si el token existente no cubre el diseño; no añadir sistema paralelo
- nuevos `*.test.tsx` de landing y posiblemente `front/e2e/*landing*.spec.ts`

**Fuera de alcance / no modificar:** `front/src/app/routes.ts`, `PortfolioEntryExperience` lógica, servicios/analytics PE, `PublicStartPage`, handoff, backend, contracts, Core, Steps 0–4. Rutas Early Access/Demo requieren decisión separada.

## 15. Implementation risks

1. Confundir framing aprobado con autorización para implementar; UX Spec sigue documental y ADR-006 explícitamente no autoriza runtime.
2. Crear rutas o enviar solicitudes comerciales sin contrato técnico de destino, consentimiento, estado, persistencia e idempotencia.
3. Debilitar o alterar indirectamente Portfolio Entry al mover props, navegación o telemetría.
4. Presentar cards ilustrativas como workspace real, análisis, evidencia canónica o decisión.
5. Forzar CTAs competidores y violar la jerarquía DS de acción primaria y alternativa.
6. Romper anchors, foco, lectura móvil o acceso autenticado al simplificar el header.
7. Cambiar rutas para “arreglar” CTA antes de que sus nombres/destinos sean decididos.
8. Alterar `doc/` contractual durante implementación; este informe es documentación de auditoría en `docs/implementation/`, no reemplaza contratos.

## 16. Recommended implementation slices

Todas requieren HU/subtarea técnica y autorización explícita de implementación; este audit no las autoriza.

| Slice baseline | Recomendación y contenido mínimo | Dependencia / puede ser PR propio |
|---|---|---|
| **L1 — Landing framing / Hero** | Reformular jerarquía de plataforma, producto visible antes de input, CTA hierarchy usando solo destinos existentes; presentar PE como opción | Primer PR recomendado; no crear rutas comerciales; mantener enlace funcional existente |
| **L2 — How Starteria Works** | Alinear pasos con plataforma, iniciativas, evidencia, seguimiento y decisiones; copy subordinado a Core | Puede ir independiente tras L1; no implica alterar lógica |
| **L3 — Product Preview** | Crear/adaptar preview estática, marcada ilustrativa; mostrar contexto/workspace sin datos visitantes | PR separado recomendable por revisión de contenido y riesgo semántico |
| **L4 — Portfolio Entry repositioning** | Mover widget a bloque opcional con framing y acceso; respetar componente, redirect y analytics actuales | Puede combinarse con L1 solo si tests prueban no-regresión; de lo contrario PR separado |
| **L5 — direct Early Access / Demo surfaces** | No iniciar hasta tener alcance/rutas/runtime autorizados; respetar contratos accepted y sus límites | Bloqueada por decisión técnica/implementación de destinos; likely slices/PR separados por funnel |
| **L6 — continuation integration** | Integrar caminos posteriores a handoff y contexto versionado/provisional sin cambiar handoff runtime en esta ejecución | Dependencia de autoridad y definición de integración; separar de L5 si responsables/dependencias cambian |
| **L7 — analytics + tests** | Taxonomía de eventos por origen, privacidad y cobertura journeys/visual/a11y | Tests acompañan cada slice desde su inicio; instrumentación puede ser PR propio solo con decisión sobre analytics |

La secuencia óptima no obliga a un único PR: L1/L4 podrían unificarse si el cambio es pequeño y el test de frontera existe; L2/L3 se pueden revisar separadamente; L5/L6 no deben bloquear la claridad de plataforma ni fingir destinos existentes. L7 es transversal: los tests van con cada cambio, mientras que la estrategia analítica puede constituir una slice propia.

## 17. No-regression constraints

- `/` permanece pública; no moverla bajo auth guard.
- `/public/start` permanece destino y experiencia directa pre-Core. No cambiar sus rutas/tests.
- No cambiar clarificación, recuperación, propuesta, handoff, payloads, persistencia o continuation runtime.
- No crear `Organization`, `StrategicFront`, `Challenge`, `Initiative`, `Step`, `Decision` ni Evidence canónica desde esta experiencia.
- No activar Step 0 ni cambiar Core, Adaptive Cycle, autoridad humana o Steps 0–4.
- No afirmar análisis del visitante antes de input ni presentar preview ilustrativa como real.
- Portfolio Entry sigue accesible, pero la Landing no lo plantea como requisito para conocer Starteria o convertir.
- Early Access y Demo deben ser destinos/comercial distintos de autenticación, canonicalización y activación.
- No inventar routes ni proveedores comerciales en este plan.

## 18. Final implementation recommendation

El runtime ya contiene contenido útil de plataforma, pero su jerarquía visual/interactiva no satisface todavía el modelo de ADR-006 y la UX Spec. El primer slice futuro debe ser **L1 — Landing framing / Hero**, centrado en que la plataforma y su preview se entiendan antes de pedir input, y en subordinar Portfolio Entry como vía opcional. No cambiar rutas ni lógica del feature. Si para cumplir la Spec es necesario crear conversión directa o tocar contratos/rutas, detener ese alcance y abrir la subtarea/autorización correspondiente.

**Blockers para implementar funnel completo:** la propia UX Spec no está marcada como autorización runtime; no hay rutas productivas/direct endpoints para Early Access/Demo; sus contratos dejan proveedor, arquitectura, estado técnico e integración fuera de alcance; ADR-006 dice que no autoriza frontend ni rutas. **¿Puede comenzar implementación segura?** No con la autorización documental disponible en esta ejecución. Puede prepararse una subtarea futura de solo Hero/framing si el proceso de producto la autoriza expresamente y se produce el `V2_CHANGE_GUARDRAIL_CHECK`; no iniciar por inferencia de este audit.
