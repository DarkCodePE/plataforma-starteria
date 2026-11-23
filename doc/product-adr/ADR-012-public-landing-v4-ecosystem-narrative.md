# Product ADR-012 — Landing V4.2: narrativa integral estrategia, ejecución y aprendizaje

- **Estado:** ACCEPTED — Product ratification KAN-259#10874 (2026-11-23)
- **Fecha:** 2026-11-22
- **HU funcional:** KAN-259, hija de KAN-257
- **HU técnica:** KAN-258 (frontend público; implementación aún no iniciada y guardrail obligatorio)
- **Ámbito:** landing pública `/`; no cambia reglas internas del producto
- **Decisión anterior:** Product ADR-011, ACCEPTED para KAN-255
- **Revisión visual:** KAN-257#10870; baseline exacto PR #352 @ `74d6982503bfa2021db38b31e0e81993fe6899f7`, hashes SHA-256 registrados en KAN-259#10873
- **Ratificación de producto:** KAN-259#10874, aceptación explícita de las 8 condiciones de KAN-259#10873
- **Alcance de la ratificación:** reconciliación documental y repetición del guardrail; sin merge/CD, ni backend, Core, Steps 0–4, Prisma o IA productiva

## 1. Problema

ADR-011 congeló una explicación ilustrativa de cuatro etapas y una propuesta Platform/Fab. La iteración V4.2 recupera la narrativa completa de Startería, no solo el detalle de ejecución, y requiere separar de forma comprensible la capa estratégica del trabajo del equipo y el retorno de resultados al portafolio. El cambio no puede promoverse desde un prototipo sin decisión de producto explícita.

## 2. Decisión aceptada (KAN-259#10874)

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

La ratificación **ACCEPTED** sustituye, como autoridad de producto para la siguiente evolución de la superficie pública `/` únicamente, la obligación de mostrar cuatro etapas independientes por la presentación integrada de tres perspectivas. Las cuatro etapas pueden subsistir como momentos internos de explicación. No se revierte la separación de Portfolio Entry y landing ni ninguno de los guardrails y límites aceptados en ADR-011.

ADR-011 conserva autoridad histórica y sigue describiendo el **runtime React KAN-255 efectivamente implementado**, hasta que KAN-258 se integre y verifique. ADR-012 gobierna **el target comercial aprobado** de V4.2; aprobar ADR-012 no cambia automáticamente lo desplegado ni salta el guardrail, las pruebas o la revisión humana de los PR.

## 5. Gobierno y aceptación técnica

1. **CUMPLIDO:** ratificación expresa de Product ADR-012 y de las ocho condiciones de KAN-259#10873, mediante KAN-259#10874, contra PR #352 @ `74d6982`.
2. **CUMPLIDO EN PR ABIERTO, PENDIENTE DE INTEGRACIÓN A MAIN:** los 27 artefactos **exactos** de `docs/design-references/landing-v4-2/` están publicados en PR #352: HTML consolidado, QA, evidencia, capturas 1440/1024/768/390 y hashes. La implementación debe consumir esa identidad verificable, no el HTML anterior del chat.
3. Reconciliar en PR documental `doc/product-adr/ADR-INDEX.md`, `docs/STARTERIA_AUTHORITY.md`, `STARTERIA_V2_MANIFEST.md` y `CURRENT_STATE.md`; diferenciar **producto aceptado**, **baseline publicado en PR**, **runtime KAN-255 existente** y **KAN-258 aún no implementado**.
4. Ejecutar `V2_CHANGE_GUARDRAIL_CHECK`: proceder con código productivo **solo con Proceed: YES**.
5. KAN-258 implementará la landing React en un PR propio, sin reescribir rutas ni semántica. Exigir typecheck, lint, build, Vitest, Playwright, accesibilidad, reduced-motion, responsive y capturas de paridad visual.
6. No merge ni CD automático; requieren revisión y autorización explícita.

## 6. Estado actual

**PRODUCT_AUTHORITY_ACCEPTED / DOCUMENTARY_RECONCILIATION_IN_PR / REACT_V4_2_NOT_IMPLEMENTED**. Esta aceptación valida el cambio de narrativa de producto, **no** demuestra que V4.2 esté operativa ni autoriza merge/CD. El inicio de KAN-258 exige un `V2_CHANGE_GUARDRAIL_CHECK` trazable, en el checkout que contenga este ADR ratificado y el baseline exacto.
