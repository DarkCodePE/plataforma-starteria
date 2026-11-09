# G03 — Gate de recorrido E3→E7 y brechas verificables

Fecha: 2026-11-09. Base: main@b3a911e5b66d8dde4b395833395f70a93df139d3.

## Inventario AS-IS comprobado
- `front/e2e/kan212-g2a-navigation.spec.ts`: E3 no-work, incorporación de un item y análisis E4 con persistencia/reentrada; actualmente incorporado a CI.
- `front/e2e/kan240-e1-e7-delta.spec.ts`: tres escenarios no incorporados aún a CI: (A) cafetería sin piloto, (C) distribuidora que tiene un MVP y logs, y (A) continuidad de una misma sesión E1→E7→Home.
- `front/e2e/kan227-portfolio-lab-request.spec.ts`: valida solicitud scoped/persistida a Lab, no equivale a una invitación entregada ni a Assignment / Project / Step.
- El test E1→E7 de KAN-240 realiza E1/E2/E3 vía interfaz, pero materialización de propuesta de organización, brief y contacto Lab **mediante API**. No se debe declarar que E5/E6/E7 se han completado desde UI.
- Los estados del test de cafetería son «Brief confirmado» y «Contacto pendiente», no una entrega/aceptación real de Assignment.
- No existe evidencia suficiente de UX multiiniciativa corporate/duplicados/owners/recepción de briefs y confirmación de entrega.

## TO-BE de esta entrega
Añadir `front/e2e/kan240-e1-e7-delta.spec.ts` como gate de Playwright autenticado en CI, manteniendo los tres escenarios completos y PostgreSQL aislado. El resultado debe revelar regresiones, sin reinterpretar «contacto pendiente» como asignación.

## Criterios para cerrar G03 (pendientes)
1. Caso sin iniciativas: E3 no-work→E5 sin crear frente artificial→E6 brief humano revisable→E7 decisión explícita owner/Lab; reentrada correcta.
2. Pyme: E3 item manual existente→E4 análisis con procedencia→E5 organización editada/aprobada→E6 brief→E7 owner.
3. Corporate: múltiples items, posibles duplicados, conflictos, distintos owners; separar datos/hipótesis y verificar permisos.
4. E7: persistencia del Assignment real y estados envío/recepción/aceptación/rechazo; no simular envío, no confundir Lab contact request con Assignment.
5. Evidencia UI auténtica de cada etapa con Selenium/Playwright o navegador real, capturas AS-IS→TO-BE, trazabilidad y reentrada.
6. Nielsen H1–H10: 0 bloqueos severos abiertos y aceptación funcional humana.
7. CI postmerge y verificación en entorno autorizado; sin activación automática de Step 0–4.

## Riesgos y restricciones
Esta entrega *solo convierte cobertura ya existente en CI obligatorio*. No agrega funcionalidad de producto ni cierra G03. Exponer fallos del gate es deseado: deben corregirse antes de declarar estabilidad.
