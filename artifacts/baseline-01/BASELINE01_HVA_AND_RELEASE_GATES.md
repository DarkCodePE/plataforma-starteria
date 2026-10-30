# BASELINE-01 — HVA y gates de release

## Estado

- Baseline técnico local: `PASS`.
- Aceptación visual formal UX-03B/ChatFix: `HVA_PENDING`.
- Teclado virtual real Android/iOS: `REAL_MOBILE_KEYBOARD_NOT_RUN`.
- LLM vivo: `LLM01_GATES_BLOCKED`.
- Release/producción: `BLOCKED_NOT_AUTHORIZED`.

## Gates humanos pendientes

1. Ratificar visualmente Steps activo, completado, histórico sin output y compositor móvil.
2. Probar teclado virtual en dispositivo real seguro.
3. Revisar y aceptar la sensibilidad TZ/DST del test de grandfathering o fijar su cálculo a días calendario.
4. Corregir/revisar el packaging editable Python antes de distribuir `ai-service`.
5. Tratar el informe de vulnerabilidades npm sin aplicar actualizaciones masivas automáticas.
6. Aprobar proveedor, modelo, tratamiento de datos, presupuesto, HMAC/anti-replay y operación antes de LLM real.

## Riesgos Git/CD

- PR Portfolio Lead #222 estaba abierto sobre el SHA de entrada; este baseline no lo fusiona ni lo reaplica.
- `.github/workflows/cd.yml` puede convertir futuros cambios sobre `main` en despliegue. La verificación local no autoriza push/merge.
- El gate ADR-009 debe revisarse en cualquier futura propuesta de integración; no se reparó ni eludió contra un destino real.
- El commit documental posterior al candidato debe revisarse separado del SHA ejecutable.

## Decisiones no tomadas

No se declaró release listo, HVA aprobada, LLM validado ni producción autorizada. Tampoco se modificaron Core v0.2, autoridad humana, hard gates, KAN-178 o datos protegidos.

