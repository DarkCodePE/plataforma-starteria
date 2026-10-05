# KAN-109 — Portfolio Entry Auth Recovery Stabilization v0.1

**Estado:** IMPLEMENTED / LOCAL REGRESSION VERIFIED; pendiente de review y cierre humano.
**Baseline gobernado:** `8f7932211a5f0f1465bbb968d3f23ed2b33b960e` (merge PR #129).
**Slice:** `KAN74_PORTFOLIO_ENTRY_TO_FIRST_VALUE`; sin cambio de autoridad ni de estado del slice.

## Guardrail y autoridad

KAN-109 autoriza estabilizar la recuperación autenticada de la sesión reclamada y exige conservar
la autorización server-side, la identidad exacta y el acceso scoped de KAN-100. La implementación
queda subordinada al Portfolio Entry Logic Contract aprobado y a KAN-74. No introduce permisos,
no usa `sessionStorage` como autorización y no cambia lifecycle, D1/D2, Download, Delete ni la
continuación.

## Rebaseline anterior al cambio

Las reproducciones se hicieron con `HEAD` exactamente en la base indicada; el árbol estaba limpio.

- KAN-101 DELETE x10: 5/10 fallaron esperando `portfolio-entry-confirmed-brief-actions`. El
  contexto de fallo mostraba `/public/start` y el aviso «La sesión ya no es válida». Las otras cinco
  pasaron.
- Portfolio-first continuation/reload (`portfolio-first can persist explicit no-existing-work state through reload`) x10: 10/10 pasaron.
- El escenario integrado `portfolio-first reaches adaptive handoff without Project/Steps language`
  x10 tuvo 9/10; la única falla fue una espera agotada por el botón de generar primera lectura
  mientras ya se mostraba Portfolio Bootstrap. La URL seguía en el contexto Portfolio; no terminó
  en `/auth`.

PR #129 añadió presentación de ruta sugerida en `PortfolioEntryExperience`, sin tocar auth ni
recovery; por tanto, no eliminó indirectamente la pérdida intermitente del panel. En estas
reproducciones no se observó un destino terminal `/auth`. En una repetición instrumentada del
baseline se capturó directamente, para la misma sesión, un GET con `401` y sin `Authorization`,
seguido por el retry con `Bearer` y `200`. El mismo harness vio la pérdida del panel en 5/10
reproducciones previas. El orden de código confirmaba que la recuperación podía enviar ese GET
mientras `initAuth()` todavía hidrataba el token en memoria.

## Diagnóstico y cambio

`PortfolioEntryExperience` iniciaba `getClaimedPortfolioEntrySession()` en su efecto de montaje sin
esperar `AppContext.authLoading`. `initAuth()` y la recuperación podían competir: el interceptor de
API solo adjunta `Authorization: Bearer …` una vez que el refresh inicial instala el token.

La recuperación ahora espera a que `authLoading` sea `false` y vuelve a evaluar el efecto al terminar
la hidratación. La prueba de componente demuestra que no hay GET durante la hidratación y que la
sesión reclamada se recupera cuando auth queda ready.

## Verificación

- Test-first: el nuevo test `waits for auth hydration before recovering a claimed session` falló
  antes del cambio porque llamó al GET con `authLoading=true`; pasó tras el cambio.
- `PortfolioEntryExperience.test.tsx`: 32/32 PASS.
- KAN-101 DELETE x10: 10/10 PASS después del cambio.
- El E2E KAN-101 ahora registra status y presencia de `Authorization` en lecturas de sesión; el test
  falla ante el `401` sin `Bearer` observado en baseline. El token se redacta en mensajes de error.
- Portfolio-first continuation/reload x10: 10/10 PASS después del cambio.
- `portfolio-entry-conversion.spec.ts`: cinco invocaciones completas, cada una en wrapper aislado;
  las cinco pasaron y `test-results/.last-run.json` terminó en `passed`, sin fallos ni 429.
- Durante la iteración hubo una invocación exploratoria del spec completo con cuatro fallos,
  incluyendo una pérdida del panel; no se cuenta dentro del bloque final AC6. Después, el KAN-101
  instrumentado pasó x10 y cinco wrappers completos consecutivos pasaron.
- `npm run typecheck:front`: PASS.
- `npm run lint`: PASS.
- `npm run test:front`: PASS.
- `npm run build`: PASS; el build conserva sus advertencias existentes sobre imports dinámicos y
  tamaño de chunks.
- `git diff --check`: PASS.
- BrowserSkill (`bsk doctor`): NO CORRIDO; `bsk` no está instalado. El recorrido sí se ejecutó en
  Chromium vía Playwright; no hubo sesión manual de Chrome/BrowserSkill.

## Cierre

Resultado: `AUTH_RECOVERY_RACE_STABILIZED` por la secuenciación auth-ready probada y las
repeticiones focalizadas. La autorización continúa dependiendo del token y de las comprobaciones
server-side; la identidad reclamada solo identifica qué leer. El slice conserva `ACTIVE_V2_BASELINE`
e `IMPLEMENTED_VERIFIED`; esta nota amplía su evidencia local, no certifica producción. Review,
PR, merge y transición Jira siguen pendientes.
