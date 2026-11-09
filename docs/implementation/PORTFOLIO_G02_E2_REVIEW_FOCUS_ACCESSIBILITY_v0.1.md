# Goal 02 — Accesibilidad y orientación en la transición al checkpoint E2

Fecha: 2026-11-09. Base: main@49fdceaff3860c71580baa2ed9cba28a8fcb235a. Estado: código candidato sujeto a CI y revisión, no certificación de UX productiva.

## AS-IS verificado por inspección de código
Cuando la última respuesta E2 hace que el servidor devuelva `activeQuestion:null`, la revisión se abre automáticamente (PR #296), pero no se gestiona el foco. La sección puede estar visualmente abierta sin recibir foco de teclado; un lector de pantalla puede permanecer en el formulario recién enviado. Además, el aviso de respuestas pendientes decía «Puedes continuar con la siguiente pregunta» incluso cuando ya no había pregunta, y «1 respuestas».

## TO-BE implementado
- Un título accesible «Revisión de tus respuestas» aparece dentro de la región de revisión.
- Solo después de que el usuario envía la última respuesta y se abre la revisión, el foco de teclado se mueve a dicho título.
- En reentrada con revisión abierta automáticamente no se roba foco de navegación.
- El aviso distingue entre conversaciones en curso y conversación sin preguntas pendientes; singular/plural correctos.
- La selección aceptar/rechazar y checkpoint siguen exclusivamente bajo autoridad humana; no se guarda ni aplica nada al mover foco.
- Flags opt-in y controles de E1/Anchor/ledger sin cambios.

## Nielsen Norman Group
- H1 visibilidad del estado: texto de siguiente acción consistente con la pregunta real.
- H3 control y libertad: no se aplica checkpoint automáticamente.
- H4 consistencia: singular/plural y estructura de heading de revisión.
- H6 reconocimiento: el foco conduce a la siguiente tarea tras una acción explícita.
- H9 recuperación: reentrada no altera estado ni fuerza foco.

## Evidencia
Pruebas RTL actualizadas para verificar foco tras completar, ausencia de robo de foco al reentrar, textos de estado y ausencia de mutaciones automáticas.

## AS-IS → TO-BE
AS-IS: enviar última respuesta → revisión abierta visualmente, foco se queda atrás → buscar manualmente próximo paso.
TO-BE: enviar última respuesta → revisión abierta, título recibe foco → comparar propuestas → elegir aceptar/descartar → checkpoint explícito → confirmar Anchor por separado.

## Límites
- Se requiere verificación en navegador real con teclado y lector de pantalla antes de declarar accesibilidad aceptada.
- Faltan los tres perfiles de prueba (sin iniciativas, pyme y corporate), el E2E visual autenticado y la evaluación H1-H10.
- No activa flags ni runtime semántico E2. ADR-010 sigue pendiente de ratificación según fuente vigente.
- No cerrar Goal #292 por este cambio aislado.
