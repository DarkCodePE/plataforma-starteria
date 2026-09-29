# CLAUDE.md

Las instrucciones para agentes viven en [`AGENTS.md`](AGENTS.md), que leen Claude Code, Codex y los
demás. Este archivo sólo agrega lo específico de Claude Code. Si algo acá contradice a `AGENTS.md`,
manda `AGENTS.md`.

## Ciclo de una tarea en Claude Code

| Fase | Comando / agente |
|---|---|
| pedido → HU en Jira | `/hu <el pedido>` → agente `delivery-planner` → skill `jira-hu` |
| implementar una subtarea [Técnica] | `/implementar KAN-nnn` |
| verificar y revisar | `/verificar` → agente `revisor-starteria` (sólo lectura, máx. 3 rondas) |
| abrir el PR | `/pr` (plantilla `.github/PULL_REQUEST_TEMPLATE.md`) |

Qué correr en cada frente: [`TESTING.md`](TESTING.md).

## Harness de producto (plugin)

Este repo también publica el plugin `starteria-harness` (`.claude-plugin/`, `skills/starteria*`,
`agents/`): comandos de chat sobre los contratos de `doc/` para gente de lead y de producto
(`/starteria` es el mapa). No es parte del ciclo de desarrollo de la plataforma.

| Si vas a | Leé |
|---|---|
| tocar `doc/` | `.claude/rules/contratos-doc.md`: son contratos con autoridad, no se editan en una tarea |
| tocar `skills/`, `agents/` o el plugin | `.claude/rules/harness-skills.md` |
| entender por qué el plugin está hecho así | `docs/adr/ADR-INDEX.md` |
| probar que el plugin carga | `scripts/verify.sh`; el comportamiento lo prueba una persona con `/starteria-probar` |

## Reglas propias de Claude Code

- Leé un archivo antes de editarlo; preferí editar a crear archivos nuevos.
- Subagentes: para buscar en muchos archivos, `Explore`; para revisar, `revisor-starteria`. Un
  subagente no mergea, no pushea y no toca Jira.
- No agregues un trailer `Co-Authored-By` a los commits salvo que `.claude/settings.json` tenga
  `attribution.commit`.
- Si una herramienta (`hyperresearch install`, `ruflo init`, `graft`) inyecta instrucciones acá o en
  `AGENTS.md`, no las dejes: este archivo es para el flujo de Starteria.
