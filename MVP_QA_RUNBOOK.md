# MVP-INT-01 — QA runbook

## Entorno actualmente levantado

- Aplicación: http://127.0.0.1:5181
- API/health: http://127.0.0.1:4105/api/health
- Stub AI/health: http://127.0.0.1:8004/health
- Mailpit: http://127.0.0.1:8027
- PostgreSQL QA: `127.0.0.1:55436`, compose project `starteria_mvp_int01_qa_20261026`

La DB QA es aislada y persistente. La DB protegida `starteria-db` en 5433 no fue alterada.

## Acceso

Las cuentas sintéticas estándar se crean con `front/prisma/seed.e2e.ts`. Los fixtures Owner/KAN-178 se crean con `backend/scripts/prepare-kan178-owner-continuity-visual.ts`. Los dos accesos humanos verificados y el deep link Owner están en `C:\Users\User\proyect-starteria\_qa-runtime\MVP-INT-01-20261026\human-access.env`, fuera de Git y protegidos por ACL local. Este runbook no copia passwords ni tokens.

## Recorrido humano recomendado

1. Abrir la aplicación como Portfolio Lead y revisar Scope/Frente/Reto/Brief.
2. Enviar una asignación y abrir el correo capturado en Mailpit.
3. Abrir la invitación como Initiative Owner; verificar Brief, Accept y Activation Overview.
4. Pulsar Start y reentrar: no deben reaparecer Accept/Start ni crearse nuevas entidades.
5. Abrir la iniciativa materializada y recorrer Overview → Step 0; continuar Steps 1–4 con confirmaciones reales.
6. En Step 0 comprobar misión y procedencia, Copilot prominente, checkpoint diferenciado, persistencia tras reload y modo sintético honesto.
7. Repetir la inspección a 1440×900, 768×1024 y 390×844.

No aceptar visualmente desde este documento: registrar la HVA humana por separado.

## Operación

Desde el worktree integrado:

```powershell
rtk powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\mvp-integration\start-qa.ps1
rtk powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\mvp-integration\stop-qa.ps1
```

`stop-qa.ps1` detiene sólo los PIDs registrados y Mailpit; preserva PostgreSQL QA para reentrada.

El worktree sólo conserva `qa-pids.json`; los logs vivos quedan fuera del árbol Git en `C:\Users\User\proyect-starteria\_qa-runtime\MVP-INT-01-20261026` para evitar que tokens de navegación entren en evidencia. Capturas: `artifacts/mvp-integration/portfolio-lead-brief/`, `owner-continuity/` y `steps-ux02b/`.
