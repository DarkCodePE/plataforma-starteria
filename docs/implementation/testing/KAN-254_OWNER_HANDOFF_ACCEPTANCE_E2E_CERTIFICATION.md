# KAN-254 — Owner Handoff & Acceptance E2E

Fecha de certificación: 2026-11-10  
Baseline: `main` posterior a PR #304 (`f5baae73fe657aaea2d866bf41ce6cf0c0233f73`)  
HU: KAN-254, vinculada a KAN-232  
Entorno certificado: navegador Chromium, backend real, PostgreSQL desechable y Mailpit sandbox.

## Resultado

El owner puede abrir el enlace recibido, acreditar la identidad invitada, revisar el Brief confirmado y su contexto canónico, aceptar o rechazar, y recuperar la misma respuesta tras recargar. Portfolio Lead ve el destinatario, la versión exacta del Brief, el emisor, el actor de la respuesta y una cronología que distingue transporte SMTP de decisión humana. Aceptar no inicia trabajo ni Steps (`startedAt` y `startedBy` permanecen nulos).

## Matriz AS-IS / TO-BE

| Bloque | AS-IS en PR #304 | Clasificación AS-IS | TO-BE KAN-254 | Evidencia |
|---|---|---|---|---|
| Enlace y claim | Token, preview y claim por email funcionaban; el caso principal estaba certificado en sandbox. | Funcional, cobertura incompleta | Owner existente, owner nuevo, mismatch y cambio de cuenta certificados en navegador. | Playwright KAN-254 + PostgreSQL |
| Datos para Owner | La vista mostraba Brief y textos genéricos; faltaban frente, reto, objetivo, restricciones, emisor y equipo canónicos. | Incompleto | Proyección canónica desde Assignment → Challenge → StrategicFront / Project / BriefVersion / actor / miembros; ausencias se muestran como “No informado”. | Tests de servicio y `HandoffShell` |
| Aceptación/rechazo | Ambos comandos persistían; rechazo exigía motivo. | Funcional | Confirmaciones y errores accesibles, motivo recuperable, aceptación sin inicio automático. | Playwright + tests focales |
| Registro de owner nuevo | El token se guardaba, pero un registro activo sin tokens se presentaba como lista de espera y no continuaba el claim. | Incompleto | Si existe invitación pendiente, registro intenta el login normal una vez y el claim existente consume el mismo token; no autoacepta. | Test `AuthPage` + Playwright |
| Portfolio Lead | Mostraba estado agregado y transporte, sin actor, versión numérica ni historia ordenada. | Incompleto | Muestra Brief exacto, emisor, actor material, destinatario, motivo/respuesta y cronología transporte/handoff. | Tests Home + Playwright |
| SMTP vs aceptación | “Enviada (SMTP aceptado)” existía, pero no había una historia conjunta explícita. | Incompleto | `delivery_smtp_accepted` se etiqueta como transporte; `assignment_accepted/rejected` como respuesta humana. | Home y cronología persistida |
| Duplicados/reentrada | Idempotencia de envío estaba implementada y probada principalmente por API. | Funcional, certificación parcial | Replay conserva un batch, una invitación y un intento; recarga no duplica Assignment ni respuesta. | Playwright + conteos DB |
| Tenant/identidad | Guards y comparación de email existían. | Funcional, certificación parcial | Otro tenant obtiene 404; identidad incorrecta no recibe Brief/contexto ni acciones. | Playwright |
| Expiración | El backend invalidaba el token, pero el claim directo podía confirmar `EXPIRED` sin una traza durable recuperable. | Incompleto | Apertura y claim comparten transición; un `eventId` determinista permite reconciliar el único `assignment_expired` incluso si el primer publish falla. | Unit de fallo/replay + Playwright + DB |
| Accesibilidad | Semántica base disponible; overlay del diálogo emitía warning de ref y no había certificación Owner AA/móvil. | Incompleto | Overlay con `forwardRef`, error asociado, foco de diálogo/teclado, axe A/AA y capturas responsive. | Unit + axe + Playwright |
| Correo productivo | No certificado por PR #304. | Ausente de esta certificación | Se mantiene fuera: sólo se acredita aceptación del SMTP sandbox Mailpit. | Límite explícito |

## Información recibida por Owner

- tipo de encargo y estado humano;
- frente estratégico, reto e iniciativa real cuando existe;
- Brief confirmado, número de versión e identificador inmutable;
- objetivo y alcance del Brief;
- objetivo estratégico y objetivo/contexto del reto;
- resultado esperado, restricciones, horizonte e información pendiente;
- contexto específico del Assignment;
- emisor real y miembros persistidos del encargo;
- fuentes y procedencia del Brief;
- motivo de rechazo y respuesta posterior de Portfolio Lead, cuando existan.

Los campos ausentes se representan como `No informado`; no se sintetizan explicaciones de negocio.

## Información que retorna a Portfolio Lead

- organización, reto/iniciativa y destinatario;
- estado de transporte: no enviado, solicitado, SMTP aceptado o fallido;
- estado humano: pendiente, aceptado, rechazado, expirado o revocado;
- fecha y referencia del transporte cuando existen;
- versión exacta del Brief y fecha de confirmación;
- emisor y actor material de la respuesta;
- motivo del rechazo y respuesta del Portfolio Lead;
- historia ordenada, fuente (`transport` o `handoff`) y referencias persistidas.

## Recorrido certificado

1. Portfolio Lead crea un encargo sobre un Brief confirmado y lo envía a Mailpit.
2. Un usuario con identidad incorrecta abre el enlace: no ve datos canónicos y no puede responder.
3. “Cambiar de cuenta” conserva el token; el owner correcto entra y recupera el encargo.
4. El owner revisa los datos canónicos, abre el rechazo con teclado, recupera un error por motivo vacío y rechaza con razón material.
5. Tras recargar, estado y motivo se conservan sin duplicados.
6. Un email sin usuario abre el enlace, se registra, hace login/claim del mismo token y acepta; no se inicia trabajo.
7. Una invitación vencida queda terminal y genera un único `assignment_expired` sin habilitar acciones; si el primer publish falla, el replay reconcilia el evento con el mismo identificador determinista.
8. Portfolio Lead vuelve a Inicio, abre el detalle y recupera SMTP y rechazo como eventos distintos.

Comando reproducible:

```powershell
$env:E2E_WITH_MAILPIT='true'
npm run test:e2e -- e2e/kan254-owner-handoff-acceptance.spec.ts
```

Resultado: `1 passed`. El harness creó y destruyó su PostgreSQL y Mailpit aislados.

Verificación local adicional:

| Comprobación | Resultado |
|---|---|
| Typecheck frontend + backend | Pasa |
| Lint baseline | Pasa |
| Build Vite productivo | Pasa (warnings de tamaño/dynamic import ya existentes) |
| Suite frontend completa | 150 archivos, 1200 tests, todos pasan |
| Batería backend focal Handoff/Home | 7 archivos, 70 tests, todos pasan; la regresión final de expiración deja 49/49 en los tres archivos afectados |
| Playwright KAN-254 aislado | 1 escenario, pasa |
| Suite backend local completa | 2010 tests pasan; 11 tests PL-04 no arrancan porque la DB local externa al harness carece de `PortfolioOrganizationMaterialization`. El E2E desechable sí aplicó las 80 migraciones. |

Capturas generadas en `front/test-results/kan254-owner-handoff-...-chromium/`:

- `owner-pending-mobile-375.png`
- `owner-pending-tablet-768.png`
- `owner-pending-desktop-1440.png`
- `owner-rejected-reentry.png`
- `new-owner-accepted-mobile.png`
- `portfolio-lead-trace-reentry.png`

## Revisión independiente

Se ejecutaron las tres rondas máximas previstas. Las rondas identificaron y motivaron correcciones en etiquetas de eventos, reentrada de la traza, refresco del Assignment tras claim, clasificación transporte/actividad/respuesta y recuperación de expiración. El último hallazgo —fallo entre transición y publicación— quedó resuelto después del veredicto de ronda 3 mediante evento determinista, replay reconciliable y una regresión que simula el fallo del primer publish. No se declara una cuarta aprobación implícita: el árbol queda listo para revisión de PR y CI.

## Evaluación Nielsen H1–H10

| Heurística | Resultado | Decisión/evidencia |
|---|---|---|
| H1 Visibilidad | Cumple | Estado pendiente/aceptado/rechazado/terminal visible; transporte separado en Lead. |
| H2 Mundo real | Cumple | “Brief”, “Frente”, “Reto”, “Emite” y “Respuesta humana” usan lenguaje del dominio. |
| H3 Control | Cumple | Rechazo cancelable; cambio de cuenta; no hay autoaceptación ni autoinicio. |
| H4 Consistencia | Cumple | Etiquetas alineadas con Portfolio Overview y estados gobernados. |
| H5 Prevención | Cumple | Identidad, tenant, versión, motivo e idempotencia se validan antes de mutar. |
| H6 Reconocimiento | Cumple | El contexto y la versión están visibles; no se exige recordar el email. |
| H7 Flexibilidad | Cumple | Reentrada por enlace y continuación después de login/registro. |
| H8 Diseño mínimo | Cumple | Datos agrupados por contexto, resultado, responsables y procedencia. |
| H9 Recuperación | Cumple | Errores de identidad, motivo vacío, expiración y recuperación de cuenta son explícitos. |
| H10 Ayuda contextual | Cumple | La UI explica qué implica responder y que rechazo no reasigna automáticamente. |

## WCAG y visual

- Axe WCAG 2 A/AA y 2.1 A/AA: sin violaciones en `handoff-shell`.
- Teclado: apertura del diálogo con Enter, foco gestionado por Radix y error asociado mediante `aria-describedby`/`role=alert`.
- Responsive: 375×812, 768×1024 y 1440×1000.
- Comparación visual contra baseline: **INCONCLUSA**, porque no existe un baseline aprobado para esta vista. Las capturas son evidencia de inspección, no una aprobación automática de regresión visual.

## Límites restantes

- El envío certificado es Mailpit sandbox. No se afirma entrega a buzones productivos ni despliegue productivo.
- No se modificó ni certificó el botón de inicio posterior a la aceptación; KAN-254 verifica que aceptar por sí solo no lo ejecuta.
- No se implementaron Steps 0–4, MCP, memoria, checkpoints, brief de resultados ni alertas.
- La política productiva de alta/lista de espera sigue gobernando si una cuenta puede autenticarse; la recuperación implementada no elude una cuenta realmente inactiva.
- Sin baseline visual aprobado, el veredicto visual sigue siendo inconcluso aunque axe, teclado y viewports pasen.
