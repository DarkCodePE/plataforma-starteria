# STARTERIA · DEV_CYCLE_HU_TECH_SPEC_v0.1

Versión: v0.1
Estado: PROPUESTO. Pasa a APROBADO cuando una persona mergea el PR que lo agrega (`ADR-012` §2, regla 2).
Vertical slice: `DEV_CYCLE_HU_TOOLING` (`STARTERIA_V2_MANIFEST.md` §2.3)
Usuario principal: quien conduce el ciclo de una HU (hoy, Orlando); lectores secundarios: producto y lead
Tipo: Technical Specification del harness productor (`ADR-009`)
Autoridad: `docs/adr/ADR-012-el-ciclo-de-hu-se-paga-por-ruta.md`, `docs/adr/ADR-013-el-ciclo-de-desarrollo-se-distribuye-como-plugin-aparte.md`
HU: KAN-91 (HU-0), subtarea KAN-95. Cierra CA-4 y CA-5.

---

# 0. Objetivo

Fijar el **cómo** de las decisiones de `ADR-012` (proceso) y `ADR-013` (distribución), y cortar
desde acá las seis HU de la épica. Esta spec no reabre lo que los ADR decidieron: los cita. Lo que
una HU de la épica implemente tiene que poder señalar una decisión de esta spec (`D-n`); si no
puede, la HU está inventando y vuelve a `/hu` (`AGENTS.md` §3).

# 1. Fuera de alcance

- El plugin de producto `starteria-harness`, sus skills `starteria*` y su gate (`scripts/verify.sh`
  sigue contando `Skills (10)` para él).
- Ajuste automático de los cortes de Jev (`ADR-012` §3).
- Ordenar o priorizar el backlog por scorecard: el scorecard sólo se cita.
- Cualquier código de la plataforma (front, backend, Prisma, ai-service, Core).

# 2. Invariantes

- **INV-1 Sin HU no se implementa**, en las cuatro rutas. R0 achica el ticket, no lo elimina.
- **INV-2 La ruta sólo sube.** Ningún paso del ciclo la baja.
- **INV-3 Una persona confirma** la ruta, el brief, el plan y cada merge. Ningún agente se aprueba a sí
  mismo ni toma un "confirmado" que le llegó por otro agente.
- **INV-4 Nada se ajusta solo.** `/calibrar` propone; una persona aprueba.
- **INV-5 Fuera de los marcadores del `init`, nada se escribe** en el repo destino.

# 3. Estado actual verificado (main @ 86bfec0)

| Pieza | Hoy | Hecho que importa para esta spec |
|---|---|---|
| `jev-clasificar.mjs` | 7 preguntas a Jev (4 sí/no, 2 opción, 1 puntaje); la clase la deriva el código con cortes 0.65/0.35/0.5 y sube un escalón por duda (`:30-32`, `:126-162`) | La salida `--json` ya trae `respuestas{}` y `confianzas{}`: es la materia prima de la calibración. No escribe nada; `/hu` guarda `estado/hu/<slug>.clase.json` |
| `/hu` | clasificar → grill → brief → planner (`SKILL.md:19-21`) | La clase no cambia el camino, sólo cuántas HU salen (`SKILL.md:43-47`) |
| `delivery-planner` | HU + `funcional[]` + `tecnica[]` con `bloqueadaPor` (`delivery-planner.md:84-131`) | No pide "Por qué importa" ni fila de scorecard. No conoce rutas |
| `jira-hu-crear.mjs` | exige ≥1 funcional y ≥1 técnica (`:83-85`); `epica` sólo como clave existente (`:203`); responsables opcionales por `.env` (`:120-127`) | No puede crear un R0 (issue sin subtareas) ni una épica |
| `/pr` y plantilla | 6 secciones: HU, CA, Resumen, Evidencia, Peligro, Chequeos | No hay "Resumen ejecutivo" |
| `revisor-starteria` | 7 controles numerados (`:38-55`) | Ninguno mira la capa de negocio ni la spec |
| `scripts/verify.sh` | gate del producto: `ESPERADAS=10`, `AGENTES_ESPERADOS=1` (`:16-17`) | No mira `.claude/skills` ni `.claude/agents`: el ciclo no tiene gate |
| tools del ciclo | `jira-comun.mjs` y `jev-clasificar.mjs` buscan `.env` en `JIRA_ENV_FILE`, junto al script y 6 ancestros del cwd | Desde un worktree hermano no llegan al checkout principal |
| tests de las tools | **no hay** ningún test de `jira-*.mjs` ni de `jev-clasificar.mjs` | Toda HU que toque una tool empieza por su primer test |
| Claude Code | `${CLAUDE_PLUGIN_ROOT}` se expande en el cuerpo de un `SKILL.md` y en `allowed-tools` (doc oficial, *skills* §"Where substitution happens"). Las skills de plugin se invocan `/plugin:skill`. `--plugin-dir` carga el plugin sólo para la sesión. Un marketplace puede listar varios plugins con `source` en subcarpetas | Resuelve el SUPUESTO de `ADR-013` §2.1 para skills. **Sigue abierto para agentes** (`agents/*.md`): la doc no lo dice |

Referencias por ruta a `.claude/skills/` o `.claude/agents/` que se rompen con la mudanza (lista
completa en §8.4): `AGENTS.md` (6), `TESTING.md` (1), la plantilla de PR (1), los dos agentes (6),
las skills del ciclo (6), `.gitignore` (2).

# 4. Decisiones por componente

Cada componente: decisión, alternativas descartadas acá (las de fondo están en los ADR), testing con
sus seams y rollback.

## 4.1 Triage (`ADR-012` §2)

**D-1. El triage es una fase nueva de `/hu`, no un agente aparte.** Va antes del grill y reusa
`jev-clasificar.mjs`. La salida de Jev pasa de `clase` a `ruta`:

| `clase` hoy | `ruta` | Regla adicional del agente (lo que Jev no ve) |
|---|---|---|
| `pregunta` | `Q` | |
| `acotado` | `R1` | baja a **propuesta** `R0` sólo si: `capas = una`, `interfaz_compartida < 0.35`, y el agente verifica con `Grep`/`Glob` que el flujo existe y que el diff esperado no toca `backend/`, `prisma/`, `ai-service/` ni un contrato entre frentes |
| `grande` | `R2` | |

"Baja a propuesta R0" no contradice INV-2: la ruta todavía no está fijada; lo que nunca baja es una
ruta **confirmada**. La persona confirma la ruta antes del grill.

**D-2. El script agrega `ruta` y `ruta_motivos` a su `--json`**, sin quitar `clase` (compatibilidad
con `estado/hu/*.clase.json` ya escritos). La regla de R0 que necesita el repo la aplica el agente,
no el script: el script sigue sin leer el repo.

**D-3. Qué hace cada ruta después de confirmada.**

- `Q`: no hay brief ni planner. Si la respuesta sale en la sesión, se registra el triage y termina.
  Si hace falta un spike, se crea un issue R0 cuyo entregable es un documento, no código.
- `R0`: grill de una ronda (actor, para qué, 1 a 3 CA), sin brief. El planner recibe la ruta y
  produce un plan con `ruta: "R0"` y **sin** `funcional[]`/`tecnica[]` (D-4). Un [P]: "¿lo creo?".
- `R1`: el ciclo actual. La [Técnica] lleva el plan (Áreas, Enfoque, Tareas) como hoy.
- `R2`: brief → épica + HU-0 cuya única [Técnica] es "escribir la spec con `/spec`" → la spec se
  mergea → `delivery-planner` corta las HU **desde la spec** (§4.2).

**D-4. `jira-hu-crear.mjs` acepta `ruta`.** Con `ruta: "R0"` crea un issue sin subtareas (los CA van
en su descripción) y no exige `funcional[]` ni `tecnica[]`. Sin `ruta`, el comportamiento actual
queda igual. Con `epica: {crear: "<nombre>"}` crea la épica y cuelga la HU de ella; con una clave,
como hoy.

**D-5. Subir la ruta a mitad de camino** se hace con `/hu --subir KAN-nnn <ruta> "<motivo>"`: no
reescribe el ticket, comenta en Jira el motivo y escribe el evento en el registro (§4.4). Si sube a
R2 con código ya escrito, la rama se para hasta que haya spec.

- *Descartado:* un agente `triage` separado. Agrega un despacho más por pedido y duplica la lectura
  del pedido que `/hu` ya hace; el triage necesita la misma conversación que el grill.
- *Testing:* el seam es la función que deriva `ruta` desde las respuestas de Jev, que se extrae de
  `jev-clasificar.mjs` a una función pura y se testea con respuestas fijas (sin red), con `node --test`.
  Casos: cada fila de la tabla de D-1, la subida por duda, y que la propuesta R0 nunca sale del script.
  `jira-hu-crear.mjs` se testea en modo dry-run con un plan R0 y uno con `epica.crear`.
- *Rollback:* sin `ruta` en el plan, `jira-hu-crear` se comporta como hoy; revertir el PR de `/hu`
  devuelve el ciclo actual sin migrar nada.

## 4.2 `/spec` y el corte desde la spec

**D-6. `/spec` es una skill nueva** que corre como única [Técnica] de una HU-0 R2. Escribe
`docs/<área>/<NOMBRE>_TECH_SPEC_v0.1.md` con esta plantilla mínima, más larga sólo si el pedido lo
pide:

```text
cabecera: Versión · Estado (PROPUESTO) · Vertical slice · Autoridad · HU
0 Objetivo · 1 Fuera de alcance · 2 Invariantes · 3 Estado actual verificado (con file:line)
4 Decisiones (D-n), cada una: alternativas · testing con seams · rollback
5 Contratos entre frentes (forma de request/response si los hay)
6 SUPUESTO / SIN RESOLVER
7 Corte de la épica: HU con historia, CA trazados a D-n, bloqueos
8 Autorevisión (lista de abajo)
```

Toma la forma de `PORTFOLIO_BOOTSTRAP_HOME_TECH_SPEC_v0.1.md` (cabecera, decisiones cerradas,
plan de PR) sin sus 38 secciones: las que no aplican no se escriben.

**D-7. Autorevisión antes del revisor.** `/spec` corre una lista fija sobre su propio texto: cada CA
del corte cita un `D-n`; cada `D-n` tiene testing y rollback; cada ruta citada existe; nada sin
fuente queda sin `SUPUESTO`. Después despacha `revisor-starteria` con el control 8 (D-10), máximo 3
rondas, como `/verificar`.

**D-8. La spec manda desde el merge.** `/implementar` agrega un paso 1b: si la HU padre tiene label
`r2`, busca en la [Técnica] la ruta de la spec y verifica que exista en `origin/main`; si no existe,
para con "bloqueada: R2 sin spec aprobada".

**D-9. El corte lo hace `delivery-planner` leyendo la spec**, una HU por bloque del §7 de la spec, y
la [Técnica] de cada HU cita sus `D-n` en `## Enfoque`. La épica cierra con una HU final
"revisión de la épica": `revisor-starteria` en modo épica compara la spec contra lo mergeado.

- *Descartado:* que la spec la redacte el planner. El planner corta tickets; decidir el cómo es otro
  trabajo y necesita leer el repo con detalle.
- *Testing:* la plantilla y la autorevisión se prueban con un fixture: una spec de juguete con un CA
  sin `D-n` tiene que fallar la autorevisión. El paso 1b de `/implementar` se prueba a mano con una
  HU `r2` cuya spec no está en main.
- *Rollback:* `/spec` es aditiva; si se revierte, R2 vuelve a escribir specs a mano como esta.

## 4.3 Capa de negocio

**D-10. El scorecard vive en `docs/governance/scorecard/STARTERIA_SCORECARD_C1_C4.md`**, con una
fila por objetivo y un id estable por fila (`SC-01` a `SC-18`, en el orden de la fuente). El
contenido sale de `estado/hu/ciclo-hu-spec.scorecard-fuente.md` sin cambios de texto. Cuando cambia
el ciclo C1 a C4 se edita en un PR; los ids no se reusan.

**D-11. Tres bloques, dónde y quién los genera:**

| Bloque | Dónde | Lo genera | Formato |
|---|---|---|---|
| `## Por qué importa` | descripción de cada HU y cada subtarea | `delivery-planner` | 2 a 4 líneas, sin jerga, desde el usuario o el equipo |
| `Scorecard: SC-nn · <perspectiva> · <objetivo>` | primera línea de `## Contexto` de la HU | `delivery-planner` | si no hay fila: `Scorecard: sin fila (aviso)` |
| `## Resumen ejecutivo` | primera sección del PR | `/pr`, y la plantilla de `.github/` | 3 a 5 líneas: qué cambia para el usuario, por qué, qué `SC-nn`, riesgo |

**D-12. El revisor suma el control 8, "Capa de negocio":** marca `[menor]` si falta cualquiera de
los tres bloques o si el `SC-nn` no existe en el scorecard. Nunca `[bloqueante]`: es aviso, como dice
`ADR-012`.

- *Testing:* el seam es el JSON del plan. Un test de `jira-hu-crear` en dry-run rechaza (aviso, no
  error) una HU sin `## Por qué importa`. El control 8 del revisor se prueba a mano con un PR sin
  resumen ejecutivo.
- *Rollback:* quitar los bloques de las plantillas; los tickets viejos no se tocan.

## 4.4 Calibración

**D-13. El registro es `estado/calibracion/triage.jsonl`**, una línea por evento, append-only:

```json
{"v":1,"t":"2026-10-04T12:00:00Z","evento":"triage","pedido_slug":"ciclo-hu-spec",
 "jev":{"respuestas":{},"confianzas":{},"modelo":"jev-latest","clase":"grande"},
 "ruta_propuesta":"R2","ruta_confirmada":"R2","confirmo":"Orlando","hu":null}
{"v":1,"t":"...","evento":"creada","pedido_slug":"ciclo-hu-spec","hu":"KAN-91"}
{"v":1,"t":"...","evento":"subida","hu":"KAN-91","de":"R1","a":"R2","motivo":"..."}
{"v":1,"t":"...","evento":"resultado","hu":"KAN-91","cerrada":"2026-10-20",
 "senales":["r2_sin_spec","subtarea_inventa","skill_equivocada","init_rompe","ruta_subida"]}
```

`estado/` está ignorado (`.gitignore:20`): el registro es local de quien conduce el ciclo, como el
brief. `pedido_slug` une los eventos antes de que exista la clave.

**D-14. Quién escribe cada evento:** `triage` lo escribe `/hu` al confirmar la ruta; `creada`,
`jira-hu-crear --aplicar`; `subida`, `/hu --subir`; `resultado`, el cierre de la HU (fase h). Las
`senales` son las del brief y las anota una persona en el cierre; ninguna se infiere sola.

**D-15. `/calibrar` es una skill de sólo lectura** sobre el registro: tabla de ruta propuesta contra
confirmada, tasa de subidas por ruta, y señales por ruta. Con al menos 20 eventos `resultado`
propone cambios a los cortes o a las preguntas de Jev como un diff a `jev-clasificar.mjs`, que
aprueba y mergea una persona (INV-4). Con menos de 20, sólo muestra la tabla.

- *Descartado:* registro en Jira (campos custom). Acopla la calibración al esquema de Jira y no
  guarda las confianzas de Jev.
- *Testing:* un escritor de eventos con validación de esquema (`v`, `evento`, campos por evento) en
  `node --test`; `/calibrar` sobre un `triage.jsonl` de fixture con resultado conocido.
- *Rollback:* borrar el archivo; nada más lo lee.

## 4.5 Plugin `starteria-desarrollo` (`ADR-013`)

**D-16. Paquete.** `plugins/starteria-desarrollo/` con:

```text
plugins/starteria-desarrollo/
  .claude-plugin/plugin.json      name: starteria-desarrollo
  skills/hu/ implementar/ verificar/ pr/ jira-hu/ spec/ calibrar/ init/
  agents/delivery-planner.md revisor-starteria.md
  tools/jira-comun.mjs jira-hu.mjs jira-hu-crear.mjs jev-clasificar.mjs env.example
```

Las tools se suben a `tools/` del paquete (hoy están dentro de `skills/*/tools/`) porque las usan
varias skills y los agentes. `.claude-plugin/marketplace.json` agrega la entrada
`{"name":"starteria-desarrollo","source":"./plugins/starteria-desarrollo"}` junto a la de
`starteria-harness`. `.claude/skills/graft/` no se muda.

**D-17. Invocación de tools.** En skills, `${CLAUDE_PLUGIN_ROOT}/tools/<x>.mjs` (confirmado por la
doc). **SIN RESOLVER para agentes:** la doc no dice si la variable se expande en `agents/*.md`. La HU
del plugin lo prueba primero (un agente que imprime la ruta); si no se expande, el agente recibe la
ruta de la tool en el prompt de la skill que lo despacha.

**D-18. Orden de la mudanza, en un solo PR:** copiar al paquete → actualizar las 22 referencias de
§8.4 → borrar `.claude/skills/{hu,implementar,verificar,pr,jira-hu}` y los dos agentes → ajustar
`.gitignore:16-17`. Un estado intermedio con dos copias no se mergea (`ADR-013` §2.1, propuesta
aprobada). En este repo el plugin se habilita con `.claude/settings.json` commiteado
(`extraKnownMarketplaces` apuntando a `./` y el plugin habilitado). **SUPUESTO:** el nombre exacto de
la clave para habilitar un plugin en settings; la doc no lo confirmó y la HU lo verifica antes de
escribirlo.

**D-19. Nombres.** Las skills quedan como `/starteria-desarrollo:hu`, etc. `AGENTS.md` §3 se reescribe
con esos nombres. No se agregan alias.

**D-20. `.env`.** `jira-comun.mjs` exporta `buscarEnv()`, la única función de búsqueda, y
`jev-clasificar.mjs` la importa (hoy duplica la lógica). Orden: `JIRA_ENV_FILE` → cwd y 6 ancestros →
`dirname(git rev-parse --path-format=absolute --git-common-dir)`. Se quita "junto al script".

**D-21. `init`.** Skill `init` del plugin, con `--dry-run`. Marcadores:

```text
<!-- starteria-desarrollo:init v=<versión> inicio -->
<!-- starteria-desarrollo:init fin -->
```

Algoritmo: leer el archivo (o vacío si no existe); contar inicios y fines; si no son 0/0 ni 1/1 en
ese orden, abortar sin escribir; si 0/0, agregar el bloque al final con una línea en blanco antes;
si 1/1, reemplazar sólo el interior; si el interior ya es idéntico, no escribir. No toca settings.

**D-22. Gate.** `scripts/verify.sh` agrega un bloque 7 "plugin de desarrollo": `claude plugin
validate plugins/starteria-desarrollo`, que no quede ninguna skill del ciclo en `.claude/skills/`, y
`ESPERADAS_DESARROLLO=8`. El bloque de `starteria-harness` no cambia.

- *Testing:* el `init` tiene el mejor seam de la épica: función pura `(texto, bloque) → texto | error`,
  con `node --test` sobre los cinco casos de `ADR-013` §5 (archivo con contenido propio, dos corridas,
  inexistente, marcadores rotos, settings presente) más "interior idéntico no escribe". `buscarEnv`
  con un repo temporal y un worktree real (`git worktree add` en `os.tmpdir()`). La mudanza se prueba
  con `verify.sh` bloque 7 y abriendo `claude --plugin-dir plugins/starteria-desarrollo` desde un
  worktree: el inventario tiene que mostrar las 8 skills.
- *Rollback:* la mudanza es un PR; revertirlo devuelve `.claude/`. Los repos que ya corrieron el
  `init` conservan un bloque inerte entre marcadores que se borra a mano.

# 5. Contratos entre frentes

No hay contratos de la plataforma. Los dos contratos internos del ciclo son el plan JSON (agrega
`ruta` y `epica.crear`, D-4) y el registro `triage.jsonl` (D-13), los dos versionados con `v`.

# 6. SUPUESTO / SIN RESOLVER

| # | Tipo | Qué | Quién lo cierra |
|---|---|---|---|
| 1 | SIN RESOLVER | `${CLAUDE_PLUGIN_ROOT}` en el cuerpo de un agente | HU Plugin, primer paso |
| 2 | SUPUESTO | clave de settings para habilitar un plugin en el proyecto | HU Plugin, antes de escribir `settings.json` |
| 3 | SUPUESTO | el umbral de 20 resultados para que `/calibrar` proponga | primera corrida de `/calibrar`; lo aprueba una persona |
| 4 | SUPUESTO | que el issue R0 pueda llevar los CA en su descripción sin una [Funcional] y el revisor los encuentre | HU Triage |

# 7. Corte de la épica

Seis HU. La épica se crea con el nombre que ya se aprobó ("Ciclo de HU por rutas con spec antes de
los tickets y plugin de desarrollo") cuando D-4 exista; hasta entonces se crea a mano y KAN-91 se
cuelga de ella.

```text
HU-P  Plugin            ← primero: mueve todo lo demás de lugar
 ├─ HU-T  Triage        bloqueada por HU-P
 ├─ HU-N  Negocio       bloqueada por HU-P
 ├─ HU-S  /spec         bloqueada por HU-T
 ├─ HU-C  Calibración   bloqueada por HU-T
 └─ HU-X  Piloto        bloqueada por HU-S y HU-N
```

HU-P va primero porque mueve los archivos que las demás editan; hacerla al final obliga a rebasear
todas.

**HU-P · Plugin starteria-desarrollo (R1).** Como desarrollador, quiero el ciclo como plugin con un
`init` que no pise mi `AGENTS.md`, para usarlo desde cualquier checkout o repo.
- CA-1 (D-16, D-18) `.claude-plugin/marketplace.json` lista `starteria-desarrollo` y no queda ninguna
  skill ni agente del ciclo en `.claude/`.
- CA-2 (D-17) Una sesión abierta con `--plugin-dir` desde un worktree muestra las 8 skills y los 2
  agentes, y `/starteria-desarrollo:jira-hu KAN-91` responde.
- CA-3 (D-20) Desde un worktree hermano, sin `JIRA_ENV_FILE`, `jira-hu.mjs` y `jev-clasificar.mjs`
  encuentran el `.env`; test con worktree real.
- CA-4 (D-21) Los seis casos del `init` pasan en `node --test`.
- CA-5 (D-22) `verify.sh` pasa con el bloque 7 y sigue diciendo `Skills (10)` para el producto.

**HU-T · Triage por rutas (R1).** Como quien trae un pedido, quiero que se clasifique en R0, R1, R2 o
Q, para pagar sólo el ciclo que necesita.
- CA-1 (D-1, D-2) Con respuestas fijas de Jev, la función pura devuelve la ruta de la tabla D-1 y
  nunca R0.
- CA-2 (D-1, D-3) `/hu` muestra la ruta propuesta y espera confirmación antes del grill.
- CA-3 (D-4) `jira-hu-crear` en dry-run acepta un plan R0 sin subtareas y uno con `epica.crear`.
- CA-4 (D-3) Un R0 de prueba (un texto en `front/`) recorre issue → `/implementar` → `/verificar` →
  `/pr` sin subtareas.
- CA-5 (D-5) `/hu --subir` comenta en Jira y escribe el evento.
- CA-6 `AGENTS.md` §3 describe las cuatro rutas.

**HU-N · Capa de negocio (R1).** Como persona de producto o lead, quiero un resumen ejecutivo en cada
PR y un "Por qué importa" ligado al scorecard en cada ticket, para entender el cambio sin leer código.
- CA-1 (D-10) El scorecard está en `docs/governance/scorecard/` con ids `SC-01` a `SC-18`.
- CA-2 (D-11) El planner genera "Por qué importa" en HU y subtareas y la línea `Scorecard:`.
- CA-3 (D-11) `/pr` y la plantilla abren con "Resumen ejecutivo".
- CA-4 (D-12) El revisor marca `[menor]` un PR sin resumen ejecutivo o con un `SC-nn` inexistente.

**HU-S · /spec y corte desde la spec (R1).** Como quien desarrolla un pedido grande, quiero una spec
aprobada antes de los tickets, para que las [Técnica] citen decisiones.
- CA-1 (D-6, D-7) `/spec` produce la plantilla y su autorevisión falla con un CA sin `D-n`.
- CA-2 (D-8) `/implementar` para con "R2 sin spec aprobada" si la spec no está en main.
- CA-3 (D-9) El planner corta HU desde el §7 de una spec y cada [Técnica] cita sus `D-n`.
- CA-4 (D-9) Existe la HU final "revisión de la épica" y el revisor tiene modo épica.

**HU-C · Calibración (R1).** Como quien mantiene el triage, quiero cada clasificación registrada con
su resultado y un `/calibrar` que proponga ajustes, para afinar a Jev con datos.
- CA-1 (D-13) El escritor de eventos valida el esquema `v:1` en `node --test`.
- CA-2 (D-14) `/hu`, `jira-hu-crear --aplicar` y `/hu --subir` escriben sus eventos.
- CA-3 (D-15) `/calibrar` sobre el fixture muestra la tabla y no propone con menos de 20 resultados.

**HU-X · Piloto (R2).** Como equipo, quiero correr el ciclo nuevo de punta a punta en la épica de
observabilidad de ai-service, para validarlo con un pedido grande real.
- CA-1 El pedido entra por triage y sale R2 confirmado.
- CA-2 Su spec se escribe con `/spec` y se mergea antes de cualquier HU de código.
- CA-3 Su épica cierra con la revisión de la épica, y el registro tiene su evento `resultado`.

# 8. Autorevisión

1. Cada CA del §7 cita al menos un `D-n`, salvo HU-T CA-6 (cita `ADR-012` §5) y los de HU-X, que
   validan el ciclo completo y no una decisión.
2. Cada `D-n` con código tiene testing con seam y rollback (D-1 a D-22).
3. Rutas citadas: verificadas en el PR (ver evidencia).
4. Referencias que rompe la mudanza (D-18), de la verificación del estado actual: `AGENTS.md:89,91,
   105,107,122,129`; `TESTING.md:4`; `.github/PULL_REQUEST_TEMPLATE.md:2`;
   `.claude/agents/delivery-planner.md:34,35,37,140`; `.claude/agents/revisor-starteria.md:18,28`;
   `.claude/skills/hu/SKILL.md:34`; `.claude/skills/verificar/SKILL.md:73`;
   `.claude/skills/jira-hu/SKILL.md:18`; `.claude/skills/implementar/SKILL.md:20,23`;
   `.claude/skills/pr/SKILL.md:24`; `.gitignore:16-17`. Los ADR y reportes históricos que las citan
   no se reescriben.
5. Lo no decidido está en §6.
