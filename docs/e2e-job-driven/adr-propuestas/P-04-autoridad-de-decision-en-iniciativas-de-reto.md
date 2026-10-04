# P-04 — Autoridad de decisión en iniciativas de Reto

**Estado:** Propuesto · 2026-10-04 · registra lo implementado en la ola 7 · requiere ratificación

## Contexto

La decisión organizacional (`decideDecisionRequest`) exige un Portfolio Lead asignado en
`InitiativeGovernance`. **Ningún flujo de producto creaba esa fila**: sólo los tests de integración
de adaptive-core. Toda iniciativa de Reto que llegaba a Step 4 y se presentaba al portafolio fallaba
con `DECISION_AUTHORITY_REQUIRED`. Lo detectó la suite E2E Job-Driven (§23, ola 4).

## Decisión implementada (ola 7)

1. Al ligar una iniciativa a un Reto, por cualquier camino (`challengeLink`, `challengeId` legado o
   meta del portfolio), se crea `InitiativeGovernance` en `portfolio_governed`, con el **owner del
   Reto** como Portfolio Lead o, si no hay, el **owner del Frente**. Es idempotente: no pisa una
   asignación explícita.
2. Al crear un Frente o un Reto sin `ownerId`, su owner es **quien lo crea**.
3. `PUT /portfolio/initiatives/:projectId/governance` (con `portfolio:write`) permite asignar o
   cambiar el Portfolio Lead; `GET` lo consulta.
4. Las iniciativas independientes no cambian: siguen `owner_governed`.

Código: `backend/modules/adaptive-core/initiative-governance.ts`.

## A ratificar

- ¿El creador del Frente o Reto es el lead correcto por defecto, o debería ser el sponsor
  (`sponsorId`) o el `challengeOwner` (hoy texto libre, no un usuario)?
- Iniciativas de Reto creadas **antes** de este cambio no tienen governance: ¿backfill con la misma
  regla, o asignación manual?
- ¿Hace falta una UI para reasignar, o alcanza con la API por ahora?
