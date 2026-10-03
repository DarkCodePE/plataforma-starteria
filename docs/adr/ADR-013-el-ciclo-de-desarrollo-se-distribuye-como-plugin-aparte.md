---
id: ADR-013
title: "El ciclo de desarrollo se distribuye como un segundo plugin, starteria-desarrollo, con un init por marcadores y el .env resuelto desde el checkout principal"
status: proposed
type: standard
date: 2026-10-03
deciders: [Orlando]
supersedes: null
superseded_by: null
aprobado_por: null
aprobado_en: null
review_trigger: "la primera vez que el init se corra en un repo que no sea este, o la primera vez que una sesión cargue una versión de /hu distinta de la de la rama que se estaba probando"
tags: [productor, plugin, distribucion, init, worktree, env, adr-009, adr-011]
---

# ADR-013: El ciclo de desarrollo se distribuye como un segundo plugin

Ámbito: slice `DEV_CYCLE_HU_TOOLING` (`STARTERIA_V2_MANIFEST.md` §2.3), del lado **productor**
(`ADR-009`). El plugin de producto `starteria-harness` no cambia.

## 1. Contexto y problema

El ciclo de desarrollo (`/hu`, `/implementar`, `/verificar`, `/pr`, `jira-hu`, y los agentes
`delivery-planner` y `revisor-starteria`) vive en `.claude/skills/` y `.claude/agents/`. Claude Code
los carga como skills **de proyecto**: aparecen sólo cuando se abre este repo o un worktree suyo.

Eso funcionó mientras el ciclo se usó en un solo lugar. Hoy falla en tres puntos verificados:

1. **El `.env` no se encuentra desde un worktree.** `/implementar` trabaja en
   `../starteria-KAN-nnn`, hermano del checkout principal. `jira-comun.mjs` (`cargarEnv`) y
   `jev-clasificar.mjs` buscan el `.env` en `JIRA_ENV_FILE`, junto al script y subiendo hasta seis
   carpetas desde el cwd. Desde el worktree, subir llega a `~/Desktop` y a `~`, nunca al checkout
   principal. Hoy se tapa exportando `JIRA_ENV_FILE` a mano.
2. **No hay forma de llevar el ciclo a otro repo.** `harness-starteria` y cualquier repo nuevo
   tendrían que copiar las carpetas, y una copia se desincroniza (es lo que mató a `ADR-006`).
3. **No se puede probar una versión de una skill sin pisar otra.** No hay un "instalado" contra el
   cual comparar la rama: la skill que carga es la del checkout que se abrió.

Ya hay un precedente de cómo se resuelve esto para el producto: `ADR-008` empaquetó
`starteria-harness` como plugin y `ADR-011` §2.4 lo volvió un paquete autocontenido en
`plugins/starteria-harness/`, con un catálogo neutral en `.agents/plugins/marketplace.json`.

Hay dos clases de decisión en este ADR, y se marcan para que quien lo apruebe sepa qué firma:

- **Del brief (P5, P12):** las tomó Orlando en la entrevista `/hu` del 2026-10-02 (HU KAN-91). El
  ADR las registra y no las reabre: plugin aparte en `plugins/starteria-desarrollo/` dentro del
  `marketplace.json` existente, sin mezclarse con `starteria-harness`; prueba de una rama con
  `--plugin-dir`; `init` idempotente que escribe un bloque con marcadores en `AGENTS.md` y
  `CLAUDE.md`; `.env` resuelto desde el checkout principal por git common dir.
- **Propuestas por este ADR:** las marca *(propuesta)* en el texto. Son detalles que el brief no
  decidió; **aprobar este ADR es aprobarlas**, y si quien firma no está de acuerdo, se sacan y las
  decide la Tech Spec (KAN-95).

## 2. Decisión

### 2.1 Un segundo plugin, separado del producto

**El ciclo se empaqueta como `starteria-desarrollo`, en `plugins/starteria-desarrollo/`.** Es el
segundo plugin del `.claude-plugin/marketplace.json` existente, al lado de `starteria-harness`, y
nunca se mezcla con él.

- El paquete trae sus `skills/`, sus `agents/`, sus tools (`jira-hu`, `jev-clasificar`) y su
  `.claude-plugin/plugin.json`.
- **Las skills y agentes del ciclo se mudan, no se copian** (del brief: "se lleva las skills y
  agentes del ciclo"). *(Propuesta)* La mudanza es completa o no se hace: dejar una versión en
  `.claude/` y otra en el plugin produce justo el fallo del punto 3, dos `/hu` cargados y ninguna
  certeza de cuál corre.
- *(Propuesta)* Las tools se llaman con rutas relativas a la raíz del plugin, no a
  `.claude/skills/`, porque un plugin instalado vive en la caché de Claude Code y no en el repo.
  **SUPUESTO:** que `${CLAUDE_PLUGIN_ROOT}` se expande dentro del cuerpo de un `SKILL.md` o de un
  agente, y no sólo en hooks y servidores MCP. Lo verifica la Tech Spec antes de mudar nada.
- Lo que no es del ciclo se queda donde está: `.claude/skills/graft/` no se muda.

**Por qué separado y no dentro de `starteria-harness`:** `ADR-009` traza la frontera entre el
producto, que usan lead y producto sin terminal, y el productor, que corre en una terminal con Node.
El ciclo es del productor. Meterlo en `starteria-harness` le daría a quien instala el producto
comandos que crean tickets en Jira y abren worktrees, y rompería la cuenta de `verify.sh`
(`Skills (10)`).

### 2.2 Probar una rama sin pisar lo instalado

**Una rama se prueba abriendo Claude con `claude --plugin-dir plugins/starteria-desarrollo`** desde
su worktree. Esa sesión carga la versión de la rama; la instalada desde el marketplace queda
intacta para el resto. *(Propuesta)* Es la forma documentada de probar una skill del ciclo antes
de mergear.

### 2.3 Un `init` idempotente que escribe sólo entre marcadores

Para usar el ciclo en otro repo, el plugin trae un `init` que escribe en el `AGENTS.md` y el
`CLAUDE.md` del repo destino **un bloque delimitado por marcadores**, como `ruflo init` (del
brief). *(Propuesta)* Los marcadores llevan el nombre del plugin y la versión, con esta forma
ilustrativa; el texto exacto lo fija la Tech Spec, porque una vez en uso cambiarlo es una puerta
de una vía (§4):

```text
<!-- starteria-desarrollo:init:start v=<versión del plugin> -->
... cómo correr el ciclo en este repo ...
<!-- starteria-desarrollo:init:end -->
```

Reglas. Las dos primeras y la de settings vienen del brief; la de marcadores rotos sale de "no
pisar"; las marcadas *(propuesta)* las agrega este ADR:

- **Fuera de los marcadores no se toca nada.** Ni una línea, ni un salto de línea.
- **Correrlo dos veces da el mismo archivo.** La segunda corrida reemplaza el contenido del bloque y
  nada más; si el bloque ya está en la versión actual, no escribe.
- *(Propuesta)* **Si el archivo no existe, lo crea** con el bloque solo.
- **Si los marcadores están rotos** (un `start` sin `end`, o dos `start`), **aborta sin escribir** y
  dice qué encontró. No adivina.
- **No modifica settings existentes** (del brief: el `init` no puede pisar ni duplicar settings).
  Si `.claude/settings.json` ya tiene algo, no lo toca. Si el repo destino quiere que el plugin
  cargue solo (`enabledPlugins`, `extraKnownMarketplaces`), el `init` lo propone como instrucción
  dentro del bloque y lo hace una persona. *(Propuesta)* Que el `init` no cree ni agregue claves de
  settings ni siquiera cuando faltan; si se quiere que las agregue, lo decide la Tech Spec.
- *(Propuesta)* **Tiene un modo de prueba** que muestra el diff sin escribir.

**En este repo el `init` no se corre.** El ciclo ya lo describe `AGENTS.md` §3, que es la
autoridad, y el bloque lo duplicaría con riesgo de que las dos versiones diverjan. Lo refuerza
`CLAUDE.md`: *"Si una herramienta (`hyperresearch install`, `ruflo init`, `graft`) inyecta
instrucciones acá o en `AGENTS.md`, no las dejes"*. El `init` es para los repos que no tienen el
ciclo escrito.

### 2.4 El `.env` se resuelve desde el checkout principal

Las tools del ciclo agregan un candidato a su búsqueda: **el `.env` de la raíz del checkout
principal**, calculado con `git rev-parse --git-common-dir`. En un worktree, ese comando apunta al
`.git` del checkout principal, y su carpeta padre es donde vive el `.env`.

El orden queda: `JIRA_ENV_FILE` si está, después el cwd y sus ancestros, después el checkout
principal. El candidato que hoy existe "junto al script" (`jira-comun.mjs`, `jev-clasificar.mjs`)
en un plugin instalado cae en la caché de Claude Code; *(propuesta)* se quita, y si la Tech Spec
encuentra un uso que lo justifique, lo mantiene detrás de los otros. Fuera de un repo git, el
candidato nuevo no existe y no falla nada. El aviso de permisos (`600`) y el diagnóstico de
orígenes mezclados de `jira-comun.mjs` se mantienen.

Qué queda para la Tech Spec del ciclo (KAN-95): la lista exacta de lo que se muda; todas las
referencias por ruta a `.claude/skills/...` que hay que actualizar (`AGENTS.md`, los agentes
`delivery-planner` y `revisor-starteria`, `implementar/SKILL.md`); cómo se extiende `verify.sh` para
contar el segundo plugin; si el paquete se publica también en el catálogo neutral de `ADR-011`;
verificar el SUPUESTO de `${CLAUDE_PLUGIN_ROOT}`; y el texto del bloque del `init`.

## 3. Alternativas consideradas

- **Seguir en `.claude/` y sólo arreglar el `.env`:** rechazada. Es el cambio más chico y resuelve
  el punto 1, pero no el 2 ni el 3: no hay forma de instalar el ciclo en otro repo.
- **Meter el ciclo en `starteria-harness`:** rechazada. Rompe la frontera de `ADR-009` y le entrega
  a quien instala el producto comandos que escriben en Jira.
- **Enlaces simbólicos a `~/.claude/skills`:** rechazada. Las skills quedan visibles en todos los
  proyectos, chocan con otras del mismo nombre, y la versión que carga depende de adónde apunte el
  enlace, que es el punto 3 otra vez.
- **Un repo propio para el plugin:** rechazada. Las skills del ciclo citan `AGENTS.md`,
  `TESTING.md` y el manifiesto de este repo; separadas de lo que gobiernan, se desincronizan.
- *(Propuesta)* **Un espejo generado desde `.claude/`, como `ADR-011` §2.4:** rechazada. Para el
  producto el espejo existe porque la raíz es el paquete; acá no hay esa restricción, y una fuente
  única es más simple que un generador más un chequeo.
- **Habilitar el plugin por settings del proyecto** (`.claude/settings.json` commiteado con
  `enabledPlugins` y `extraKnownMarketplaces`), en vez de un `init`: no es excluyente, pero no
  alcanza. Hace que el plugin cargue solo, que es lo que §4 lamenta perder, pero no escribe nada en
  `AGENTS.md` ni `CLAUDE.md`, que es lo que el brief pide del `init`. Queda como opción para la Tech
  Spec, para este repo y para los que corran el `init`.
- **Un `init` que reescribe el archivo entero desde una plantilla:** rechazada. Pisa lo que el repo
  destino ya tenía escrito, que es exactamente el modo de fallo que más cuesta deshacer.
- **Exigir `JIRA_ENV_FILE` siempre:** rechazada. Es lo que se hace hoy y se olvida; la ubicación del
  checkout principal se puede calcular, así que no hay que pedirla.

## 4. Consecuencias

**Positivas**
- El ciclo se instala en otro repo con un comando, y un mismo `/hu` corre igual en todos.
- Probar una rama deja de ser ambiguo: `--plugin-dir` carga esa versión y nada más.
- `/implementar` funciona desde su worktree sin exportar variables a mano.
- El producto no recibe comandos que no son para su usuario.

**Negativas y trade-offs aceptados**
- **En este repo, el ciclo deja de cargar solo.** Hay que instalar el plugin desde el marketplace
  local, o abrir con `--plugin-dir`. Es el mismo precio que pagó `ADR-008`.
- **Los nombres cambian.** Las skills de un plugin quedan con su prefijo
  (`starteria-desarrollo:hu`), y los documentos que dicen `/hu` tienen que seguir siendo ciertos.
  Además, `AGENTS.md`, los dos agentes y `implementar/SKILL.md` llaman las tools por ruta
  `.claude/skills/...`: la mudanza las rompe si no se actualizan en el mismo cambio.
- **Es una puerta de una vía hacia afuera.** Una vez que haya repos con el bloque del `init`,
  cambiar el formato de los marcadores obliga a migrarlos.
- **Dos plugins en un marketplace** son dos versiones que mantener y dos cuentas que verificar.
- **Las skills del ciclo asumen archivos de este repo** (`AGENTS.md` §3, `TESTING.md`, el
  manifiesto). En otro repo esos archivos pueden no existir; cada skill tiene que degradar diciendo
  qué falta, no romperse. Es el mismo riesgo que `ADR-008` dejó como gatillo.

## 5. Criterios de aceptación de la decisión

- [ ] `plugins/starteria-desarrollo/` existe con `.claude-plugin/plugin.json`, y
      `.claude-plugin/marketplace.json` lo lista como segundo plugin.
- [ ] No queda ninguna skill ni agente del ciclo duplicado en `.claude/`.
- [ ] `claude --plugin-dir plugins/starteria-desarrollo` carga la versión de la rama, y el
      inventario lo muestra.
- [ ] El `init` pasa estos casos sin tocar nada fuera de los marcadores: `AGENTS.md` y `CLAUDE.md`
      existentes con contenido propio; corrido dos veces seguidas; archivo inexistente; marcadores
      rotos (aborta); un `.claude/settings.json` existente (no se modifica).
- [ ] `jira-hu.mjs` y `jev-clasificar.mjs` encuentran el `.env` desde un worktree hermano sin
      `JIRA_ENV_FILE`.
- [ ] `scripts/verify.sh` sigue reportando `Skills (10)` para `starteria-harness`.

Ninguno se cumple con este ADR: dependen de la spec (KAN-95) y de las HU que corte.

## 6. Gatillos de revisión

- **El `init` se corre en otro repo por primera vez.** Si pisa algo, o si las skills no degradan sin
  los archivos de este repo, la frontera del paquete está mal puesta.
- **Una sesión carga una versión de una skill del ciclo distinta de la esperada.** Significa que la
  mudanza dejó un duplicado o que `--plugin-dir` no alcanza.
- **Alguien pide un comando del ciclo dentro de `starteria-harness`.** La frontera de `ADR-009` se
  corrió, y se decide de nuevo, no se agrega por las dudas.

## Historial

- 2026-10-03 · proposed · Redactado en KAN-94 a partir del brief de KAN-91 (entrevista `/hu` del
  2026-10-02, preguntas P5 y P12). El estado actual se verificó contra `jira-comun.mjs`,
  `jev-clasificar.mjs`, `scripts/verify.sh`, `.claude-plugin/marketplace.json` y
  `.agents/plugins/marketplace.json`.
- 2026-10-03 · proposed · Ronda 1 de `revisor-starteria`: changes_required, porque el ADR firmaba
  como del brief detalles que el brief no decidió. Se separaron en *(propuesta)* y SUPUESTO, la
  regla de settings bajó a "no modifica settings existentes", y se agregó la alternativa de
  habilitar el plugin por settings del proyecto.
