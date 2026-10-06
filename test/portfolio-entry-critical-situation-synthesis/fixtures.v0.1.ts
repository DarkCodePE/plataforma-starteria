/** Frozen model stimuli for KAN-114. Evaluation expectations live separately. */
export type CriticalSituationSynthesisFixture = {
  fixture_id: string;
  display_name: string;
  user_message: string;
};

export const CRITICAL_SITUATION_SYNTHESIS_FIXTURES: readonly CriticalSituationSynthesisFixture[] = [
  {
    fixture_id: 'CS-01',
    display_name: 'Laura — varias iniciativas, churn y horizonte trimestral',
    user_message: 'Laura coordina ocho iniciativas relacionadas con reducir churn. Los datos existentes muestran que el churn aumentó en dos segmentos durante los últimos dos trimestres, pero las cancelaciones se observan con retraso. La revisión de portafolio es en diez semanas y espera evidencia de progreso trimestral. Las iniciativas comparten capacidad limitada de análisis. No se ha establecido qué iniciativa causa o reduce churn.',
  },
  {
    fixture_id: 'CS-02',
    display_name: 'Programa de innovación existente: progresión y gobernanza',
    user_message: 'Un programa tiene 46 ideas en su backlog. De tres cohortes, seis ideas pasaron la revisión inicial. No hay criterios de progresión documentados. El equipo del programa dice que las propuestas esperan decisiones de comité; dos patrocinadores dicen que no reciben evidencia suficiente de los responsables. Hay minutas de comité, un historial de cohortes y responsables registrados para parte de las ideas.',
  },
  {
    fixture_id: 'CS-03',
    display_name: 'Tecnología comprada: outcome y continuidad de inversión poco claros',
    user_message: 'La organización compró una plataforma de automatización hace nueve meses. Dos equipos la usan en un piloto. La renovación anual vence en siete semanas. El outcome esperado era reducir el tiempo de ciclo, pero no hay baseline confirmado ni una medida acordada. Existen contrato, registros de uso del piloto y descripción del proceso actual. La persona usuaria pregunta qué preparar antes de renovar.',
  },
  {
    fixture_id: 'CS-04',
    display_name: 'Iniciativa bloqueada por dependencia organizacional externa',
    user_message: 'Una iniciativa de análisis de reclamaciones necesita acceso aprobado a un conjunto de datos controlado por otro departamento. La solicitud lleva cinco semanas pendiente y no tiene fecha de respuesta. El equipo ya documentó el flujo de reclamaciones y puede mapear campos usando muestras ficticias; la validación con datos reales depende del permiso. Existe una solicitud con número de seguimiento y un contacto del departamento dueño.',
  },
  {
    fixture_id: 'CS-05',
    display_name: '“Queremos innovar más” con muchas iniciativas',
    user_message: 'La persona dice: “Queremos innovar más”. El portfolio ya contiene 23 iniciativas activas con nombres, responsables y estado actual. No aporta una definición de “más”, objetivos, resultados, obstáculos, horizonte o evidencia sobre la progresión de esas iniciativas.',
  },
  {
    fixture_id: 'CS-06',
    display_name: 'Caso altamente ambiguo: base insuficiente',
    user_message: 'La única entrada es: “Algo en el trabajo necesita mejorar y todos dicen que es estratégico. No sé qué más añadir”. No hay un resultado deseado concreto, situación descrita, decisión, actores, evidencia, activo o restricción.',
  },
  {
    fixture_id: 'CS-07',
    display_name: 'Caso regulatorio: hace falta evidencia externa',
    user_message: 'Un equipo de producto de una entidad financiera planea lanzar una funcionalidad en catorce semanas. Existen un brief de producto y un memo interno de riesgos. El memo dice “requiere revisión regulatoria”, pero no identifica la norma aplicable ni si cubre la funcionalidad. La persona dueña de Compliance todavía no responde. El plan de lanzamiento ya tiene fecha.',
  },
  {
    fixture_id: 'CS-08',
    display_name: 'Una sola iniciativa clara; no forzar reasoning de portfolio',
    user_message: 'Una clínica quiere elevar la tasa de reservas completadas en su sitio del 24% al 30% al cierre del trimestre. Una prueba A/B de dos variantes de la pantalla de reserva ya está activa y termina en dos semanas. Hay una persona responsable de revisar el resultado. No se mencionan otras iniciativas ni dependencias.',
  },
] as const;
