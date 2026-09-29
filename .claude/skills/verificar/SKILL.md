---
name: verificar
description: >
  Corre la verificación de un cambio de Starteria según los frentes que toca el diff (front, back,
  ai), arma la evidencia que pide el PR, y despacha al agente revisor-starteria hasta que apruebe o
  se agoten las 3 rondas. Reporta lo que no se pudo correr y por qué.
  Use when: terminaste de implementar una subtarea y vas a pedir review o abrir el PR; o querés
  saber qué correr para un diff.
  Do not use for: escribir el código (/implementar) ni el cuerpo del PR (/pr).
argument-hint: "[KAN-nnn] [rama base, por defecto origin/main]"
---

# Verificar un cambio

Son las fases **f** y **g** del ciclo de `AGENTS.md` §3. Los comandos salen de
[`TESTING.md`](../../../TESTING.md); si no coinciden con el repo, TESTING.md está desactualizado y
se corrige en este mismo PR.

## 1. Qué tocó el diff

```bash
git fetch origin
git diff --name-only origin/main...HEAD
```

Mapeá cada ruta a una fila de la matriz de `TESTING.md` §5 y armá la lista de comandos. Un diff
que toca `backend/modules/ai/**` o `ai-service/schemas/**` cuenta como back **y** ai.

## 2. Correr

En este orden, que corta rápido:

1. typecheck y lint de los frentes tocados;
2. tests unitarios (`test:front`, `test:backend`, `pytest -m unit`);
3. integración, si toca persistencia (con Postgres levantado);
4. build;
5. E2E dirigido y eval determinístico, si la matriz los pide.

Cada comando se corre de verdad y se guarda su resultado (último tramo de la salida y el código de
salida). Si algo no se puede correr (sin Docker, sin clave, timeout), va a la tabla con el motivo;
no se reemplaza por "debería pasar".

Si algo falla: arreglalo si es del cambio (volvé a `/implementar` §5) y volvé a correr. Si es uno de
los 20 fallos E2E conocidos (`TESTING.md` §6), se anota como tal. Si es un test que protege V1 o
que no sabés qué protege, clasificalo (`TESTING.md` §7) antes de tocarlo.

## 3. Evidencia

Dejá este bloque en la conversación. Es lo que `/pr` copia a `## Evidencia` y lo que lee el revisor:

```text
VERIFICACION  KAN-nnn  <rama> @ <sha corto>
Frentes: front | back | ai
| Comando | Resultado | Nota |
|---|---|---|
| npm run typecheck:front | PASS | |
| npm run test:backend | PASS 412/412 | |
| npm run test:e2e -- e2e/x.spec.ts | FAIL 1 | fallo conocido, auditoría de migración |
| uv run pytest -m unit --cov | NO CORRIDO | sin uv en el entorno |
CA cubiertos por test: CA-1 (ruta::test), CA-2 (ruta::test)
CA sin test: CA-3 (motivo)
```

## 4. Review

Despachá al agente `revisor-starteria` (`.claude/agents/revisor-starteria.md`) con: la clave
`KAN-nnn`, la rama base, el bloque de evidencia y el `V2_CHANGE_GUARDRAIL_CHECK` de `/implementar`.

- `approved` → seguí con `/pr`.
- `changes_required` → corregí los hallazgos, volvé a correr §2 y despachá de nuevo (ronda +1).
- `uncertain` → la duda va a la persona, no se reintenta.

**Máximo 3 rondas.** Escalás a la persona, con los hallazgos pendientes, si: la ronda 3 no aprueba,
una ronda no cambió el diff (`git rev-parse HEAD` igual que en la anterior), o el revisor repite el
mismo hallazgo dos veces.

## 5. Cierre de la sesión

Terminás en uno de los estados de `AGENTS.md` §4: aprobado y listo para `/pr`, o bloqueado con el
motivo y los hallazgos. Nunca "casi listo".
