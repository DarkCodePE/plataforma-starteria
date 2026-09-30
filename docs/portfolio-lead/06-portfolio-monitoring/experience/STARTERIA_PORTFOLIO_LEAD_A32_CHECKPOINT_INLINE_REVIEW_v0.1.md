# STARTERIA — Portfolio Lead A.3.2 — Checkpoint-based Review & Inline Clarification v0.1

**Estado:** DELTA IMPLEMENTATION SPEC  
**Depende de:**
- `STARTERIA_PORTFOLIO_LEAD_SLICE_A3_FIRST_VALUE_NARRATIVE_REFINEMENT_v0.2.md`
- `STARTERIA_PORTFOLIO_LEAD_A31_CONTEXTUAL_ENRICHMENT_ENTRY_CONTINUITY_v0.2.md`

**Objetivo:** Hacer que cada etapa P1–P3 tenga un checkpoint comprensible, preserve estado y permita corregir/confirmar en contexto sin devolver al usuario al inicio ni crear validación iniciativa por iniciativa.

---

# 1. Principio

Cada punto del setup debe seguir:

```text
usuario aporta
↓
Startería interpreta
↓
Startería muestra qué entendió
↓
usuario confirma / ajusta
↓
se continúa
```

No:

```text
usuario aporta
↓
Startería analiza
↓
usuario descubre errores al final
↓
volver al inicio
```

---

# 2. Checkpoint P1 — Intención

Usuario escribe:

> Queremos conseguir 200 nuevas ventas B2B durante Q4.

Startería responde de forma compacta:

```text
Esto es lo que entendí

Objetivo
200 nuevas ventas B2B

Horizonte
Q4

[ Está bien, continuar ]
[ Ajustar ]
```

Contexto opcional:

```text
Si quieres, puedes añadir:
- producto / línea
- área o proceso
- situación actual
```

No obligatorio.

---

# 3. Checkpoint P2 — Trabajo existente

Después de pegar información, Startería NO debe saltar directamente a la lectura final.

Primero muestra:

# Esto es lo que encontré

```text
7 iniciativas
5 responsables mencionados
2 sin responsable claro
1 dependencia relevante
```

Y una lista compacta:

```text
Content Campaign
Lead Assistant
Pricing Pilot
Channel Partners
Checkout Optimizer
CRM Follow-up
Webinar Series
```

Acciones:

```text
[ Sí, esto representa mi trabajo ]
[ Ajustar lista ]
[ Añadir algo más ]
```

---

# 4. Ajustar sin perder contexto

`Ajustar lista` NO vuelve al principio.

Debe abrir edición inline / drawer / modal contextual sobre P2.

Permitir:

- corregir nombre;
- eliminar elemento detectado erróneamente;
- añadir iniciativa faltante;
- corregir responsable;
- añadir contexto breve.

Al cerrar:

```text
volver al mismo checkpoint
```

con estado preservado.

---

# 5. P3 — Análisis después del checkpoint

Solo después de confirmar P2:

```text
trabajo validado
↓
Startería analiza relaciones
```

Esto aumenta confianza porque el usuario sabe que el análisis parte de una lista correcta.

---

# 6. Preguntas de aclaración específicas

No mostrar:

> Veo varias iniciativas que podrían responder una necesidad distinta...

sin indicar cuáles.

Mostrar:

# Tengo una duda sobre 3 iniciativas

```text
Pricing Pilot
Checkout Optimizer
CRM Follow-up
```

Pregunta:

> Pricing Pilot y Checkout Optimizer parecen estar más relacionados con monetización/conversión, mientras CRM Follow-up parece apoyar seguimiento comercial.  
> ¿Forman parte del mismo objetivo de nuevas ventas B2B o alguna pertenece a otra prioridad?
```

Input:

```text
[ Escribe tu respuesta… ]
```

Acciones:

```text
[ Guardar aclaración ]
[ Continuar sin responder ]
```

La respuesta debe modificar la lectura de la sesión actual.

---

# 7. Una pregunta puede resolver varias iniciativas

Startería debe agrupar incertidumbres.

Ejemplo:

```text
1 pregunta
→ aclara 3 iniciativas
```

No:

```text
3 iniciativas
→ 3 preguntas
```

---

# 8. Reemplazar estados técnicos

No mostrar al usuario:

```text
Relación clara
Por revisar
Posible mejor encaje
```

como etiquetas aisladas.

Usar lenguaje orientado a significado.

## Reemplazos

### Relación clara

```text
Contribuye directamente
```

Subcopy:

> La información disponible muestra una relación directa con el objetivo.

### Por revisar

```text
Necesita más contexto
```

Subcopy:

> Todavía no hay suficiente información para entender bien cómo contribuye.

### Posible mejor encaje

```text
Podría responder mejor a otra prioridad
```

Subcopy:

> Puede contribuir aquí, pero parece estar más relacionada con otra necesidad de negocio.

---

# 9. Summary cards más claras

En lugar de:

```text
4 Relación clara
2 Por revisar
1 Posible mejor encaje
```

mostrar:

```text
4
Contribuyen directamente

2
Necesitan más contexto

1
Podría responder mejor a otra prioridad
```

Debajo:

> 7 iniciativas analizadas.

---

# 10. CTA de revisión

`Revisar las 3 que necesitan atención` solo puede existir si abre realmente una revisión.

Mientras P4 no exista, P3 debe resolver esta revisión inline.

CTA:

```text
[ Revisar 3 excepciones ]
```

Abre dentro de la misma pantalla:

- las 2 que necesitan más contexto;
- la 1 con posible mejor encaje.

No navegar a otra ruta.

---

# 11. Revisión inline de excepciones

Ejemplo:

```text
Pricing Pilot
Podría responder mejor a otra prioridad

Por qué:
La iniciativa parece centrarse en pricing/monetización.

[ Añadir contexto ]
[ Mantener en este objetivo ]
[ Marcar para revisar después ]
```

No pedir confirmación en iniciativas claras.

---

# 12. Confirmación a nivel de lectura

Después de revisar excepciones:

```text
Startería propone esta lectura:

4 contribuyen directamente
2 quedan con contexto pendiente
1 puede corresponder a otra prioridad

[ Continuar con esta lectura ]
[ Seguir ajustando ]
```

Esta es la confirmación humana principal.

---

# 13. No perder estado

Regla obligatoria:

```text
P1 input
P1 context
P2 work
P2 corrections
P3 clarifications
```

deben mantenerse durante toda la sesión.

Ningún CTA de ajuste debe resetear:

- objetivo;
- contexto;
- trabajo detectado;
- respuestas previas.

---

# 14. Storytelling final P3

Orden:

```text
1. Esto es lo que entendí
2. Así parece repartirse el trabajo
3. Qué merece revisar
4. Cómo contribuyen las iniciativas al objetivo
5. Excepciones / dudas específicas
6. Confirmación de lectura
7. Siguiente paso
```

---

# 15. Acceptance Criteria

## AC-A3.2-01
Cada etapa P1/P2/P3 tiene checkpoint visible.

## AC-A3.2-02
P2 permite confirmar la lista detectada antes de analizar relaciones.

## AC-A3.2-03
Ajustar P2 no devuelve al usuario al inicio.

## AC-A3.2-04
La pregunta de aclaración identifica iniciativas concretas.

## AC-A3.2-05
Existe un input visible para responder la aclaración.

## AC-A3.2-06
La respuesta modifica la lectura de la sesión actual.

## AC-A3.2-07
No se muestran estados técnicos ambiguos sin explicación.

## AC-A3.2-08
Las summary cards usan lenguaje orientado a negocio.

## AC-A3.2-09
`Revisar excepciones` tiene comportamiento real inline.

## AC-A3.2-10
No existe CTA visible sin destino.

## AC-A3.2-11
Las iniciativas claras no requieren confirmación individual.

## AC-A3.2-12
El usuario confirma la lectura global, no cada Initiative.

## AC-A3.2-13
El estado P1→P3 se conserva durante ajustes.

## AC-A3.2-14
Portfolio de 20+ iniciativas mantiene revisión por excepción.

---

# 16. Principio final

> Cada checkpoint debe darle al Portfolio Lead confianza de que Startería entendió correctamente antes de construir la siguiente capa de análisis.

Y:

> Startería debe pedir intervención humana solo donde una aclaración pueda cambiar la lectura.
