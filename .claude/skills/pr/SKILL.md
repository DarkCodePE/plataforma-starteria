---
name: pr
description: >
  Escribe el cuerpo de un PR de Starteria que se revisa rápido: la HU de Jira que cierra, sus
  criterios de aceptación tildados contra el diff, la forma del cambio en un diagrama o diff chico,
  evidencia antes/después, y el peligro de mergear (puerta de una o dos vías, radio de impacto).
  Use when: vas a abrir un PR o a reescribir el cuerpo de uno. Es la fase h del ciclo de
  AGENTS.md, después de /implementar y de que /verificar deje la evidencia y el revisor apruebe.
  Do not use for: revisar el código de otro PR, ni crear la HU (eso es /hu).
argument-hint: "[KAN-nnn] [rama base, por defecto main]"
allowed-tools: Read Grep Glob
---

# El cuerpo del PR

Un PR en Starteria cierra **una HU de Jira** (o una subtarea [Técnica] de ella), no un issue de
GitHub. Quien revisa tiene que poder contestar tres cosas sin abrir el diff: qué HU cierra y qué
criterios cumple, qué forma tiene el cambio, y cuánto cuesta equivocarse.

## Antes de escribir

1. **La HU.** Sacá la clave de lo que te pasaron, o del nombre de la rama
   (`feat/KAN-12-...`). Traela con la skill `jira-hu`:
   `node .claude/skills/jira-hu/tools/jira-hu.mjs KAN-12`. Los criterios de aceptación (`CA-n`)
   viven en la subtarea **[Funcional]**, y lo que se hizo, en la **[Técnica]** que este PR cierra.
   Si no hay HU, el PR se saltó el flujo: decilo en vez de inventar una.
2. **El diff.** `git diff <base>...HEAD --stat` y el diff de lo que importa. Cada `CA-n` se tilda
   sólo si el diff o la evidencia lo muestran. Un criterio que no se puede comprobar queda sin
   tildar y con el motivo.
3. **La evidencia.** Corré los tests que la subtarea [Técnica] declara en `## Verificación`. No
   inventes un comando que no existe en el repo.

## Plantilla

Usá esta plantilla, que también está en `.github/PULL_REQUEST_TEMPLATE.md`. Sin preámbulos, prosa
corta, y el vocabulario de producto de la HU, no el de la implementación.

```markdown
## HU

Cierra [KAN-nnn](https://<JIRA_HOSTNAME>/browse/KAN-nnn): <resumen de la HU>
Subtarea: KAN-nnn [Técnica] <resumen> · Slice V2: <nombre>

## Criterios de aceptación

- [x] CA-1 <texto> · <dónde se ve: test, captura, archivo>
- [ ] CA-2 <texto> · <por qué no: queda para KAN-nnn / no se pudo verificar porque...>

## Resumen

<diagrama, diff chico o árbol: la vista más chica que deja clara la idea>

## Evidencia

- **Antes:** <captura, salida, test que falla>
  **Después:** <captura, salida, test que pasa>

## Peligro de mergear

**Puerta:** <una vía | dos vías>

<opcional: por qué>

**Radio de impacto:** <una palabra>

<opcional: qué se puede romper>

## Chequeos

- [ ] Sin secretos, credenciales ni `.env` en el diff
- [ ] `V2_CHANGE_GUARDRAIL_CHECK` producido (si toca código productivo)
- [ ] Autoridad explícita para backend / Prisma / IA productiva / Core (si los toca)
```

## Secciones

### HU y criterios

La HU enlazada con su URL (`JIRA_HOSTNAME` del `.env`) y la subtarea [Técnica] que este PR cierra.
Los criterios, copiados de la [Funcional], **cada uno con dónde se comprueba**. Si el PR cierra
sólo parte de la HU, los criterios que no cierra van sin tildar y diciendo qué subtarea los cierra.

### Resumen

Elegí la vista más chica que deje clara la idea:

- **Lógica o algoritmo** → pseudocódigo:

  ```text
  on(guardar)
    si el contenido no cambió
      devolver lo guardado
    escribir contenido nuevo
  ```

- **Flujo en tiempo de ejecución** → árbol de llamadas:

  ```text
  submitForm
    createSession
      persistPrompt
    navigateToSession
  ```

- **Estructura de UI** → árbol de componentes, con el estado y los límites de módulo que importen.
- **Responsabilidad de archivos o un refactor amplio** → árbol de archivos poco profundo.
- **Interacción entre componentes o flujo de datos** (front → backend → ai-service) → Mermaid.
- **Qué cambia, cuando la forma de alrededor ya existe** → `diff`, con la forma que corresponda:

  ```diff
   submitForm
     createSession
       persistPrompt
  +    expandSkillMention
     navigateToSession
  ```

  Lo mismo sirve para un árbol de componentes, de archivos o un flujo de estado.
- **Bloque entero** cuando casi todo es nuevo, o cuando omitir contexto escondería el orden o de
  quién es cada cosa.

Poné cada visual al lado del texto corto que apoya. Dejá sólo las llamadas, archivos, props, estados
y límites que hacen falta para entender el cambio. Podés usar una vista, o varias; casi nunca todas.

### Evidencia

Algo concreto que muestre que funciona, antes y después.

- **Captura**: lo mejor, cuando el cambio es visual y el entorno permite sacarla (`front/`).
- **Ejecución**: tests o salida de consola. Mostrá el test exacto que antes fallaba y ahora pasa,
  en pseudocódigo si hace falta.
- Si no hay evidencia posible, se dice así, con el motivo. Una sección de evidencia vacía o de
  relleno es peor que admitir que falta.

### Peligro de mergear

**Puerta de una vía o de dos.** Por una de dos vías se vuelve (revert y listo); por una de una vía,
no. Un PR barato de revertir es de bajo riesgo. Borrar datos, migraciones de esquema, cambios de
contrato con consumidores, cambios de un contrato de `doc/`: una vía.

**Radio de impacto:** qué puede alcanzar si sale mal. Pensá en todo: layout que se corre, consumidores
que se rompen, móvil, el pipeline de ai-service, costo de modelos, el despliegue (`k8s/`, `cd.yml`).

## Abrir el PR

Mostrá el cuerpo a la persona antes de publicarlo. Abrir un PR es visible para el equipo: sólo con
su sí, `gh pr create --title "<tipo>(<área>): <resumen> [KAN-nnn]" --body-file <archivo>`. Si el PR
ya existe, `gh pr edit <n> --body-file <archivo>`.

---

Adaptada de `pr` (Matt Pocock, `mattpocock/skills`, MIT), que a su vez reproduce `show-me` de Dex
Horthy. Ver [CREDITS.md](CREDITS.md).
