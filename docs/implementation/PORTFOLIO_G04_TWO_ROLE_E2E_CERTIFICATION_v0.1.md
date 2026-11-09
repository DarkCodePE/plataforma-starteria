# G04 — Certificación E2E autenticada de alertas entre equipo y Portfolio Lead

Base verificada: main@256b19b9ab9bba7c9037452ec8b0e3c65e02cc8a, PR #302 merged, CI postmerge #42714509466 SUCCESS.

## Alcance y evidencia
Prueba: `front/e2e/portfolio-g04-two-role-attention.spec.ts`, ejecutada en CI mediante el runner E2E con navegador Chromium, API real y PostgreSQL desechable. Sin interceptar API ni crear Step ficticio.

**Ruta del usuario y checkpoints:**
1. Cuentas independientes OWNER y Portfolio Lead con scopes reales; tercero sin relación con el proyecto.
2. El owner entra a Initiative Overview y registra explícitamente un bloqueo.
3. Persistencia `AttentionItem` y único evento de creación; reintento con mismo Idempotency-Key debe devolver la misma alerta.
4. Portfolio Lead entra en Inicio, expande la iniciativa, ve la alerta e ingresa una respuesta; se crea un evento con versión CAS.
5. El owner vuelve a la pantalla y ve la respuesta humana en su historial.
6. Se intenta una operación concurrente con versión anterior; la API responde 409 sin nuevo evento.
7. Portfolio Lead resuelve explícitamente y el owner ve el motivo; Home deja de contarla como alerta activa; se conservan tres eventos.
8. Comprobaciones negativas: tercero sin pertenencia no puede leer o escribir; owner no puede mutar el recurso de portafolio.

## Restricciones
- El test usa proyecto canónico independiente, dos logins reales y estados reales, no valida envío de email/push ni campana instantánea.
- No acredita UX completa Nielsen H1–H10 ni pruebas con usuario real; se requieren capturas y aceptación funcional.
- No acredita KPI/impacto; esos datos siguen sin inferirse.
- No desplegar ni fusionar sin revisión de CI, aprobación y prueba postmerge.
- Una implementación de G05 debe formalizarse después de cerrar las brechas transversales de G01–G04.

## Corrección de experiencia
En `InitiativeAttentionReporter`, se muestra el historial con respuestas y motivo de resolución al owner. Antes solo se mostraba estado de la alerta; el requisito de cierre del circuito no era observable para el equipo.
