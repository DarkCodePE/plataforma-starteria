# KAN-257 — Paquete de aprobación visual V4.2

**Estado:** `READY_FOR_HUMAN_VISUAL_REVIEW / IMPLEMENTATION_BLOCKED`  
**Autoridad productiva:** sin cambios; `V2_CHANGE_GUARDRAIL_CHECK: Proceed NO`.  
**Alcance de esta entrega:** prototipo HTML aislado, evidencia visual, QA y preparación de una eventual Fase B. `front/` no forma parte del cambio.

## Propuesta consolidada

La referencia candidata es [`Starteria_Landing_V4_2_Secciones.html`](./Starteria_Landing_V4_2_Secciones.html). Integra en una sola narrativa:

1. el hero editorial centrado V4.1, con Startería como sistema que conecta contexto, objetivos, iniciativas, ejecución y aprendizaje;
2. una única demostración interactiva con tres perspectivas diferentes: Estrategia, Ejecución y Resultados;
3. el caso ficticio de 48 h de línea base, 24 h de objetivo y 30 h de resultado;
4. impacto, capacidad adicional de Startería Fab y límites explícitos de la propuesta;
5. la composición asimétrica V4.2 de públicos;
6. FAQ de confianza, restaurada porque el handoff declaraba que debía preservarse y la navegación ya la enlazaba;
7. el propósito editorial V4.2 con manifiesto numerado, sin volver al recurso visual de círculos;
8. CTA comercial y pie de página.

La dirección visual busca calma editorial y profundidad de sistema. El elemento memorable es la continuidad entre el mapa central del hero, las tres perspectivas de una misma iniciativa, la jerarquía asimétrica de públicos y el manifiesto numerado. La referencia ARIA se utiliza como listón compositivo, no como contenido, marca ni patrón de integraciones.

## Correcciones cerradas

### Contraste y legibilidad

La nota final de Públicos pasó de `#75728c` sobre `#fbfaff` —4.45:1, por debajo de AA— a `#5f5c73`, con **6.19:1**. También se corrigieron los contrastes heredados de V4:

| Elemento | Color final | Contraste verificado |
|---|---:|---:|
| Nota final de Públicos | `#5f5c73` | 6.19:1 |
| Descripción secundaria de tabs | `#59576c` | 6.99:1 |
| Estado de iniciativa y etiqueta de métrica | `#5f5c6d` | 6.48:1 |
| Notas generales | `#626171` | 6.06:1 |
| Detalle de roles | `#625f72` sobre `#f2efff` | 5.46:1 |

Se mantuvieron completas y sin salto las cifras `48 h`, `24 h` y `30 h`. En móvil se elevó a 10 px el mínimo de varias microetiquetas que antes quedaban excesivamente pequeñas, sin comprimir la jerarquía principal.

### Semántica e interacción

- Se añadieron nombres accesibles y semántica de grupo a las escenas complejas de Fab, públicos y propósito.
- El botón de menú móvil mide 44 × 44 px y mantiene nombre/estado mediante `aria-expanded` y `aria-controls`.
- Los tres tabs superan 44 px de alto, soportan click, `ArrowLeft`, `ArrowRight`, `Home` y `End`, mueven el foco y actualizan `aria-selected`.
- La FAQ se abre con teclado y conserva foco visible.
- El enlace externo de Fab conserva `target="_blank"` y `rel="noopener noreferrer"`.
- `prefers-reduced-motion: reduce` elimina el movimiento de conexión.
- Se añadió un favicon embebido para evitar un 404 de consola que Lighthouse contabilizaba como fallo de Best Practices.
- No existe ningún enlace desde la landing a `/public/start`.

## Responsive y evidencia visual

Las cuatro composiciones se verificaron sin overflow horizontal, texto cortado, chips superpuestos ni errores de runtime.

| Viewport | Página completa | Observación |
|---|---|---|
| 1440 × 1000 | [`v42_consolidated_1440_full.png`](./v42_consolidated_1440_full.png) | Jerarquía editorial amplia; escenas y capas conservan profundidad. |
| 1024 × 900 | [`v42_consolidated_1024_full.png`](./v42_consolidated_1024_full.png) | Hero y secciones reordenan columnas sin perder contexto. |
| 768 × 900 | [`v42_consolidated_768_full.png`](./v42_consolidated_768_full.png) | Transición tablet estable; controles y textos siguen legibles. |
| 390 × 844 | [`v42_consolidated_390_full.png`](./v42_consolidated_390_full.png) | Composición móvil propia, con revelado progresivo y controles utilizables. |

Evidencia focal:

- Hero: [`1440`](./v42_consolidated_hero_1440.png) · [`390`](./v42_consolidated_hero_390.png)
- Estrategia: [`1440`](./v42_consolidated_demo_estrategia_1440.png) · [`390`](./v42_consolidated_demo_estrategia_390.png)
- Ejecución: [`1440`](./v42_consolidated_demo_ejecucion_1440.png) · [`390`](./v42_consolidated_demo_ejecucion_390.png)
- Resultados: [`1440`](./v42_consolidated_demo_resultados_1440.png) · [`390`](./v42_consolidated_demo_resultados_390.png)
- Públicos: [`1440`](./v42_consolidated_publicos_1440.png) · [`390`](./v42_consolidated_publicos_390.png)
- Propósito: [`1440`](./v42_consolidated_proposito_1440.png) · [`390`](./v42_consolidated_proposito_390.png)

La nueva composición de Públicos evita las tres tarjetas equivalentes de V4: el módulo de innovación y transformación explica coordinación transversal, mientras pequeños negocios y pymes aparecen como puntos de entrada distintos. Propósito abandona la composición orbital y utiliza una pieza editorial numerada más coherente con la identidad Startería.

## QA reproducible

Comandos ejecutados:

```powershell
rtk node docs/design-references/landing-v4-2/qa-v4-2-reference.mjs
rtk node C:\Users\User\.codex\plugins\cache\ecc\ecc\2.2.3\skills\frontend-design-direction\scripts\check-evidence.js docs/design-references/landing-v4-2/v4-2-design-evidence.json
```

Resultado del QA Playwright:

- 1440, 1024, 768 y 390 px: sin overflow ni errores de runtime;
- las tres perspectivas se activan y muestran la escena correcta;
- `48 h`, `24 h` y `30 h` están presentes y visibles;
- tabs, foco visible, menú móvil y FAQ pasan por teclado;
- objetivos táctiles esenciales cumplen 44 px;
- reduced motion pasa;
- destino y atributos de seguridad de Fab pasan.

Lighthouse final:

| Estado auditado | Dispositivo | Accessibility | Best Practices | SEO | Agentic Browsing | Fallos |
|---|---|---:|---:|---:|---:|---:|
| Estrategia / navegación completa | Desktop | 100 | 100 | 100 | 100 | 0 |
| Estrategia / navegación completa | Mobile | 100 | 100 | 100 | 100 | 0 |
| Ejecución / snapshot | Desktop | 100 | 100 | 100 | 100 | 0 |
| Ejecución / snapshot | Mobile | 100 | 100 | 100 | 100 | 0 |
| Resultados / snapshot | Desktop | 100 | 100 | 100 | 100 | 0 |
| Resultados / snapshot | Mobile | 100 | 100 | 100 | 100 | 0 |

La integración de Lighthouse disponible audita Accessibility, Best Practices, SEO y Agentic Browsing, pero no emite categoría Performance; por tanto no se declara un score de rendimiento. Tampoco sustituye una auditoría manual WCAG completa. El registro estructurado de evidencia está en [`v4-2-design-evidence.json`](./v4-2-design-evidence.json).

## Crítica de fidelidad y hallazgos pendientes

La referencia alcanza el objetivo compositivo: no es una secuencia de tarjetas genéricas, sino una narrativa con mapa, escenas de producto, conexiones y jerarquía editorial. Cada perspectiva cambia de composición y de pregunta; Ejecución concentra próxima acción, criterio, ownership, apoyos, checkpoints y ruta Fab. El móvil no escala el escritorio: reorganiza tabs, escenas, públicos y manifiesto.

Quedan decisiones humanas, no defectos técnicos del prototipo:

1. confirmar que la prominencia del público corporativo no comunica exclusión de pequeños negocios y pymes;
2. ratificar `Más aprendizaje que permanece` como promesa de experiencia basada en evidencia confirmada, no como memoria automática ni escritura canónica;
3. ratificar que las afirmaciones de impacto son hipótesis a evaluar y no ROI, ahorro o resultado garantizado;
4. confirmar la longitud total de la landing y la presencia de FAQ en el alcance productivo;
5. validar la comprensión con usuarios reales; el QA visual no demuestra comprensión ni conversión;
6. mantener el enlace de demo desde configuración productiva, no copiar el Calendly codificado en el HTML de referencia.

## Archivos exactos para una futura Fase B

Sólo después de la ratificación, reconciliación contractual y un nuevo `Proceed YES`, la implementación frontend prevista modificaría:

| Archivo productivo | Cambio futuro |
|---|---|
| `front/src/app/pages/LandingPage.tsx` | Reordenar y componer hero, demo, impacto, Fab, Públicos, FAQ, Propósito y CTA; mantener login, skip link, configuración comercial y ausencia de acceso a Portfolio Entry. |
| `front/src/app/components/landing/TransformationFlow.tsx` | Convertir el flujo actual en la escena central V4.1 con contexto, objetivos, iniciativas, ejecución y aprendizaje conectados. |
| `front/src/app/components/landing/StarteriaInteractiveStory.tsx` | Sustituir las cuatro etapas actuales por tres perspectivas con escenas distintas, navegación WAI-ARIA, caso 48/24/30, ownership, guía, checkpoints y Fab. |
| `front/src/app/components/landing/landing.css` | Transferir tokens, profundidad, layouts, responsive 1440/1024/768/390, foco visible y reduced motion sin copiar estilos sueltos fuera del sistema. |
| `front/src/app/pages/__tests__/LandingPage.test.tsx` | Actualizar copy, orden, tres tabs, métricas, escenas, públicos, FAQ, propósito, enlaces configurados, Fab y cero `/public/start`. |
| `front/src/app/routes.public-entry.test.tsx` | Actualizar el titular y ancla pública esperados, preservando `/` fuera del guard y la inexistencia de enlaces a `/public/start`. |
| `front/e2e/public-landing-l1.spec.ts` | Reescribir el journey visual/interactivo para tres perspectivas, teclado, responsive, métricas, FAQ, públicos, propósito, CTA configurado y capturas comparativas. |

Archivos que deben verificarse pero **no** deberían modificarse por este alcance: `front/src/app/config/publicLanding.ts`, `front/src/app/components/landing/StarteriaMark.tsx`, `front/src/app/routes.ts`, `front/e2e/portfolio-entry-conversion.spec.ts` y `scripts/jev-regresion.cases.json`. Si la implementación obliga a cambiarlos, el alcance real habrá divergido y KAN-257 deberá volver a afilarse antes de continuar.

No se prevén cambios de backend, Prisma, IA, Core, rutas productivas ni contratos de API.

## Texto propuesto de ratificación de producto

> **Ratificación visual y de alcance — KAN-257**  
> Yo, **[nombre y rol de la persona con autoridad de producto]**, en fecha **[AAAA-MM-DD]**, apruebo la propuesta consolidada `docs/design-references/landing-v4-2/Starteria_Landing_V4_2_Secciones.html` y sus capturas como baseline visual candidata para implementar la landing pública `/`.  
>  
> Ratifico expresamente: (1) el hero V4.1 centrado y su promesa de conectar objetivos, iniciativas, ejecución y aprendizaje; (2) una única demostración con tres perspectivas —Estrategia, Ejecución y Resultados— en sustitución de las cuatro etapas actuales; (3) el caso íntegramente ficticio con 48 h de línea base, 24 h de objetivo y 30 h de resultado, sin presentarlo como dato de cliente, benchmark, ahorro o ROI; (4) ownership humano, guía contextual, checkpoints, apoyos y decisiones no automáticas; (5) Startería Fab como capacidad técnica adicional con enlace a su landing oficial, sin afirmar integración automática certificada; (6) las composiciones y textos V4.2 de Públicos, FAQ y Propósito, incluida la jerarquía asimétrica y el manifiesto sin círculos; (7) que el aprendizaje reutilizable se refiere a evidencia y decisiones confirmadas y no a memoria automática ni autoridad factual de la IA; (8) que la landing no enlaza a `/public/start` y que los CTA comerciales consumen la configuración productiva existente.  
>  
> Autorizo preparar la subtarea técnica frontend de KAN-257 y la reconciliación documental necesaria con ADR-011, `STARTERIA_V2_MANIFEST.md` y `CURRENT_STATE.md`. Esta ratificación no autoriza backend, Prisma, IA, Core, merge ni despliegue; tampoco convierte por sí sola el guardrail en `YES`. La implementación sólo podrá empezar cuando esos artefactos de autoridad estén aceptados, los bloqueos de Jira estén resueltos y se publique un nuevo `V2_CHANGE_GUARDRAIL_CHECK: Proceed YES`.

## V2_CHANGE_GUARDRAIL_CHECK

```text
V2_CHANGE_GUARDRAIL_CHECK
Ticket: KAN-257
Requested phase: future React implementation
Current authority: visual prototyping and review only
Current approved product baseline: KAN-255 + ADR-011
Manifest slice for KAN-257: missing
Accepted contractual reconciliation for V4.2 delta: missing
Explicit human visual/product approval: missing
Backend / Prisma / AI / Core authority: not requested and not granted
Proceed: NO

To change to YES:
1. human ratification of the visual baseline and bounded claims;
2. accepted reconciliation/addendum against ADR-011;
3. explicit KAN-257 slice and state in Manifest / Current State;
4. unblocked technical frontend subtarea with CA and verification matrix;
5. a fresh V2_CHANGE_GUARDRAIL_CHECK showing those facts.
```

## Límite de entrega

No se modificó `front/`, no se abrió PR productivo, no se hizo merge y no se ejecutó CD. La tarea se detiene para revisión humana con estado **bloqueada por aprobación visual y autoridad de Fase B**.
