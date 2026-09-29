export interface FirstValueInitiative {
  id: string;
  name: string;
  description: string;
  owner?: string;
}

export interface FirstValueGroup {
  id: string;
  label: string;
  initiativeIds: string[];
  rationale: string;
}

export interface FirstValueSignal {
  id: string;
  label: string;
  detail: string;
  provenance: 'Encontrado en la información';
}

export interface FirstValueReading {
  detectedGoal: string;
  horizon: string;
  initiatives: FirstValueInitiative[];
  owners: string[];
  groups: FirstValueGroup[];
  signals: FirstValueSignal[];
}

export const NOVAGROWTH_WORK_INPUT = `Content Campaign — campaña para generar leads B2B. Laura.
Lead Assistant — asistente para responder y cualificar leads. Ana.
Pricing Pilot — prueba de pricing. Carlos.
Channel Partners — explorar partners. Marta.
Checkout Optimizer — reducir fricción en contratación. Sin owner claro.
CRM Follow-up — automatizar seguimiento. Luis.
Webinar Series — webinars para captar leads. Sin owner claro.

Pricing Pilot tiene feedback inicial positivo.
Lead Assistant espera acceso a datos CRM.
Dirección revisará avance en seis semanas.`;

export const NOVAGROWTH_READING: FirstValueReading = {
  detectedGoal: '200 nuevas ventas B2B',
  horizon: 'Q4',
  initiatives: [
    { id: 'content-campaign', name: 'Content Campaign', description: 'Generar leads B2B.', owner: 'Laura' },
    { id: 'lead-assistant', name: 'Lead Assistant', description: 'Responder y cualificar leads.', owner: 'Ana' },
    { id: 'pricing-pilot', name: 'Pricing Pilot', description: 'Probar una nueva propuesta de pricing.', owner: 'Carlos' },
    { id: 'channel-partners', name: 'Channel Partners', description: 'Explorar partners de canal.', owner: 'Marta' },
    { id: 'checkout-optimizer', name: 'Checkout Optimizer', description: 'Reducir fricción en contratación.' },
    { id: 'crm-follow-up', name: 'CRM Follow-up', description: 'Automatizar seguimiento.', owner: 'Luis' },
    { id: 'webinar-series', name: 'Webinar Series', description: 'Captar leads mediante webinars.' },
  ],
  owners: ['Laura', 'Ana', 'Carlos', 'Marta', 'Luis'],
  groups: [
    {
      id: 'generate-opportunities',
      label: 'Generar oportunidades',
      initiativeIds: ['content-campaign', 'channel-partners', 'webinar-series'],
      rationale: 'Content Campaign, Channel Partners y Webinar Series parecen orientadas principalmente a generar nuevas oportunidades antes de la fase de tratamiento o conversión.',
    },
    {
      id: 'work-opportunities',
      label: 'Trabajar oportunidades',
      initiativeIds: ['lead-assistant', 'crm-follow-up'],
      rationale: 'Lead Assistant y CRM Follow-up actúan sobre la respuesta, cualificación y seguimiento de oportunidades ya generadas.',
    },
    {
      id: 'convert-opportunities',
      label: 'Convertir oportunidades',
      initiativeIds: ['pricing-pilot', 'checkout-optimizer'],
      rationale: 'Pricing Pilot y Checkout Optimizer parecen orientadas a reducir fricción y mejorar la conversión hacia la contratación.',
    },
  ],
  signals: [
    {
      id: 'distribution',
      label: 'Distribución',
      detail: 'Hay más trabajo orientado a generar y trabajar oportunidades que a convertirlas. Todavía no sabemos si esta distribución es intencional.',
      provenance: 'Encontrado en la información',
    },
    {
      id: 'ownership',
      label: 'Ownership',
      detail: 'Dos iniciativas no tienen responsable claro en la información añadida.',
      provenance: 'Encontrado en la información',
    },
    {
      id: 'dependency',
      label: 'Dependencia',
      detail: 'Lead Assistant depende de acceso a datos CRM.',
      provenance: 'Encontrado en la información',
    },
  ],
};

const EXPANDED_INITIATIVE_NAMES = [
  'Content Campaign', 'Lead Assistant', 'Pricing Pilot', 'Channel Partners', 'Checkout Optimizer', 'CRM Follow-up', 'Webinar Series',
  'SEO Expansion', 'B2B Events', 'Outbound Sequences', 'Partner Enablement', 'Lead Scoring', 'Sales Playbook', 'Demo Experience',
  'Regional Pricing', 'Contract Simplifier', 'Renewal Outreach', 'Customer Proof', 'Onboarding Workshops', 'Pipeline Hygiene',
  'Forecast Quality', 'Revenue Operations', 'Enterprise Landing Pages', 'Trial Conversion Lab',
];

const EXPANDED_OWNERS = ['Laura', 'Ana', 'Carlos', 'Marta', 'Luis', 'Sofía', 'Diego', 'Nuria', 'Pablo', 'Irene', 'Jorge', 'Elena'];

export const NOVAGROWTH_EXPANDED_WORK_INPUT = `NovaGrowthExpanded\n${EXPANDED_INITIATIVE_NAMES
  .map((name, index) => `${name} — trabajo relacionado con crecimiento B2B. ${EXPANDED_OWNERS[index % EXPANDED_OWNERS.length]}.`)
  .join('\n')}`;

export const NOVAGROWTH_EXPANDED_READING: FirstValueReading = {
  detectedGoal: NOVAGROWTH_READING.detectedGoal,
  horizon: NOVAGROWTH_READING.horizon,
  initiatives: EXPANDED_INITIATIVE_NAMES.map((name, index) => ({
    id: `expanded-${index + 1}`,
    name,
    description: 'Trabajo relacionado con crecimiento B2B.',
    ...(index % 6 === 4 ? {} : { owner: EXPANDED_OWNERS[index % EXPANDED_OWNERS.length] }),
  })),
  owners: EXPANDED_OWNERS,
  groups: [
    { id: 'expanded-generate', label: 'Generar oportunidades', initiativeIds: ['expanded-1', 'expanded-2', 'expanded-8', 'expanded-9', 'expanded-10', 'expanded-11'], rationale: 'La propuesta agrupa trabajo de captación, partners y generación de demanda.' },
    { id: 'expanded-work', label: 'Trabajar oportunidades', initiativeIds: ['expanded-6', 'expanded-12', 'expanded-13', 'expanded-14', 'expanded-20', 'expanded-21'], rationale: 'La propuesta agrupa trabajo de cualificación, seguimiento y operación comercial.' },
    { id: 'expanded-convert', label: 'Convertir oportunidades', initiativeIds: ['expanded-3', 'expanded-5', 'expanded-15', 'expanded-16', 'expanded-18', 'expanded-24'], rationale: 'La propuesta agrupa trabajo de pricing, contratación y conversión.' },
    { id: 'expanded-retain', label: 'Sostener crecimiento', initiativeIds: ['expanded-4', 'expanded-7', 'expanded-17', 'expanded-19', 'expanded-22', 'expanded-23'], rationale: 'La propuesta agrupa trabajo de prueba social, onboarding y expansión.' },
  ],
  signals: NOVAGROWTH_READING.signals,
};

export function analyzeNovaGrowth(_goalInput: string, _workInput: string): FirstValueReading {
  return _workInput.includes('NovaGrowthExpanded') ? NOVAGROWTH_EXPANDED_READING : NOVAGROWTH_READING;
}
