# Product ADR-012 — Landing V4.2: narrativa integral estrategia, ejecución y aprendizaje

- **Estado:** PROPOSED / AWAITING_PRODUCT_RATIFICATION
- **Fecha:** 2026-11-22
- **HU funcional:** KAN-259, hija de KAN-257
- **HU técnica:** KAN-258 (bloqueada hasta autoridad)
- **Ámbito:** landing pública `/`; no cambia reglas internas del producto
- **Decisión anterior:** Product ADR-011, ACCEPTED para KAN-255
- **Revisión visual:** KAN-257, comentario 10870: dirección visual aprobada para handoff, no implementación autorizada

## 1. Problema

ADR-011 congeló una explicación ilustrativa de cuatro etapas y una propuesta Platform/Fab. La iteración V4.2 recupera la narrativa completa de Startería, no solo el detalle de ejecución, y requiere separar de forma comprensible la capa estratégica del trabajo del equipo y el retorno de resultados al portafolio. El cambio no puede promoverse desde un prototipo sin decisión de producto explícita.

## 2. Decisión propuesta — pendiente de aceptar

Para la landing comercial `/` exclusivamente:

1. Comunicar Startería como plataforma que ayuda a convertir objetivos, necesidades y oportunidades de negocio en iniciativas guiadas, medibles y conectadas con decisiones.
2. Una única demostración ilustrativa con **tres perspectivas interconectadas**, no tres productos:
   - **Estrategia:** la coordinación del portafolio relaciona objetivo/KPI de negocio, retos, iniciativas existentes o candidatas, priorización y encargo.
   - **Ejecución:** una persona responsable recibe y acepta un brief con objetivo, alcance, horizonte, métricas, apoyos y criterios por revisar. Trabaja con su equipo mediante guía y Steps; Fab puede aportar ingeniería asistida por agentes si hace falta software. El referente del negocio y colaboradores intervienen cuando son pertinentes, sin convertirse en aprobadores universales.
   - **Resultados y retorno:** evidencia, KPI de la iniciativa, resultados observados y alternativas revisables de continuidad se devuelven a coordinación/autoridad organizacional. Los aprendizajes confirmados pueden orientar otras iniciativas.
3. Las cuatro etapas de ADR-011 continúan como conceptos explicativos **dentro** de las perspectivas cuando convenga; **no se alteran** el Core, Steps 0–4, su secuencia ni los estados canónicos. La estructura de tres perspectivas solo gobierna la comunicación pública.
4. El hero mantiene un mensaje comprensible sobre el vínculo entre estrategia, ejecución guiada y aprendizaje, con composición editorial centrada y visualizaciones SVG/CSS editables.
5. Mostrar impacto en negocio como hipótesis evaluables: claridad, coordinación, mejor uso de recursos, decisiones y aprendizaje; sin porcentajes, ROI o beneficios garantizados.
6. Segmentar el acercamiento para pequeños negocios, pymes y equipos corporativos sin crear tres productos ni prometer la misma intensidad de servicio en todos.
7. Conservar un bloque de confianza que conteste objeciones sobre privacidad, herramientas, modelos corporativos y cómo medir avances, sin afirmar capacidades no verificadas.
8. Mantener una invitación a democratizar la innovación y el CTA inclusivo «¿Tienes una necesidad por resolver o una oportunidad por desarrollar?» → «Solicitar una demo» dirigido **solo** a `PUBLIC_LANDING_CONFIG.demoBookingUrl`. La conversación no garantiza reserva, acceso, aceptación de piloto ni beneficios Early Users.

## 3. Límites irrenunciables

- **KPI vs. métrica de iniciativa:** mostrar la relación sin atribución causal automática. Ejemplo 48 h → 24 h → 30 h y horizontes temporales son exclusivamente ficticios, rotulados de manera visible y situados dentro de la demostración, no en la promesa principal.
- **IA y conocimiento:** una sugerencia de IA nunca equivale a decisión humana. No anunciar aprendizaje autónomo sin control, memoria compartida entre servicios o integración libre con LLMs de confianza si faltan comprobaciones técnicas, permisos y fuentes.
- **Integraciones:** no mostrar Teams, Jira o Notion como conectores activos sin evidencia; el producto puede trabajar desde contexto aportado y conectores verificados, cuando existan.
- **Fab:** enlazar `https://darkcodepe.github.io/sw-factory/` como referencia técnica de capacidad de desarrollo. No anunciar integración E2E Platform–Fab certificada ni sustitución automática de equipos.
- **Portfolio Entry:** cero enlaces desde `/` a `/public/start`. La ruta legacy, sus contratos, handoff, autenticación y persistencia permanecen intactos.
- No habilitar captura pública adicional, nuevos endpoints, esquemas o modificaciones en Core, Steps 0–4, backend, IA productiva, auth, permisos, BD, infraestructura o `sw-factory`.

## 4. Relación con Product ADR-011

Si este ADR llega a **ACCEPTED**, sustituirá **solo en la superficie `/`** la obligación de mostrar una demo de cuatro etapas independientes por la presentación integrada de tres perspectivas. Las cuatro etapas pueden subsistir como momentos internos de explicación. No se revierte la separación de Portfolio Entry y landing ni ninguno de los guardrails y límites aceptados en ADR-011.

Mientras `ADR-012` esté **PROPOSED**, **ADR-011 continúa siendo la autoridad vigente** y KAN-258 sigue bloqueada para cambiar código productivo.

## 5. Gobierno y aceptación técnica (propuestos)

1. La aprobación de producto debe citar explícitamente este ADR, el baseline visual exacto y KAN-259, mediante comentario trazable en Jira.
2. Antes de implementar deben publicarse en una rama revisable los artefactos **exactos** de `docs/design-references/landing-v4-2/`: HTML consolidado, informe de QA, capturas 1440/1024/768/390 y hashes de referencia. No basta el HTML V4.2 inicial, anterior a las correcciones de Codex.
3. Reconciliar `doc/product-adr/ADR-INDEX.md`, `docs/STARTERIA_AUTHORITY.md`, `STARTERIA_V2_MANIFEST.md` y `CURRENT_STATE.md` después de la ratificación, sin confundir CANDIDATE con ACTIVE.
4. Ejecutar `V2_CHANGE_GUARDRAIL_CHECK`: proceder con código productivo **solo con Proceed: YES**.
5. KAN-258 implementará la landing React en un PR propio, sin reescribir rutas ni semántica. Exigir typecheck, lint, build, Vitest, Playwright, accesibilidad, reduced-motion, responsive y capturas de paridad visual.
6. No merge ni CD automático; requieren revisión y autorización explícita.

## 6. Estado actual

**AUTHORITY_PROPOSAL_ONLY**. Es una propuesta documental para revisión funcional, **no** una autorización de implementación ni declaración de que V4.2 esté operativa.
