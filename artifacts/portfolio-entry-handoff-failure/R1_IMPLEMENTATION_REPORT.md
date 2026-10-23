# KAN-164 — Portfolio Entry Critical Handoff R1 Backend

Fecha de implementación local: 2026-10-22
Rama: `fix/portfolio-entry-critical-handoff-r1`
HEAD base: `6518cbf87c80df3b9bc66632381deebac27a812b`
Worktree: `starteria-critical-handoff-r1`

## 1. Baseline del repositorio

- Worktree y rama verificados antes de editar; el worktree estaba limpio.
- Se confirmó que no se trabajó en `starteria-KAN-153-recovery-ux`.
- KAN-164 y el comentario `APROBADO R1 BACKEND — 2026-10-22` se leyeron desde Jira.
- Se leyeron `AGENTS.md`, `ROOT_CAUSE_AUDIT.md`, la skill `implementar`, `STARTERIA_AUTHORITY`, Core v0.2, Portfolio Entry Logic Contract, Critical Reasoning Contract, guardrails, playbook y ADRs aplicables.
- Baseline focal después de instalar dependencias y generar Prisma Client: 4 archivos, 91/91 tests PASS.
- El primer intento de baseline no ejecutó tests por ausencia de `node_modules`; el segundo cargó 53 tests y detectó Prisma Client no generado. `npm ci` y `npx prisma generate` resolvieron ambas precondiciones sin cambiar archivos versionados.

## 2. Causa raíz confirmada

La reproducción local de la auditoría confirmó `PROVIDER_FAILURE` por autenticación del proveedor y `SESSION_STATE_FAILURE` por el orden de persistencia. La implementación anterior:

1. generaba el handoff legacy;
2. persistía legacy y avanzaba la revisión de sesión;
3. recién después intentaba sintetizar y persistir Critical Handoff;
4. absorbía el fallo de síntesis en la ruta compartida.

Esto dejaba una sesión `HANDOFF_READY` con legacy pero sin Critical Handoff. Un retry con la revisión original devolvía 409 y uno con la revisión actual volvía a materializar legacy. La causa específica del incidente histórico sigue sin poder atribuirse porque no existe metadata de la síntesis crítica de aquel evento; R1 no inventa esa atribución.

## 3. Arquitectura anterior y corregida

### Antes

`request -> legacy materialization -> legacy/session commit -> external KAN-114 synthesis -> Critical insert`

La publicación no era atómica y la recuperación reutilizaba la ruta que volvía a crear legacy.

### R1

`request -> persisted context snapshot -> external KAN-114 synthesis -> deterministic legacy projection -> short SERIALIZABLE/CAS publication of session + legacy + Critical`

- Ninguna transacción permanece abierta durante la llamada externa.
- La publicación nueva valida revisión de sesión, `contextRevision` y último turno analizado dentro de la misma transacción.
- Una sesión parcial histórica usa una ruta conclusion-only: sintetiza Critical y lo inserta con precondiciones de revisión/contexto/turno, sin reanalizar, sin repetir aclaraciones y sin tocar legacy.
- Dos publicaciones concurrentes convergen en el artefacto ganador; la perdedora relee y devuelve ese mismo artefacto cuando sigue siendo current.
- La creación conclusion-only con `expectedSessionRevision` rechaza una segunda versión del mismo contexto/turno; la versiónación normal sin esa precondición se conserva.
- La reserva de una Idempotency-Key tiene identidad candidata, lo que distingue una creación propia de la fila ganadora en una carrera de `create`.
- Los fallos registran solo `sessionId`, etapa y clase sanitizada. La metadata persistida para Critical Handoff sustituye tanto el detalle técnico como los mensajes de validación del proveedor por códigos internos sanitizados.

## 4. Archivos modificados

- `backend/modules/portfolio-entry/application/portfolio-entry-experimental-session.service.ts`
- `backend/modules/portfolio-entry/application/portfolio-entry-idempotency.repository.ts`
- `backend/modules/portfolio-entry/infrastructure/in-memory-portfolio-entry-idempotency.repository.ts`
- `backend/modules/portfolio-entry/infrastructure/prisma-portfolio-entry-idempotency.repository.ts`
- `backend/modules/portfolio-entry/portfolio-entry.router.ts`
- `backend/modules/portfolio-entry-sessions/application/portfolio-entry-session.repository.ts`
- `backend/modules/portfolio-entry-sessions/application/portfolio-entry-session.service.ts`
- `backend/modules/portfolio-entry-sessions/infrastructure/in-memory-portfolio-entry-session.repository.ts`
- `backend/modules/portfolio-entry-sessions/infrastructure/prisma-portfolio-entry-session.repository.ts`
- `backend/modules/portfolio-entry/__tests__/live-understanding-session.integration.test.ts`
- `backend/modules/portfolio-entry-sessions/__tests__/prisma-portfolio-entry-session.repository.integration.test.ts`
- `artifacts/portfolio-entry-handoff-failure/R1_IMPLEMENTATION_REPORT.md`

No se modificaron frontend, schema Prisma, migraciones, contratos canónicos, Core, Steps, Question Planner, Skills `entry-01` a `entry-04`, Adaptive Core ni PL-04/05/06.

## 5. Evidencia de recuperación e invariantes

- Fallo de proveedor, timeout, salida vacía, schema inválido, proyección o publicación: no se publica legacy ni Critical y la revisión/checkpoint conversacional permanece disponible.
- Retry tras fallo en la ruta current: vuelve a ejecutar únicamente la conclusión y termina con legacy v1 + Critical v1.
- Sesión parcial histórica: acepta revisión original o actual; ambas devuelven el mismo Critical v1 y conservan legacy v1.
- Misma Idempotency-Key simultánea: una ejecución y respuesta 409 `IN_PROGRESS` para la entrega concurrente; replay posterior obtiene el snapshot completado.
- Idempotency-Keys distintas simultáneas: ambas respuestas convergen al mismo artefacto; no hay segunda versión legacy ni Critical.
- Dos retries conclusion-only simultáneos: convergen a Critical v1.
- Cambio de contexto durante síntesis: CAS rechaza la publicación; no aparece ningún artefacto.
- Respuesta HTTP perdida: el recovery hint y la lectura del estado publicado reconstruyen la respuesta sin una nueva síntesis ni materialización, tanto para publicación atómica fresca como para conclusion-only sin avance de revisión.
- No hay acceso a repositorios de Initiative, Assignment o Step en la ruta corregida. El E2E 114D y los tests legacy verifican la ausencia de canonicalización automática.
- `KEEP_COMPAT`: la ruta legacy conserva su contrato y su disponibilidad incluso cuando falla la síntesis sidecar.

## 6. Resultados de pruebas

| Comando / nivel | Resultado | Nota |
|---|---:|---|
| Baseline focal | PASS 91/91 | 4 suites antes del cambio |
| `npm run typecheck:backend` | PASS | Ejecución final sobre el diff completo |
| `npm run lint` | PASS | Ejecución final; incluida la regla de única salida a ai-service |
| `npm run test:backend` | PASS | Suite backend completa final; 124 tests de integración condicionados quedaron skipped por sus flags normales |
| Focal R1 post-cambio | PASS 52/52 | Fallos, retries, carreras, drift, sanitización y pérdida de respuesta |
| `npm run build:backend` | PASS | Compilación backend |
| PostgreSQL desechable | PASS 29/29 | Migraciones limpias + transacciones Prisma + dos carreras de publicación |
| Full-stack Live Understanding | PASS 1/1 | Browser + API + Prisma, puertos aislados |
| Full-stack `CURRENT_114D` final | PASS 6/6 | Critical Handoff sin fallback semántico legacy; repetido sobre el diff final |
| Full-stack `LEGACY_COMPAT` final | PASS 7/7 | Repetición aislada sobre el diff final; compatibilidad y ausencia de writes canónicos no autorizados |

Incidencias de ejecución: un primer E2E falló porque el puerto 5176 estaba ocupado por un Vite perteneciente a `starteria-KAN-153-recovery-ux`; no se modificó ni detuvo ese proceso y el recorrido pasó con puertos aislados. En la repetición final paralela, un caso `LEGACY_COMPAT` de descarga no encontró las acciones de Brief tras un fallo transitorio de continuidad frontend; el conjunto completo se repitió inmediatamente de forma aislada y pasó 7/7. No se cambió frontend ni se corrigió ese comportamiento ajeno a R1.

La revisión independiente tuvo dos rondas. La primera marcó cinco huecos bloqueantes de clasificación/sanitización y evidencia; todos se corrigieron. La segunda verificó esos cambios y no encontró nuevos defectos de código o alcance; su veredicto final se incorporó después de la matriz `LEGACY_COMPAT`.

No se llamó a un modelo real. Los fallos de proveedor, auth y timeout se inyectaron de forma determinística; el E2E usa el adaptador determinístico KAN-114 autorizado por `TESTING.md`.

## 7. Riesgos residuales

1. No se validó contra un proveedor live ni se rotaron credenciales; queda fuera de R1 y no es necesario para demostrar las invariantes sistémicas.
2. El código público reutiliza el error sanitizado `PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SYNTHESIS_UNAVAILABLE` también para un fallo de publicación. Evita filtrar detalle y no cambia contratos, pero R2/R3 podría introducir un código interno más específico sin exponerlo al cliente.
3. El frontend R1 sigue conservando su DTO anterior tras 503; R1 deja la sesión backend recuperable, pero la presentación correcta del retry pertenece a R2.
4. La causa exacta del incidente histórico sigue siendo desconocida por falta de metadata crítica histórica.

## 8. Conflictos contractuales

No se detectó conflicto material con Core, contratos o ADRs aprobados. La corrección mantiene:

- KAN-114 como única autoridad de razonamiento de Critical Handoff;
- autoridad humana y estado provisional hasta confirmación explícita;
- separación entre Critical Handoff y legacy Handoff;
- legacy como `KEEP_COMPAT`, nunca como fallback visible de 114D;
- cero creación automática de Initiative, Assignment o Step;
- schemas públicos y de persistencia sin cambios.

## 9. Pendientes para R2 frontend

- Invalidar/refrescar el DTO de sesión después de un 503 de Critical Handoff.
- Mostrar un estado recuperable y una acción de retry de conclusión, sin reiniciar conversación ni preguntas.
- Enviar la revisión vigente que entregue el backend y tolerar la recuperación determinista de una respuesta perdida.
- No mostrar legacy como fallback ni ampliar autoridad de IA.
- Añadir evidencia de navegador específica del fallo/retry una vez autorizado R2.

R2 no se inició.

## 10. V2_CHANGE_CLOSURE_CHECK

```text
V2_CHANGE_CLOSURE_CHECK
Change: KAN-164 — Portfolio Entry 114D Critical Handoff R1 Backend
Slice: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_114D
Authority: APROBADO R1 BACKEND 2026-10-22 + Core v0.2 + contratos Portfolio Entry/Critical Reasoning + ADR-002/ADR-007
Semantic owner: Critical Handoff = V2; legacy sidecar = LEGACY_COMPAT
Canonical schemas changed: NO
Core / Steps / human confirmation changed: NO
Frontend / R2 changed: NO
External model call inside DB transaction: NO
Atomic publication protected by revision + contextRevision + sourceTurn CAS: YES
Conclusion-only recovery old/current revision: YES
Same/new key, concurrent requests and lost-response recovery: YES
Sanitized failure classification: YES
KEEP_COMPAT verified: YES
Initiative / Assignment / Step creation: NONE
Manifest/CURRENT_STATE update: NOT REQUIRED; el slice ya permanece IMPLEMENTED_VERIFIED y no cambia de estado
Contract conflicts: NONE
Independent review: APPROVED en ronda 2; los cinco hallazgos de ronda 1 quedaron cerrados
Proceed to R2: GO only after human acceptance of this R1
```

## 11. Recomendación

`GO` técnico para aceptar R1. No iniciar R2 antes de la aceptación humana de R1.
