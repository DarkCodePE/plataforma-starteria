---
id: ADR-012
title: "El ciclo de HU se paga por ruta: triage R0/R1/R2/Q, spec antes de los tickets en lo grande, y cada ticket y PR legible para negocio"
status: proposed
type: standard
date: 2026-10-03
deciders: [Orlando]
supersedes: null
superseded_by: null
aprobado_por: null
aprobado_en: null
review_trigger: "cuando la ruta se suba a mitad de camino en más de un pedido de cada cinco, o cuando un R0 termine necesitando subtareas: cualquiera de las dos dice que el triage corta mal"
tags: [productor, ciclo, triage, spec, jira, pr, negocio, jev]
---

# ADR-012: El ciclo de HU se paga por ruta

Ámbito: slice `DEV_CYCLE_HU_TOOLING` (`STARTERIA_V2_MANIFEST.md` §2.3), del lado **productor**
(`ADR-009`). No cambia ningún comando de `starteria-harness`.

## 1. Contexto y problema

`AGENTS.md` §3 describe un solo ciclo para todo pedido: `/hu` clasifica con Jev, entrevista, escribe
un brief, el `delivery-planner` arma una HU con subtareas [Funcional] y [Técnica], y recién ahí se
implementa. La clasificación de Jev (pregunta, acotado, grande) ya existe, pero **no cambia el
camino**: sólo cambia cuántas HU salen.

Eso falla por los dos extremos:

- **Lo chico paga de más.** Cambiar el texto de un botón recorre brief, HU, dos subtareas y dos
  aprobaciones. El costo del ciclo supera al del cambio, y lo previsible es que alguien lo saltee.
- **Lo grande queda corto.** Las HU de un pedido grande se cortan antes de que nadie haya decidido
  el cómo. Las subtareas [Técnica] terminan inventando `Áreas` y `Enfoque`, que es lo que la regla
  "volver a `/hu`" intenta atajar después, cuando ya hay código.

Hay además dos problemas que no dependen del tamaño:

- **Nadie fuera de desarrollo lee un ticket ni un PR.** No dicen qué cambia para el usuario ni qué
  objetivo del equipo mueven. El scorecard C1 a C4 existe, pero ningún ticket lo cita.
- **La aprobación está partida por frente** ([F] firma producto, [T] firma desarrollo), y en la
  práctica las dos firmas las da la misma persona en la misma conversación.

Las decisiones de este ADR las tomó Orlando en la entrevista `/hu` del 2026-10-02 (HU KAN-91). El
ADR las registra; no las reabre.

## 2. Decisión

**El ciclo tiene cuatro rutas y cada pedido paga sólo la suya.** Un agente de triage la propone al
entrar el pedido: Jev contesta las preguntas sobre el texto, el agente verifica contra el repo lo
que Jev no puede ver, y **una persona confirma la ruta**.

| Ruta | Cuándo | Qué sale en Jira | Antes de implementar |
|---|---|---|---|
| **R0 directo** | cambio cosmético o dentro de un flujo existente, un solo frente, sin contrato entre frentes ni autoridad de backend, Prisma, IA productiva o Core | **un issue sin subtareas**, con "Por qué importa" y 1 a 3 CA | un único [P]: la persona aprueba el issue |
| **R1 acotado** | modifica algo existente y no dispara nada de R2 | HU + subtareas, **el plan va dentro de la [Técnica]** | brief aprobado y plan aprobado |
| **R2 grande** | capacidad nueva, cambia algo de lo que otros dependen, tres o más capas, o un contrato entre frentes | **épica + HU-0 con la Tech Spec** (y ADR si hace falta); las demás HU se cortan **desde la spec** | spec aprobada |
| **Q pregunta** | busca una respuesta, no un cambio que quede | un spike, o nada si se contesta en la sesión | ninguna; no queda código |

Reglas que no tienen excepción:

1. **La ruta sólo sube.** Si aparece complejidad escondida, se sube y se dice. Nunca se baja para
   ahorrar pasos. Un R1 que resulta tocar un contrato entre frentes **es** R2.
2. **R2 no entra a `/implementar` sin spec aprobada.** La spec la redacta `/spec` y pasa de
   PROPUESTO a APROBADO **cuando una persona mergea su PR**. Desde ahí es autoridad: las [Técnica]
   la citan y no deciden nada que ella no haya decidido.
3. **Una épica R2 cierra con una revisión final contra su spec**: lo entregado se compara con lo que
   la spec decidió, no sólo HU por HU.
4. **R0 sigue teniendo ticket.** "Sin HU no se implementa" (`AGENTS.md` §3) se mantiene en las
   cuatro rutas; R0 sólo achica el ticket.

**Cada ticket y cada PR son legibles para negocio.**

- Cada HU y cada subtarea llevan una sección **"Por qué importa"**: qué cambia para quien usa
  Starteria o para el equipo, sin jerga.
- Cada HU cita la **fila del scorecard C1 a C4** (perspectiva y objetivo/KPI) que mueve. Una HU sin
  fila lleva un aviso, **no se bloquea**.
- Cada PR abre con un **"Resumen ejecutivo"** de 3 a 5 líneas: qué cambia para el usuario, por qué,
  qué objetivo mueve y el riesgo.
- El planner y `/pr` los generan. `revisor-starteria` marca su ausencia como hallazgo.

**Una persona por punto de control.** Ya no hay firma [F] y firma [T]: quien conduce el ciclo
aprueba cada [P]. Las etiquetas [Funcional] y [Técnica] se quedan, pero **sólo dicen quién
ejecuta**, no quién aprueba.

**El triage se calibra con datos, y lo ajusta una persona.** Cada triage guarda en `estado/` las
respuestas de Jev, la ruta propuesta, la elegida y después el resultado. Un comando `/calibrar` lee
esos registros y **propone** cortes o preguntas nuevas para Jev. Nada se ajusta solo.

Qué queda para la Tech Spec del ciclo (KAN-95): dónde vive el agente de triage, el formato del
registro de calibración, la plantilla de `/spec`, la carpeta del scorecard en `docs/` y cómo se
reescribe `AGENTS.md` §3. Este ADR fija el **qué**; la spec, el **cómo**.

## 3. Alternativas consideradas

- **Seguir con un solo ciclo para todo:** rechazada. Es el problema. El costo fijo hace que lo chico
  se saltee el flujo, y lo grande sigue sin spec.
- **Tres rutas, como `brainstorming` de superpowers (spike, acotado, arquitectónico):** rechazada.
  Sin R0, un botón paga HU y subtareas; con R0 sin ticket se rompe "sin HU no se implementa".
- **R0 sin Jira, sólo el PR:** rechazada. Más rápido, pero rompe la regla de `AGENTS.md` y deja sin
  registro justo los casos con los que se calibra el corte entre R0 y R1.
- **`/spec` obligatoria cuando el planner marca "requiere ADR", sin mirar la ruta:** rechazada. Son
  dos criterios que pueden discrepar; con la ruta queda uno solo, y el contrato entre frentes ya la
  sube a R2.
- **Grande y acotado-con-contrato como dos criterios separados para `/spec`:** rechazada por lo
  mismo: subir la ruta es más simple que tener una excepción dentro de R1.
- **La spec aprobada con un "sí" en la conversación:** rechazada. Es más rápido pero no deja rastro
  en el repo, y `/implementar` necesita poder citarla como autoridad.
- **Mantener la doble firma [F]/[T]:** rechazada. Hoy la da la misma persona; la separación sólo
  agrega una espera sin agregar control.
- **Ajuste automático de los cortes de Jev:** rechazada por ahora. No hay datos suficientes para
  confiar en él; primero se registra, después se propone, y aprueba una persona.

## 4. Consecuencias

**Positivas**
- Un cambio chico cuesta lo que vale, y por eso deja de tener incentivo para saltearse el flujo.
- En lo grande, las [Técnica] citan decisiones en vez de inventarlas, y la épica se puede revisar
  completa contra algo escrito.
- Producto y lead pueden leer cada ticket y cada PR sin abrir el diff, y ver qué objetivo mueven.
- La calibración de Jev deja de ser a ojo: cada triage es un dato.

**Negativas y trade-offs aceptados**
- **El triage es un punto de falla nuevo.** Un R0 mal clasificado entra a código sin plan. La regla
  "sólo sube" lo mitiga a medias: depende de que alguien note la complejidad a tiempo.
- **R2 es más lento al principio.** Una épica espera una spec y su PR antes de la primera línea de
  código. Es el precio de que las HU no inventen el cómo.
- **Más texto por ticket.** "Por qué importa" y el resumen ejecutivo cuestan escribirlos aunque los
  genere el planner, y un texto de relleno es peor que no tenerlo.
- **El scorecard tiene que estar vivo.** Si nadie lo actualiza al cambiar de ciclo, las citas
  apuntan a objetivos viejos.
- **Una sola firma es menos control.** Se acepta porque hoy la doble firma no lo daba.

## 5. Criterios de aceptación de la decisión

- [ ] `AGENTS.md` §3 describe las cuatro rutas y la regla "sólo sube" (lo hace la HU que corte la
      spec de KAN-95).
- [ ] Existe el agente de triage y deja un registro por pedido en `estado/`.
- [ ] Una HU R2 no se puede empezar con `/implementar` sin una spec aprobada que citar, y
      `/implementar` lo dice al frenar.
- [ ] Un R0 de prueba (un cambio de texto en `front/`) recorre issue → `/implementar` → `/verificar`
      → `/pr` sin subtareas.
- [ ] El planner y `/pr` generan "Por qué importa" y "Resumen ejecutivo", y `revisor-starteria` los
      marca si faltan.
- [ ] El scorecard C1 a C4 está versionado en `docs/` y las HU citan su fila.
- [ ] La primera épica R2 real (la de observabilidad de ai-service) cierra con revisión final.

Ninguno se cumple con este ADR: todos dependen de la spec (KAN-95) y de las HU que corte.

## 6. Gatillos de revisión

- **La ruta se sube a mitad de camino con frecuencia.** Más de un pedido de cada cinco dice que el
  triage clasifica mal, y que hay que revisar las preguntas o los cortes antes que las reglas.
- **Un R0 termina necesitando subtareas o toca un contrato.** El borde entre R0 y R1 está mal puesto.
- **Las secciones de negocio se vuelven relleno.** Si los resúmenes ejecutivos se repiten o nadie
  los lee, el formato no está sirviendo y hay que cambiarlo, no sólo exigirlo.
- **Aparece una segunda persona aprobando.** Si producto vuelve a firmar por separado, la decisión
  de una persona por [P] se revisa.

## Historial

- 2026-10-03 · proposed · Redactado en KAN-93 a partir del brief de KAN-91 (entrevista `/hu` del
  2026-10-02, preguntas P1 a P16). Referencias de método: `triage` y `to-spec` de
  `mattpocock/skills`, `brainstorming` de superpowers y `spec` de gstack, leídas en
  `harness-starteria`.
