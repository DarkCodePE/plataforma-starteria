import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const navigate = vi.fn();
let params: Record<string, string> = { reviewId: 'rev1' };
vi.mock('react-router', () => ({
  useParams: () => params,
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

const companies = [
  {
    id: 'co1',
    name: 'Unimaq',
    sector: 'Maquinaria',
    country: 'Peru',
    scope: 'PERSONAL',
    status: 'ACTIVE',
    versions: [{ id: 'v1', versionNumber: 1, contextScore: 98, contextLevel: 'SOLID' }],
    areas: [{ id: 'area1', name: 'Servicios Offsite' }, { id: 'area2', name: 'Administracion' }],
    sources: [],
  },
  {
    id: 'co2',
    name: 'Starteria Org',
    sector: 'Innovacion',
    country: 'Peru',
    scope: 'ORGANIZATION',
    status: 'ACTIVE',
    versions: [{ id: 'v2', versionNumber: 1, contextScore: 81, contextLevel: 'SOLID' }],
    areas: [],
    sources: [],
  },
];

const companyService = {
  listCompanies: vi.fn(),
  createCompany: vi.fn(),
  createArea: vi.fn(),
  getCompanyScore: vi.fn(),
};
vi.mock('../../../app/services/companyService', () => ({
  listCompanies: () => companyService.listCompanies(),
  createCompany: (payload: unknown) => companyService.createCompany(payload),
  createArea: (companyId: string, payload: unknown) => companyService.createArea(companyId, payload),
  getCompanyScore: (companyId: string) => companyService.getCompanyScore(companyId),
}));

const client = {
  getReview: vi.fn(),
  createReview: vi.fn(),
  addContext: vi.fn(),
  addDocument: vi.fn(),
  saveStrategicAnswers: vi.fn(),
  confirmRoute: vi.fn(),
};
vi.mock('../services/initiativeReviewClient', () => ({
  getReview: (id: string) => client.getReview(id),
  createReview: (t: string, ctx?: string[], companyContext?: { companyId: string; areaId?: string } | null, handoffAssignmentId?: string) => handoffAssignmentId
    ? client.createReview(t, ctx, companyContext, handoffAssignmentId)
    : client.createReview(t, ctx, companyContext),
  addContext: (id: string, context: string, focusSection?: string) => (focusSection ? client.addContext(id, context, focusSection) : client.addContext(id, context)),
  addDocument: (id: string, file: File) => client.addDocument(id, file),
  saveStrategicAnswers: (id: string, answers: Array<{ id: string; answer?: string; unknown?: boolean }>) => client.saveStrategicAnswers(id, answers),
  confirmRoute: (id: string) => client.confirmRoute(id),
}));

import { InitiativeReviewResultPage } from '../pages/InitiativeReviewResultPage';
import { InitiativeReviewStartPage } from '../pages/InitiativeReviewStartPage';

const SNAPSHOT = {
  id: 'snap1',
  version: 1,
  understandingSummary: 'Entiendo que quieres ordenar las compras.',
  suggestedChallengeType: 'correction',
  selectedChallengeType: 'correction',
  challengeTypeReason: 'Reduce una fricción existente.',
  informationReadiness: 'low',
  critique: { solid: 's', weak: 'w', risky: 'r', recommendedAdjustment: 'a', mainRisk: 'mr' },
  strategicQuestions: [
    { id: 'q1', question: '¿Dónde empezar?', options: ['Un área', 'Un proceso'], allowsUnknown: true, status: 'unanswered' },
  ],
  improvedProposal: { suggestedName: 'Optimización de compras', improvedDescription: 'd', initialFocus: 'f', expectedImpact: 'menos tiempo', nextRecommendedStep: 'Step 0' },
  routePreview: [0, 1, 2, 3, 4].map((n) => ({ step: n, name: `Step ${n}`, whatWillHappen: 'x', expectedOutput: 'y', status: n === 0 ? 'active' : 'locked' })),
};

describe('InitiativeReviewResultPage (IR-F1/F3)', () => {
  beforeEach(() => {
    navigate.mockReset();
    params = { reviewId: 'rev1' };
    // Estos tests validan el layout legacy (una columna). El chat es ON por defecto (IRC-07),
    // así que se fuerza OFF explícitamente.
    window.localStorage.setItem('starteria.initiativeReviewChat.enabled', 'false');
    client.getReview.mockReset().mockResolvedValue({ id: 'rev1', status: 'generated', originalInput: 'x', addedContext: [], challengeId: null, snapshot: SNAPSHOT });
    client.addContext.mockReset().mockResolvedValue({ id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['ctx'], challengeId: null, snapshot: { ...SNAPSHOT, id: 'snap2', version: 2 } });
    client.saveStrategicAnswers.mockReset().mockResolvedValue({
      id: 'rev1',
      status: 'updated',
      originalInput: 'x',
      addedContext: [],
      challengeId: null,
      snapshot: { ...SNAPSHOT, strategicQuestions: [{ ...SNAPSHOT.strategicQuestions[0], status: 'unknown' }] },
    });
    client.confirmRoute.mockReset().mockResolvedValue({ routeConfirmationId: 'rc1', initiativeId: 'proj1', overviewUrl: '/initiatives/proj1/overview' });
  });

  it('renderiza los 6 bloques, incl. understanding y challenge type', async () => {
    render(<InitiativeReviewResultPage />);
    expect(await screen.findByTestId('card-understanding')).toHaveTextContent('ordenar las compras');
    expect(screen.getByTestId('card-challenge-type')).toHaveTextContent('Corrección');
    for (const id of ['card-critique', 'card-questions', 'card-proposal', 'card-route']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('guarda respuestas estratégicas incluyendo No lo sé aún', async () => {
    render(<InitiativeReviewResultPage />);
    const unknown = await screen.findByRole('button', { name: /No lo sé aún/i });
    fireEvent.click(unknown);
    await waitFor(() => expect(client.saveStrategicAnswers).toHaveBeenCalledWith('rev1', [{ id: 'q1', unknown: true }]));
  });

  it('agrega contexto y regenera el snapshot via API real', async () => {
    render(<InitiativeReviewResultPage />);
    fireEvent.change(await screen.findByLabelText(/Agregar contexto antes de confirmar/i), { target: { value: 'Tenemos dos semanas.' } });
    fireEvent.click(screen.getByRole('button', { name: /Actualizar revisión/i }));
    await waitFor(() => expect(client.addContext).toHaveBeenCalledWith('rev1', 'Tenemos dos semanas.'));
  });

  it('el CTA confirma la ruta via API real y navega al Overview', async () => {
    render(<InitiativeReviewResultPage />);
    const cta = await screen.findByRole('button', { name: /Estoy de acuerdo con esta ruta/i });
    fireEvent.click(cta);
    await waitFor(() => expect(client.confirmRoute).toHaveBeenCalledWith('rev1'));
    expect(navigate).toHaveBeenCalledWith('/initiatives/proj1/overview');
  });
});

describe('InitiativeReviewResultPage — chat split layout (ADR-026, IRC-03)', () => {
  const FLAG_KEY = 'starteria.initiativeReviewChat.enabled';

  beforeEach(() => {
    navigate.mockReset();
    params = { reviewId: 'rev1' };
    client.getReview.mockReset().mockResolvedValue({ id: 'rev1', status: 'generated', originalInput: 'x', addedContext: [], challengeId: null, snapshot: SNAPSHOT });
    client.addContext.mockReset().mockResolvedValue({ id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['ctx'], challengeId: null, snapshot: { ...SNAPSHOT, id: 'snap2', version: 2 }, changedSections: ['critique'] });
    client.saveStrategicAnswers.mockReset().mockResolvedValue({ id: 'rev1', status: 'generated', originalInput: 'x', addedContext: [], challengeId: null, snapshot: SNAPSHOT, changedSections: ['questions'] });
    client.addDocument.mockReset().mockResolvedValue({ id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['doc'], challengeId: null, snapshot: { ...SNAPSHOT, version: 2 }, changedSections: ['understanding', 'critique'] });
    window.localStorage.removeItem(FLAG_KEY);
  });

  it('v2: el chat va a la IZQUIERDA (aparece antes que las cards en el DOM)', async () => {
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    const nodes = Array.from(document.querySelectorAll('[data-testid="assistant-panel"], [data-testid="card-understanding"]'));
    expect(nodes[0].getAttribute('data-testid')).toBe('assistant-panel'); // chat primero en el DOM = izquierda / arriba en móvil
  });

  it('v2: clic en "Refinar" enfoca la sección y un turno llama addContext con focusSection', async () => {
    render(<InitiativeReviewResultPage />);
    fireEvent.click(await screen.findByTestId('refine-critique'));
    // El chip "Refinando: Mirada crítica" aparece y el modo refine queda activo.
    expect(screen.getByTestId('refine-cancel')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'hazla más concreta' } });
    fireEvent.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(client.addContext).toHaveBeenCalledWith('rev1', 'hazla más concreta', 'critique'));
  });

  it('v2: "Refinar" no aparece en la card de ruta (no refinable)', async () => {
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('card-route');
    expect(screen.queryByTestId('refine-routePreview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refine-questions')).not.toBeInTheDocument();
  });

  it('v2: subir un documento llama addDocument y re-resalta las secciones cambiadas', async () => {
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    const file = new File(['contenido de reglas'], 'reglas.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('doc-input'), { target: { files: [file] } });
    await waitFor(() => expect(client.addDocument).toHaveBeenCalledWith('rev1', file));
    await waitFor(() => expect(screen.getByTestId('card-critique')).toHaveAttribute('data-highlighted', 'true'));
  });

  it('v2: un documento no soportado no llama addDocument (validación cliente)', async () => {
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    const bad = new File(['x'], 'foto.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('doc-input'), { target: { files: [bad] } });
    expect(client.addDocument).not.toHaveBeenCalled();
  });

  it('default (sin override, IRC-07): monta el asistente y oculta el textarea legacy', async () => {
    render(<InitiativeReviewResultPage />); // sin tocar el flag → ON por defecto
    await screen.findByTestId('card-understanding');
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Agregar contexto antes de confirmar/i)).not.toBeInTheDocument();
  });

  it('flag forzado a false: no monta el asistente y conserva el textarea de contexto', async () => {
    window.localStorage.setItem(FLAG_KEY, 'false');
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('card-understanding');
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Agregar contexto antes de confirmar/i)).toBeInTheDocument();
  });

  it('flag ON: monta el asistente a la derecha, conserva las cards y oculta el textarea', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('card-understanding');
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    // las cards de la iniciativa siguen presentes
    for (const id of ['card-understanding', 'card-challenge-type', 'card-critique', 'card-questions', 'card-proposal', 'card-route']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    // el textarea de contexto se reemplaza por el chat
    expect(screen.queryByLabelText(/Agregar contexto antes de confirmar/i)).not.toBeInTheDocument();
    // el CTA de confirmación sigue accesible
    expect(screen.getByRole('button', { name: /Estoy de acuerdo con esta ruta/i })).toBeInTheDocument();
  });

  it('flag ON: con pregunta activa, el modo por defecto responde → saveStrategicAnswers', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    render(<InitiativeReviewResultPage />);
    const input = await screen.findByTestId('assistant-input');
    fireEvent.change(input, { target: { value: 'Empezar por un área piloto' } });
    fireEvent.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(client.saveStrategicAnswers).toHaveBeenCalledWith('rev1', [{ id: 'q1', answer: 'Empezar por un área piloto' }]));
    expect(client.addContext).not.toHaveBeenCalled();
  });

  it('flag ON: cambiar a modo "Agregar contexto" → addContext', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    fireEvent.click(screen.getByTestId('chat-mode-context'));
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Tenemos 2 devs por 6 semanas.' } });
    fireEvent.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(client.addContext).toHaveBeenCalledWith('rev1', 'Tenemos 2 devs por 6 semanas.'));
    expect(client.saveStrategicAnswers).not.toHaveBeenCalled();
  });

  it('flag ON: modo "duda" responde en cliente sin llamar a la API', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    fireEvent.click(screen.getByTestId('chat-mode-doubt'));
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: '¿qué significa corrección?' } });
    fireEvent.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(screen.getByText(/arreglar algo que hoy no funciona bien/i)).toBeInTheDocument());
    expect(client.addContext).not.toHaveBeenCalled();
    expect(client.saveStrategicAnswers).not.toHaveBeenCalled();
  });

  it('flag ON (IRC-05): tras agregar contexto, resalta solo las secciones cambiadas y muestra la versión', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    client.addContext.mockResolvedValueOnce({
      id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['ctx'], challengeId: null,
      snapshot: { ...SNAPSHOT, version: 3 }, changedSections: ['critique', 'improvedProposal'],
    });
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    fireEvent.click(screen.getByTestId('chat-mode-context'));
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Validamos on-premise.' } });
    fireEvent.click(screen.getByTestId('assistant-send'));

    await waitFor(() => expect(screen.getByTestId('card-critique')).toHaveAttribute('data-highlighted', 'true'));
    expect(screen.getByTestId('card-proposal')).toHaveAttribute('data-highlighted', 'true');
    // secciones NO cambiadas no se resaltan
    expect(screen.getByTestId('card-understanding')).not.toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('card-route')).not.toHaveAttribute('data-highlighted');
    // la versión del snapshot se muestra
    expect(screen.getByTestId('snapshot-version')).toHaveTextContent('Versión 3');
  });

  it('flag ON (IRC-05): changedSections vacío no resalta ninguna card', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    client.addContext.mockResolvedValueOnce({
      id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['ctx'], challengeId: null,
      snapshot: { ...SNAPSHOT, version: 2 }, changedSections: [],
    });
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    fireEvent.click(screen.getByTestId('chat-mode-context'));
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'algo que no cambia nada' } });
    fireEvent.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(client.addContext).toHaveBeenCalled());
    for (const id of ['card-understanding', 'card-critique', 'card-proposal', 'card-route']) {
      expect(screen.getByTestId(id)).not.toHaveAttribute('data-highlighted');
    }
  });

  it('flag ON (IRC-06): confirmar la ruta desde el chat llama confirmRoute y emite telemetría', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    (window as any).dataLayer = [];
    client.confirmRoute.mockReset().mockResolvedValue({ initiativeId: 'init1', overviewUrl: '/initiatives/init1/overview' });
    render(<InitiativeReviewResultPage />);
    const confirm = await screen.findByTestId('chat-confirm-route');
    fireEvent.click(confirm);
    await waitFor(() => expect(client.confirmRoute).toHaveBeenCalledWith('rev1'));
    const events = ((window as any).dataLayer as Array<{ event: string }>).map((e) => e.event);
    expect(events).toContain('chat_confirm_route');
  });

  it('flag ON (IRC-06): un turno de contexto emite chat_message_sent, chat_context_added y snapshot_diff_announced', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    (window as any).dataLayer = [];
    client.addContext.mockResolvedValueOnce({
      id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['ctx'], challengeId: null,
      snapshot: { ...SNAPSHOT, version: 2 }, changedSections: ['critique'],
    });
    render(<InitiativeReviewResultPage />);
    await screen.findByTestId('assistant-panel');
    fireEvent.click(screen.getByTestId('chat-mode-context'));
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Tenemos 2 devs.' } });
    fireEvent.click(screen.getByTestId('assistant-send'));
    await waitFor(() => expect(client.addContext).toHaveBeenCalled());
    const events = ((window as any).dataLayer as Array<{ event: string }>).map((e) => e.event);
    expect(events).toContain('chat_message_sent');
    expect(events).toContain('chat_context_added');
    expect(events).toContain('snapshot_diff_announced');
  });

  it('flag ON: rehidrata el historial persistido (chatEvents) al montar', async () => {
    window.localStorage.setItem(FLAG_KEY, 'true');
    client.getReview.mockResolvedValueOnce({
      id: 'rev1', status: 'updated', originalInput: 'x', addedContext: ['LLM on-premise'], challengeId: null, snapshot: { ...SNAPSHOT, version: 2 },
      chatEvents: [
        { id: 'e1', role: 'user', kind: 'context', payload: { text: 'LLM on-premise' }, snapshotVersion: 2, createdAt: '2026-07-18T00:00:00Z' },
        { id: 'e2', role: 'assistant', kind: 'diff_announcement', payload: { changedSections: ['critique'] }, snapshotVersion: 2, createdAt: '2026-07-18T00:00:01Z' },
      ],
    });
    render(<InitiativeReviewResultPage />);
    expect(await screen.findByText('LLM on-premise')).toBeInTheDocument();
    expect(screen.getByText(/actualicé: Mirada crítica/i)).toBeInTheDocument();
  });
});

describe('InitiativeReviewStartPage (IR-F3)', () => {
  let co1Score = 54;

  beforeEach(() => {
    co1Score = 54;
    navigate.mockReset();
    client.createReview.mockReset().mockResolvedValue({ id: 'revNew', status: 'generated', originalInput: 'x', addedContext: [], challengeId: null, snapshot: SNAPSHOT });
    companyService.listCompanies.mockReset().mockResolvedValue(companies);
    companyService.createCompany.mockReset().mockResolvedValue({ ...companies[0], id: 'co-new', name: 'Nueva Empresa', versions: [{ id: 'vn', versionNumber: 1, contextScore: 0, contextLevel: 'INITIAL' }], areas: [] });
    companyService.createArea.mockReset().mockResolvedValue({ id: 'area-new', name: 'Prime' });
    companyService.getCompanyScore.mockReset().mockImplementation((companyId: string) => {
      if (companyId === 'co-new') {
        return Promise.reject(new Error('Contexto aún no evaluado'));
      }
      if (companyId === 'co2') {
        return Promise.resolve({
          score: 62,
          level: 'USEFUL',
          label: 'Contexto útil',
          missing: [],
          breakdown: { coverage: 35, evidence: 12, freshness: 15 },
        });
      }
      return Promise.resolve({
        score: co1Score,
        level: co1Score >= 60 ? 'USEFUL' : 'BASIC',
        label: co1Score >= 60 ? 'Contexto útil' : 'Contexto básico',
        missing: co1Score >= 60 ? [] : ['Cultura y apertura al cambio', 'Estructura y toma de decisiones', 'Políticas y validaciones internas'],
        breakdown: { coverage: co1Score >= 60 ? 37 : 28, evidence: co1Score >= 60 ? 11 : 8, freshness: 15 },
      });
    });
  });

  it('renderiza un composer unico y elimina el contexto adicional opcional', async () => {
    render(<InitiativeReviewStartPage />);
    expect(screen.getByTestId('initiative-composer')).toBeInTheDocument();
    expect(screen.queryByText(/Contexto adicional opcional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Contexto de empresa$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empresa o contexto/i })).toBeInTheDocument();
  });

  it('crea la revisión sin empresa y navega al Result', async () => {
    render(<InitiativeReviewStartPage />);
    fireEvent.change(screen.getByLabelText(/Describe tu iniciativa/i), { target: { value: 'Quiero mejorar el proceso de compras menores para reducir retrabajo operativo.' } });
    fireEvent.click(screen.getByRole('button', { name: /Revisar propuesta/i }));
    await waitFor(() => expect(client.createReview).toHaveBeenCalledWith('Quiero mejorar el proceso de compras menores para reducir retrabajo operativo.', [], null));
    expect(screen.getByText(/Puedes continuar sin empresa/i)).toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith('/initiatives/review/revNew');
  });

  it('no permite enviar con input demasiado corto', () => {
    render(<InitiativeReviewStartPage />);
    fireEvent.change(screen.getByLabelText(/Describe tu iniciativa/i), { target: { value: 'corto' } });
    expect(screen.getByRole('button', { name: /Revisar propuesta/i })).toBeDisabled();
  });

  it('permite buscar empresa, seleccionar empresa y area, y conserva companyId y areaId al enviar', async () => {
    render(<InitiativeReviewStartPage />);
    fireEvent.click(screen.getByRole('button', { name: /Empresa o contexto/i }));
    expect(await screen.findByText('Empresas recientes')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Buscar empresas/i), { target: { value: 'unimaq' } });
    fireEvent.click(await screen.findByRole('button', { name: /Unimaq/i }));
    fireEvent.click(screen.getByRole('button', { name: /Servicios Offsite/i }));
    expect(await screen.findByRole('button', { name: /Unimaq · Servicios Offsite · 54% · Contexto básico/i })).toBeInTheDocument();
    expect(screen.queryByText(/98%/i)).not.toBeInTheDocument();
    expect(screen.getByText(/¿Qué significa este porcentaje\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Este porcentaje refleja qué tan completo y confiable es el contexto disponible de la empresa/i)).toBeInTheDocument();
    expect(screen.getByText(/Con un contexto básico, ya existe una referencia inicial/i)).toBeInTheDocument();
    expect(screen.getByText(/Por confirmar o profundizar/i)).toBeInTheDocument();
    expect(screen.getByText(/Políticas y validaciones internas/i)).toBeInTheDocument();
    expect(screen.getByText(/Señales identificadas/i)).toBeInTheDocument();
    expect(screen.getByText(/Cobertura media, respaldo inicial y actualización alta/i)).toBeInTheDocument();
    expect(screen.queryByText(/No es avance del registro/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Describe tu iniciativa/i), { target: { value: 'Quiero mejorar el proceso de compras menores para reducir retrabajo operativo.' } });
    fireEvent.click(screen.getByRole('button', { name: /Revisar propuesta/i }));
    await waitFor(() => expect(client.createReview).toHaveBeenCalledWith(
      'Quiero mejorar el proceso de compras menores para reducir retrabajo operativo.',
      [],
      { companyId: 'co1', areaId: 'area1' },
    ));
  });

  it('crea una empresa desde el selector y queda seleccionada', async () => {
    render(<InitiativeReviewStartPage />);
    fireEvent.click(screen.getByRole('button', { name: /Empresa o contexto/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Agregar una empresa$/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Nombre de empresa/i), { target: { value: 'Nueva Empresa' } });
    fireEvent.change(within(dialog).getByLabelText(/^Sector$/i), { target: { value: 'Retail' } });
    fireEvent.change(within(dialog).getByLabelText(/País principal/i), { target: { value: 'Peru' } });
    expect(within(dialog).getByLabelText(/Tamaño de empresa/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Agregar una empresa/i }));
    await waitFor(() => expect(companyService.createCompany).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /Nueva Empresa · Contexto aún no evaluado/i })).toBeInTheDocument();
  });

  it('permite crear y seleccionar una nueva area', async () => {
    companyService.createArea.mockImplementation(async () => {
      co1Score = 64;
      return { id: 'area-new', name: 'Prime' };
    });
    render(<InitiativeReviewStartPage />);
    fireEvent.click(screen.getByRole('button', { name: /Empresa o contexto/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Unimaq/i }));
    fireEvent.change(screen.getByPlaceholderText(/Agregar área/i), { target: { value: 'Prime' } });
    fireEvent.click(screen.getByRole('button', { name: /^Agregar$/i }));
    await waitFor(() => expect(companyService.createArea).toHaveBeenCalledWith('co1', { name: 'Prime' }));
    expect(await screen.findByRole('button', { name: /Unimaq · Prime · 64% · Contexto útil/i })).toBeInTheDocument();
    expect(screen.queryByText(/Por confirmar o profundizar/i)).not.toBeInTheDocument();
  });

  it('sincroniza el porcentaje al cambiar de empresa', async () => {
    render(<InitiativeReviewStartPage />);
    fireEvent.click(screen.getByRole('button', { name: /Empresa o contexto/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Starteria Org/i }));
    expect(await screen.findByRole('button', { name: /Starteria Org · 62% · Contexto útil/i })).toBeInTheDocument();
    expect(screen.getAllByText(/62% · Contexto útil/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Por confirmar o profundizar/i)).not.toBeInTheDocument();
  });
});
