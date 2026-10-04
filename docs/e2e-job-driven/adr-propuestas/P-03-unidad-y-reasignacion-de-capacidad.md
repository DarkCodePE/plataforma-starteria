# P-03 — Unidad de capacidad y reasignación en el portafolio

**Estado:** Propuesto · 2026-10-04 · requiere decisión de producto

## Contexto

El doc E2E v0.2 §4/§24 cierra el recorrido con "reasignamos capacidad", y el Core §17 define el Job
del Portfolio Lead: "¿estamos dedicando capacidad organizacional al trabajo correcto?". Pero el Core
**no define una unidad de capacidad** (horas, FTE, presupuesto) **ni una operación de reasignar**. Lo
único persistido es la capacidad interna declarada al activar un Reto (`activationInputs.internalCapacity`
en alta/media/baja) y la cantidad de iniciativas.

## Lo implementado (PR #130)

`GET /portfolio/capacity`: lectura en **iniciativas activas** por Frente y Reto, con señales para
decidir (prioridad alta sin iniciativas, concentración en prioridad baja, capacidad bloqueada, reto
cubierto con capacidad de sobra). Panel en Portfolio Home. No mueve nada.

## Preguntas a decidir

1. **Unidad:** ¿iniciativas activas (hoy), personas asignadas (`TeamMember`/`ChallengeTeamMember`),
   horas o presupuesto? Las dos primeras no necesitan datos nuevos.
2. **Reasignar:** ¿Starteria registra una *decisión de reasignación* (quién, de dónde a dónde, por
   qué), o sólo informa y la reasignación pasa fuera?
3. **Autoridad:** ¿quién puede reasignar? Probablemente el Portfolio Lead, alineado con P-04.

## Decisión propuesta

Mantener la lectura actual y sumar **personas asignadas** como segunda unidad (sin datos nuevos).
Registrar la reasignación como una **decisión de portafolio** trazable (análoga a `Decision`), sin
que Starteria mueva personas ni presupuesto. Horas o presupuesto, sólo si un cliente lo pide.
