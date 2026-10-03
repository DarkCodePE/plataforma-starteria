# Registro de ADR del harness

Las decisiones de diseño de **esta herramienta**: por qué probar tiene dos fases, por qué no hay
gates, por qué las skills se empaquetan como plugin y cómo se separan las decisiones del harness de las del producto. Decisiones durables.

## Hay dos series de ADR y no se mezclan

| | ADR de **harness** (esta serie) | ADR de **producto** (Starteria) |
|---|---|---|
| Qué cambian | cómo funciona la herramienta | una regla del producto |
| Dónde viven | `docs/adr/` | `doc/product-adr/` |
| Formato | el de este archivo | Development Harness §4.6, plantilla en `/starteria-decision` |
| Quién los escribe | quien mantiene el harness | quien gobierna el producto |
| Cuántos hay | 13 | **ninguno todavía** |

`ADR-001` de una serie no tiene nada que ver con `ADR-001` de la otra. Cuando
`/starteria-decision` redacte el primer ADR de producto, va a ser el `ADR-001` **de esa serie**, y
no se numera después del undécimo de acá.

## Casi todos están en `proposed`, a propósito

Un ADR pasa a `accepted` solo cuando una persona lo aprueba, y eso no lo puede hacer la herramienta
que los escribió. Es `ADR-007` aplicado a sí mismo. Hay tres excepciones, y dos son de forma:

- `ADR-001` está `superseded`, que registra un hecho (lo reemplazó `ADR-008`) y no una aprobación.
- `ADR-006` está `superseded` por lo mismo: lo reemplazó `ADR-010`.
- `ADR-010` está `accepted`, y es de fondo: producto lo aprobó en sesión el 2026-09-12 y la
  herramienta **transcribió** esa aprobación. Transcribir una aprobación que ocurrió es lo que
  `AGENTS.md` permite; producir una que nadie dio es lo que prohíbe. Sin esa firma el borrado de
  `PARA-CHATGPT.md` no se podía hacer, porque `ADR-007` ata cualquier borrado a una decisión
  aceptada.

Para firmar uno: `status: accepted`, `aprobado_por: <tu nombre>`, `aprobado_en: <fecha>`.

## Índice

| ID | Título | Estado | Lo que se paga |
|----|--------|--------|----------------|
| [ADR-001](ADR-001-skills-en-claude-skills-no-en-el-clon.md) | Las skills viven en `.claude/skills/`, no dentro del clon de mattpocock | **superseded** → ADR-008 | quedaban mezcladas con las skills de ruflo |
| [ADR-002](ADR-002-probar-separa-responder-de-puntuar.md) | `/starteria-probar` separa responder de puntuar, y declara la contaminación | proposed | correr un caso cuesta dos pasos |
| [ADR-003](ADR-003-sin-gates-la-verificacion-es-humana-y-se-declara.md) | Sin gates: nada se verifica solo, y el harness lo dice en voz alta | proposed | si nadie corre nada, nadie se entera |
| [ADR-004](ADR-004-alcance-v01-portfolio-entry.md) | El alcance de v0.1 es Portfolio Entry, no Starteria entero | proposed | las suites están incrustadas en dos comandos |
| [ADR-005](ADR-005-citar-doc-no-copiarlo.md) | Los comandos citan `doc/`; solo dos archivos derivan contenido | proposed | `RUBRICA.md` puede quedar vieja sin fallar |
| [ADR-006](ADR-006-un-cuerpo-de-markdown-dos-runtimes.md) | Un cuerpo de markdown para Claude Code y ChatGPT, con el renombrado como precio | **superseded** → ADR-010 | el armado de ChatGPT es manual |
| [ADR-007](ADR-007-el-harness-no-escribe-en-doc.md) | El harness no escribe en `doc/`, y ningún comando promueve a `aceptado` | proposed | los casos redactados esperan a que alguien los integre |
| [ADR-008](ADR-008-el-harness-se-empaqueta-como-plugin.md) | El harness se empaqueta como plugin, con las skills autodescubiertas en `skills/` | proposed | se perdió el cero-instalación en este repo |


Los ADRs de producto se consultan aparte en `doc/product-adr/ADR-INDEX.md`.
| [ADR-009](ADR-009-dos-harnesses-el-producto-y-el-productor.md) | El repo tiene dos harnesses: el producto que se instala y el productor que lo construye | proposed | un segundo harness es un segundo harness que mantener |
| [ADR-010](ADR-010-un-solo-runtime-y-el-estado-como-artefacto.md) | Un solo runtime, y el estado del harness como artefacto encadenado que una memoria indexa | **accepted** | se pierde ChatGPT, y el harness gana una dependencia de servicio |
| [ADR-011](ADR-011-dos-runtimes-una-sola-fuente-de-skills.md) | Dos runtimes otra vez, pero con una sola fuente de skills y las degradaciones declaradas | proposed | un `PASS` ya no vale lo mismo en todos lados |
| [ADR-013](ADR-013-el-ciclo-de-desarrollo-se-distribuye-como-plugin-aparte.md) | El ciclo de desarrollo se distribuye como un segundo plugin, starteria-desarrollo, con un init por marcadores y el .env resuelto desde el checkout principal | proposed | en este repo el ciclo deja de cargar solo, y el formato del init es una puerta de una vía |


La columna de la derecha existe porque un registro de decisiones que solo cuenta las ventajas no
sirve para revisarlas después.

## Formato

Frontmatter con `id`, `title`, `status`, `type`, `date`, `deciders`, `supersedes`, `superseded_by`,
`aprobado_por`, `aprobado_en`, `review_trigger` y `tags`. Cuerpo en seis secciones: contexto y
problema, decisión, alternativas consideradas, consecuencias (positivas y negativas), criterios de
aceptación, gatillos de revisión, más historial.

Tomado del harness del BCR (`docs/adr/`), sin los campos `hu` y `spec`, que son de su flujo de
historias de usuario y acá no aplican.
