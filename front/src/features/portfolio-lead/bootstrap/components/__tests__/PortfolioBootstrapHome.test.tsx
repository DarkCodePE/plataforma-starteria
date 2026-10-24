import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../../tests/setup-jsdom';

const suggestObjective = vi.hoisted(() => vi.fn());

vi.mock('../../services/portfolioObjectiveCopilotClient', () => ({
  suggestPortfolioObjective: (...args: unknown[]) => suggestObjective(...args),
}));

import { PortfolioBootstrapHome } from '../PortfolioBootstrapHome';
import { makeBootstrap, makeBootstrapWithProposedMutations, makeBootstrapWithWorkItems } from '../../testing/bootstrapFixtures';

function props(overrides = {}) {
  return {
    data: makeBootstrap('anchor_insufficient'),
    status: 'ready' as const,
    error: null,
    onRetry: vi.fn(),
    onUpdateAnchor: vi.fn().mockResolvedValue(undefined),
    onConfirmAnchor: vi.fn().mockResolvedValue(undefined),
    onPasteWorkItems: vi.fn().mockResolvedValue(undefined),
    onUploadImportFile: vi.fn().mockResolvedValue(undefined),
    onCommitImportBatch: vi.fn().mockResolvedValue(undefined),
    onAddManualWorkItem: vi.fn().mockResolvedValue(undefined),
    onDeclareNoExistingWork: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkItem: vi.fn().mockResolvedValue(undefined),
    onRemoveWorkItem: vi.fn().mockResolvedValue(undefined),
    onAnalyzeWorkItems: vi.fn().mockResolvedValue(undefined),
    onConfirmProposedMutation: vi.fn().mockResolvedValue(undefined),
    onReopenProposedMutationReview: vi.fn().mockResolvedValue(undefined),
    onCorrectProposedMutation: vi.fn().mockResolvedValue(undefined),
    onRejectProposedMutation: vi.fn().mockResolvedValue(undefined),
    onLeaveProposedMutationPending: vi.fn().mockResolvedValue(undefined),
    onPublishFirstReading: vi.fn().mockResolvedValue(undefined),
    analysisStatus: 'idle' as const,
    analysisError: null,
    publishStatus: 'idle' as const,
    publishError: null,
    importStatus: 'idle' as const,
    importError: null,
    activeImport: null,
    ...overrides,
  };
}

describe('PortfolioBootstrapHome — frozen Copilot-first composition', () => {
  beforeEach(() => {
    server.use(http.get('/api/v1/portfolio/challenges/:challengeId/activation-briefs', () => HttpResponse.json({ success: true, data: [] })));
  });
  it('makes the conversation and seven-stage progress panel the primary PL-00 workspace', () => {
    render(<PortfolioBootstrapHome {...props()} />);

    expect(screen.getByTestId('portfolio-bootstrap-home-a')).toHaveAttribute('data-frozen-composition', 'copilot-first');
    expect(screen.getByText('Configurar con Copilot · 1 de 7')).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Conversación con Copilot' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Tu avance' })).toBeInTheDocument();
    expect(screen.getByText('¿Qué quieres lograr con Startería?')).toBeInTheDocument();
    expect(screen.getByLabelText('Tu respuesta al Copilot')).toBeInTheDocument();
    expect(screen.queryByText('Resultado de negocio por definir')).not.toBeInTheDocument();
    for (const stage of ['Contexto', 'Objetivo', 'Incorporación', 'Análisis', 'Organización', 'Briefs', 'Asignación']) {
      expect(screen.getByText(stage, { exact: true })).toBeInTheDocument();
    }
  });

  it('starts a newly created front at 1 of 7 with shared organization context as an unconfirmed reference', () => {
    const data = makeBootstrap('anchor_insufficient');
    data.bootstrapSession.id = 'new-front-session';
    data.bootstrapSession.bootstrapPhase = 'B1_ANCHOR';
    data.anchor!.contextSummary = null;
    data.anchor!.outcomeStatement = 'Reducir abandono';
    data.anchor!.confirmedBy = null;
    data.anchor!.confirmedAt = null;
    data.anchor!.sourceRefs = {
      organizationalContextReference: {
        sourceBootstrapSessionId: 'completed-front-session',
        contextSummary: 'Customer success y producto comparten el contexto confirmado.',
        outcomeStatement: 'Reducir abandono',
        reviewStatus: 'reference_only',
      },
    };

    render(<PortfolioBootstrapHome {...props({ data })} />);

    expect(screen.getByText('Configurar con Copilot · 1 de 7')).toBeInTheDocument();
    expect(screen.getByText('Contexto organizacional de referencia')).toBeInTheDocument();
    expect(screen.getByText('Customer success y producto comparten el contexto confirmado.')).toBeInTheDocument();
    expect(screen.getByText(/aún no está confirmado para este frente/i)).toBeInTheDocument();
    expect(screen.queryByText('Revisado o completado')).not.toBeInTheDocument();
  });

  it('does not let local stage navigation fabricate progress beyond the persisted scope', () => {
    const data = makeBootstrap('anchor_insufficient');
    data.bootstrapSession.id = 'new-front-session';
    data.bootstrapSession.bootstrapPhase = 'B1_ANCHOR';
    data.anchor!.contextSummary = null;
    data.anchor!.confirmedBy = null;
    data.anchor!.confirmedAt = null;
    const input = props({ data });

    render(<PortfolioBootstrapHome {...input} />);

    const futureStage = screen.getByRole('button', { name: /Incorporación/i });
    fireEvent.click(futureStage);

    expect(futureStage).toBeDisabled();
    expect(screen.getByText('Configurar con Copilot · 1 de 7')).toBeInTheDocument();
    expect(screen.queryByText('Revisado o completado')).not.toBeInTheDocument();
    expect(input.onUpdateAnchor).not.toHaveBeenCalled();
    expect(input.onConfirmAnchor).not.toHaveBeenCalled();
  });

  it('resumes an existing draft at its persisted 3 of 7 progress', () => {
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrap('anchor_confirmed') })} />);

    expect(screen.getByText('Configurar con Copilot · 3 de 7')).toBeInTheDocument();
    expect(screen.getAllByText('Revisado o completado')).toHaveLength(2);
  });

  it('persists PL-00 external context as a declared provisional source', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapHome {...props({ onUpdateAnchor: save })} />);

    fireEvent.change(screen.getByLabelText('Tu respuesta al Copilot'), { target: { value: 'Decisión previa: revisar abandono en clientes nuevos.' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar la conversación/i }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      contextSummary: 'Decisión previa: revisar abandono en clientes nuevos.',
      sourceRefs: expect.objectContaining({
        externalContext: expect.objectContaining({
          kind: 'external_decision_brief_prompt',
          disposition: 'user_declared_source',
          reviewStatus: 'provisional',
        }),
      }),
    })));
  });

  it('keeps the objective in multi-turn chat and records AI provenance only after incorporation', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    suggestObjective.mockResolvedValueOnce({
      suggestedValue: 'Reducir el abandono durante el onboarding B2B.',
      rationale: 'Hace explícito el resultado sin proponer una solución.',
      confidence: 0.72,
    });
    const data = makeBootstrap('anchor_insufficient');
    data.anchor!.contextSummary = 'Customer success detecta abandono durante la activación.';
    data.anchor!.outcomeStatement = 'Resultado de negocio por definir';
    render(<PortfolioBootstrapHome {...props({ data, onUpdateAnchor: save })} />);

    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'bajar abandono' } });
    fireEvent.click(screen.getByRole('button', { name: /Ayúdame a redactar/i }));
    expect(await screen.findByTestId('portfolio-objective-ai-suggestion')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Usar sugerencia editable/i }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar respuesta/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      outcomeStatement: 'Reducir el abandono durante el onboarding B2B.',
      sourceRefs: expect.objectContaining({ objectiveConversation: expect.objectContaining({ disposition: 'ai_suggested' }) }),
    })));
  });

  it('keeps Briefs as the next boundary and does not advance to Assignment', () => {
    const navigate = vi.fn();
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrapWithProposedMutations(), onNavigate: navigate })} />);

    fireEvent.click(screen.getByRole('button', { name: /Briefs/i }));
    expect(screen.getByText('Confirma primero la estructura estratégica')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7 Asignación/i })).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('interprets a sufficient answer once, updates the draft and asks a different next question', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const data = makeBootstrap('anchor_insufficient');
    data.anchor!.contextSummary = 'El abandono durante activación afecta el negocio.';
    data.anchor!.outcomeStatement = 'Resultado de negocio por definir';
    render(<PortfolioBootstrapHome {...props({ data, onUpdateAnchor: save })} />);

    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'Reducir el abandono durante la activación de nuevos clientes.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ outcomeStatement: 'Reducir el abandono durante la activación de nuevos clientes.' })));
    expect(screen.getByText('Reducir el abandono durante la activación de nuevos clientes.')).toBeInTheDocument();
    expect(screen.getByText('¿Qué te gustaría poder decidir mejor cuando tengas más claridad sobre este objetivo?')).toBeInTheDocument();
    expect(screen.getByText(/He actualizado el borrador con tu respuesta/i)).toBeInTheDocument();
  });

  it('asks a targeted clarification for an ambiguous conversion signal instead of repeating the signal question', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const data = makeBootstrap('anchor_insufficient');
    Object.assign(data.anchor!, {
      contextSummary: 'La captación pierde valor en el paso comercial.',
      outcomeStatement: 'Mejorar la conversión comercial.',
      decisionToEnable: 'Decidir qué etapa priorizar.',
      businessSignalValue: null,
    });
    render(<PortfolioBootstrapHome {...props({ data, onUpdateAnchor: save })} />);

    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'usuarios que van de lead a cliente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    expect(await screen.findByText('Entiendo que quieres observar la conversión de leads a clientes. ¿Te interesa seguir el número de conversiones o el porcentaje de leads que convierte?')).toBeInTheDocument();
    expect(screen.queryByText('¿Cómo sabrás que el resultado está mejorando? Si no lo sabes todavía, también está bien.')).not.toBeInTheDocument();
  });

  it('records an explicit unknown and continues without inventing a value', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const data = makeBootstrap('anchor_insufficient');
    data.anchor!.contextSummary = 'Hay presión comercial este trimestre.';
    data.anchor!.outcomeStatement = 'Resultado de negocio por definir';
    render(<PortfolioBootstrapHome {...props({ data, onUpdateAnchor: save })} />);

    fireEvent.click(screen.getByRole('button', { name: 'No lo sé todavía' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ sourceRefs: expect.objectContaining({ objectiveConversation: expect.objectContaining({ disposition: 'unknown', unknownFields: ['outcomeStatement'] }) }) })));
    expect(screen.getByText('¿Qué te gustaría poder decidir mejor cuando tengas más claridad sobre este objetivo?')).toBeInTheDocument();
    expect(screen.getByText(/Aún no conocemos el resultado de negocio/i)).toBeInTheDocument();
  });

  it('reframes an irrelevant answer and makes a duplicate retry idempotent', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const data = makeBootstrap('anchor_insufficient');
    data.anchor!.contextSummary = 'Necesitamos entender el abandono de clientes.';
    data.anchor!.outcomeStatement = 'Resultado de negocio por definir';
    render(<PortfolioBootstrapHome {...props({ data, onUpdateAnchor: save })} />);

    const answer = screen.getByLabelText('Tu respuesta');
    fireEvent.change(answer, { target: { value: 'Mi color favorito es azul.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/no parece describir resultado esperado/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps exactly one process-progress panel and one current objective draft', () => {
    const data = makeBootstrap('anchor_insufficient');
    data.anchor!.contextSummary = 'El equipo necesita recuperar crecimiento rentable.';
    render(<PortfolioBootstrapHome {...props({ data })} />);

    expect(screen.getAllByLabelText('Tu avance')).toHaveLength(1);
    expect(screen.getAllByTestId('portfolio-objective-card')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Borrador del objetivo' })).toBeInTheDocument();
    expect(screen.queryByText('Ficha provisional del objetivo de negocio')).not.toBeInTheDocument();
  });

  it('explains confident file mappings before exposing mapping controls', () => {
    const batch = {
      id: 'batch-1', bootstrapSessionId: 'bs-1', fileName: 'iniciativas.csv', fileType: 'text/csv', fileSize: 42, fileHash: 'hash', status: 'ready_to_import' as const,
      rowCount: 8, sheetName: null, rawHeaders: ['Nombre', 'Responsable', 'Estado', 'Objetivo', 'KPI', 'Notas', 'Evidencia', 'Fuente'],
      confirmedMapping: null, suggestedMapping: { label: 'Nombre', owner: 'Responsable', state: 'Estado', purpose: 'Objetivo', signal: 'KPI', notes: 'Notas' },
      previewRows: [{ rowNumber: 2, rawRow: { Nombre: 'Onboarding', Responsable: 'Ana', Estado: 'En progreso', Objetivo: 'Reducir abandono', KPI: 'Conversión', Notas: 'Prioridad', Evidencia: 'entrevista', Fuente: 'Excel' } }],
      warnings: [], uploadedBy: 'user-1', createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z',
    };
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrap('anchor_confirmed'), activeImport: batch })} />);

    fireEvent.click(screen.getByRole('button', { name: /Subir PDF, Excel o CSV/i }));
    expect(screen.getByTestId('portfolio-import-mapping-summary')).toHaveTextContent('Así interpretamos tu archivo');
    expect(screen.getByText('Nombre ← Nombre')).toBeInTheDocument();
    expect(screen.queryByLabelText('Revisar mapeo de columnas')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar mapeo' }));
    expect(screen.getByLabelText('Revisar mapeo de columnas')).toBeInTheDocument();
  });

  it('makes detected initiatives the intake focus and collapses further intake options', () => {
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrapWithWorkItems() })} />);

    expect(screen.getAllByText('1 iniciativas detectadas')).toHaveLength(2);
    expect(screen.queryByLabelText('Tu respuesta al Copilot')).not.toBeInTheDocument();
    expect(screen.queryByText('Pegar una lista')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analizar 1 iniciativas' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar más información' }));
    expect(screen.getByText('Pegar una lista')).toBeInTheDocument();
  });

  it('shows a mapped source status instead of claiming it was undeclared when normalization is unavailable', () => {
    const data = makeBootstrapWithWorkItems();
    data.workItems[0] = {
      ...data.workItems[0], sourceType: 'imported_file', currentStateHint: 'unknown',
      sourceRefs: { importBatchId: 'batch-1', rawRow: { Nombre: 'Nuevo onboarding digital', Estado: 'En progreso', Evidencia: 'Entrevistas' }, sourceRefs: { rawState: 'En progreso' } },
    };
    data.importBatches = [{
      id: 'batch-1', bootstrapSessionId: 'bs-1', fileName: 'iniciativas.csv', fileType: 'text/csv', fileSize: 1, fileHash: 'hash', status: 'imported', rowCount: 1, sheetName: null,
      rawHeaders: ['Nombre', 'Estado', 'Evidencia'], confirmedMapping: { label: 'Nombre', state: 'Estado' }, suggestedMapping: {}, previewRows: [], warnings: [], uploadedBy: 'user-1', createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z',
    }];
    render(<PortfolioBootstrapHome {...props({ data })} />);

    expect(screen.getByText(/En progreso \(estado importado; pendiente de normalizar\)/)).toBeInTheDocument();
    expect(screen.queryByText('Estado no declarado')).not.toBeInTheDocument();
  });

  it('opens analysis review after analysis and keeps every proposal under a human disposition', async () => {
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrapWithProposedMutations() })} />);

    expect(await screen.findByTestId('portfolio-bootstrap-material-review')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-analysis-summary')).toHaveTextContent('Iniciativas detectadas');
    expect(screen.getByText('Startería encontró…')).toBeInTheDocument();
    expect(screen.queryByText(/Gaps e incógnitas/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver análisis' })[0]);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Datos observados / extraídos');
    expect(screen.getByRole('dialog')).toHaveTextContent('Fuente y trazabilidad');
    expect(screen.getByRole('dialog')).toHaveTextContent('Interpretación provisional — no decisión');
    expect(screen.getByRole('dialog')).toHaveTextContent('Qué falta validar');
    expect(screen.getAllByRole('button', { name: /Confirmar vínculo revisado|Confirmar revisión/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Corregir' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Dejar pendiente / sin vincular' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Marcar para comparar' }).length).toBeGreaterThan(0);
  });

  it('recovers from a confirmed-link miss-click by reopening a separate review', async () => {
    const data = makeBootstrapWithProposedMutations();
    data.proposedMutations[0] = { ...data.proposedMutations[0], status: 'confirmed' };
    const reopen = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapHome {...props({ data, onReopenProposedMutationReview: reopen })} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver análisis' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Vínculo confirmado');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar vínculo' }));
    await waitFor(() => expect(reopen).toHaveBeenCalledWith(data.proposedMutations[0].id));
  });

  it('filters compact initiative cards from an explainable analysis category', () => {
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrapWithProposedMutations() })} />);

    fireEvent.click(screen.getByTestId('portfolio-analysis-category-relation'));
    expect(screen.getByText('Mostrando iniciativas: relación estratégica por revisar.')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-analysis-initiative-cards')).toBeInTheDocument();
  });

  it('keeps PL-02 import details on demand while PL-03 makes the analysis surface primary', () => {
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrapWithProposedMutations() })} />);

    expect(screen.getByTestId('portfolio-analysis-input-reference')).toHaveTextContent('1 iniciativas incorporadas');
    expect(screen.queryByTestId('portfolio-detected-initiatives-summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Pegar una lista')).not.toBeInTheDocument();
    const importDisclosure = screen.getByText('Ver importación').closest('details');
    expect(importDisclosure).not.toHaveAttribute('open');
  });

  it('allows soft pending reviews to continue to Organization without losing the review surface', () => {
    render(<PortfolioBootstrapHome {...props({ data: makeBootstrapWithProposedMutations() })} />);

    expect(screen.getByTestId('portfolio-analysis-completion-gate')).toHaveTextContent('Lectura suficiente para continuar');
    const continueButton = screen.getByRole('button', { name: 'Continuar a organización' });
    expect(continueButton).toBeEnabled();
    expect(screen.getByRole('button', { name: /5 Organización/i })).toBeEnabled();
    fireEvent.click(continueButton);
    expect(screen.getByTestId('portfolio-organization-proposal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /4 Análisis/i }));
    expect(screen.getByTestId('portfolio-bootstrap-material-review')).toBeInTheDocument();
  });

  it('blocks Organization only for an explicit hard blocker and explains the gate', () => {
    const data = makeBootstrapWithProposedMutations();
    data.proposedMutations[1] = {
      ...data.proposedMutations[1],
      proposedValue: { ...(data.proposedMutations[1].proposedValue as Record<string, unknown>), severity: 'blocking' },
    };
    render(<PortfolioBootstrapHome {...props({ data })} />);

    const gate = screen.getByTestId('portfolio-analysis-completion-gate');
    expect(gate).toHaveTextContent('Hay un bloqueo real antes de organizar');
    expect(gate).toHaveTextContent('HARD_BLOCKING_NOW');
    expect(gate).toHaveTextContent('Evidencia o señal de negocio');
    expect(gate).toHaveTextContent('Falta una senal de negocio observable para decidir siguiente paso.');
    expect(gate).toHaveTextContent('Bloquea porque afecta la decisión de organización actual.');
    expect(screen.getByRole('button', { name: 'Continuar a organización' })).toBeDisabled();
    const organizationStage = screen.getByRole('button', { name: /5 Organización/i });
    expect(organizationStage).toBeDisabled();
    expect(screen.getByRole('button', { name: /6 Briefs/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /7 Asignación/i })).toBeDisabled();
    fireEvent.click(organizationStage);
    expect(screen.queryByTestId('portfolio-organization-proposal')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-bootstrap-material-review')).toBeInTheDocument();
  });

  it('keeps a fully confirmed initiative in PL-03 with history review and a live Organization exit', async () => {
    const data = makeBootstrapWithProposedMutations();
    data.proposedMutations = data.proposedMutations.map((mutation) => ({
      ...mutation,
      status: 'confirmed',
      reviewedBy: 'user-1',
      reviewedAt: '2026-09-14T10:03:00.000Z',
    }));
    render(<PortfolioBootstrapHome {...props({ data })} />);

    fireEvent.click(screen.getByRole('button', { name: /Análisis Revisado/i }));
    expect(screen.getByTestId('portfolio-analysis-input-reference')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-bootstrap-material-review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver análisis' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Vínculo confirmado');
    expect(screen.getByRole('button', { name: 'Revisar vínculo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a organización' }));
    expect(screen.getByTestId('portfolio-organization-proposal')).toBeInTheDocument();
  });

  it('reviews and confirms a typed PL-04 proposal inside Copilot, then stops at the PL-05 boundary', async () => {
    const navigate = vi.fn();
    const saveOrganizationProposal = vi.fn()
      .mockResolvedValueOnce({
        id: 'proposal-1', version: 2, status: 'reviewed', sourceVersion: 'source-1', materialization: null,
      })
      .mockResolvedValueOnce({
        id: 'proposal-1', version: 3, status: 'reviewed', sourceVersion: 'source-1', materialization: null,
      });
    const confirmOrganizationProposal = vi.fn().mockResolvedValue({
      id: 'proposal-1', version: 3, status: 'materialized', sourceVersion: 'source-1',
      materialization: {
        id: 'materialization-1',
        canonicalMappings: {
          fronts: [{ candidateId: 'front-1', canonicalId: 'canonical-front-1' }],
          challenges: [{ candidateId: 'challenge-1', canonicalId: 'canonical-challenge-1' }],
        },
      },
    });
    const organizationProposal = {
      id: 'proposal-1',
      version: 1,
      status: 'reviewed',
      sourceVersion: 'source-1',
      materialization: null,
      payload: {
        summary: 'Startería propone esta organización a partir de las 8 iniciativas revisadas.',
        fronts: [{
          candidateId: 'front-1',
          name: 'Activación y adopción sostenible',
          focus: 'Reducir el abandono y aumentar la adopción durante la activación.',
          rationale: 'Estas iniciativas persiguen el mismo resultado de negocio y necesitan decisiones coordinadas.',
          coverage: '6 de 8 iniciativas revisadas',
          challenges: [{
            candidateId: 'challenge-1',
            title: 'Entender y reducir la fricción de activación',
            problem: 'No sabemos qué fricciones explican el abandono durante las primeras semanas.',
            rationale: 'Agrupa iniciativas que buscan aclarar y reducir las mismas barreras de adopción.',
            relatedInitiativeIds: ['work-1', 'work-2', 'work-3', 'work-4', 'work-5', 'work-6'],
            evidence: ['El abandono aparece en la activación.'],
            gaps: ['Falta comparar cohortes.'],
            overlaps: ['Iniciativa 1 se solapa con Iniciativa 2 en la medición de activación.'],
          }],
        }],
        crossCuttingInitiativeIds: [],
        outsideObjectiveInitiativeIds: ['work-7'],
        ungroupedInitiativeIds: ['work-8'],
      },
    };
    const data = makeBootstrapWithProposedMutations();
    const maturity = ['idea', 'candidate', 'active', 'paused', 'completed', 'unknown', 'candidate', 'idea'] as const;
    data.workItems = Array.from({ length: 8 }, (_, index) => ({
      ...data.workItems[0], id: `work-${index + 1}`, rawLabel: `Iniciativa ${index + 1}`,
      proposedName: `Iniciativa ${index + 1}`,
      currentStateHint: maturity[index],
      ownerCandidate: index === 0 ? 'Ana Portfolio' : null,
      sourceType: index === 0 ? 'manual_entry' as const : 'pasted_text' as const,
    }));
    data.strategicConnections = [{
      id: 'connection-work-1', bootstrapSessionId: data.bootstrapSession.id, workItemId: 'work-1',
      anchorId: data.anchor!.id, sourceMutationId: 'pm-work-1', status: 'confirmed_alignment',
      rationale: 'Contribuye directamente al resultado de activación.', provenanceStatus: 'user_confirmed',
      sourceRefs: { source: 'material-review' }, confirmedBy: 'user-1', confirmedAt: '2026-09-14T10:03:00.000Z',
      createdAt: '2026-09-14T10:03:00.000Z', updatedAt: '2026-09-14T10:03:00.000Z',
    }];
    render(<PortfolioBootstrapHome {...props({
      data,
      onNavigate: navigate,
      organizationProposal,
      onSaveOrganizationProposal: saveOrganizationProposal,
      onConfirmOrganizationProposal: confirmOrganizationProposal,
    }) as any} />);

    fireEvent.click(screen.getByRole('button', { name: /5 Organización/i }));
    expect(screen.getByTestId('portfolio-organization-proposal')).toBeInTheDocument();
    expect(screen.getByText('Startería propone esta organización a partir de las 8 iniciativas revisadas.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Define la estructura estratégica del objetivo' })).toBeInTheDocument();
    expect(screen.getByText('Aquí estás definiendo la estructura estratégica con la que darás seguimiento al objetivo.')).toBeInTheDocument();
    expect(screen.getByText('Frente estratégico')).toBeInTheDocument();
    expect(screen.getByText('El resultado de negocio que quieres mover.')).toBeInTheDocument();
    expect(screen.getByText('Reto')).toBeInTheDocument();
    expect(screen.getByText(/El problema o foco principal/i)).toBeInTheDocument();
    expect(screen.getByText('Iniciativas')).toBeInTheDocument();
    expect(screen.getByText(/Los trabajos existentes que aportan/i)).toBeInTheDocument();
    expect(screen.getByText('FRENTE ESTRATÉGICO PROPUESTO')).toBeInTheDocument();
    expect(screen.getByText('RETO PROPUESTO')).toBeInTheDocument();
    expect(screen.getByText('INICIATIVAS EN ESTE RETO')).toBeInTheDocument();
    expect(screen.getByText('Dentro de este frente Startería identificó 1 reto principal.')).toBeInTheDocument();
    expect(screen.getByText(/Las iniciativas parecen concentrarse en un único problema principal/i)).toBeInTheDocument();
    expect(screen.getByTestId('front-challenge-transition')).toHaveTextContent('Objetivo → Frente estratégico → Reto → Iniciativas');
    expect(screen.queryByText('FRONT CANDIDATE')).not.toBeInTheDocument();
    expect(screen.queryByText('CHALLENGE CANDIDATE')).not.toBeInTheDocument();
    expect(screen.getByText(/6 de 8 iniciativas revisadas/)).toBeInTheDocument();
    expect(screen.getAllByText('Comparar con Iniciativa 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No implica una duplicidad confirmada/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Posible solapamiento dentro de este reto')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fuera del objetivo actual' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin agrupar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Apoyo transversal' })).toBeInTheDocument();
    expect(screen.queryByText(/Comparte lenguaje material con Portfolio Anchor/i)).not.toBeInTheDocument();
    expect(screen.getByText('¿Qué aporta organizar estas iniciativas?')).toBeInTheDocument();
    expect(screen.getByText(/comparar iniciativas que atacan el mismo problema/i)).toBeInTheDocument();
    expect(screen.getByText(/detectar posibles solapamientos/i)).toBeInTheDocument();
    expect(screen.getByText(/ver cobertura y gaps/i)).toBeInTheDocument();
    expect(screen.getByText(/priorizar dónde dedicar atención y capacidad/i)).toBeInTheDocument();
    expect(screen.getByText(/preparar decisiones de Portfolio/i)).toBeInTheDocument();
    expect(screen.getByText('Sin organizar')).toBeInTheDocument();
    expect(screen.getByText('Con organización')).toBeInTheDocument();
    expect(screen.getByText(/Las iniciativas siguen disponibles individualmente y no se pierde información/i)).toBeInTheDocument();
    expect(screen.getByText(/Puedes volver a organizarlas más adelante/i)).toBeInTheDocument();
    expect(screen.queryByText('REVISAR UBICACIÓN DE INICIATIVAS')).not.toBeInTheDocument();
    expect(screen.getByText('Reto 1')).toBeInTheDocument();
    expect(screen.getByText('6 iniciativas')).toBeInTheDocument();
    expect(screen.getByText(/Problema o incertidumbre/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Decisión que ayuda a tomar/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Mover Iniciativa 1' })).toBeInTheDocument();
    const initiativeInsight = screen.getByTestId('organization-initiative-work-1');
    expect(initiativeInsight).toHaveTextContent('Relación directa con el objetivo');
    expect(initiativeInsight).toHaveTextContent('Etapa documental estimada: Diseño / formulación');
    expect(initiativeInsight).toHaveTextContent('Estimación basada en la información disponible. No significa que el Step esté aprobado.');
    expect(initiativeInsight).toHaveTextContent('Procedencia: Registro manual');
    expect(initiativeInsight).toHaveTextContent('Responsable actual según fuente: Ana Portfolio');
    expect(initiativeInsight).toHaveTextContent('Comparar con Iniciativa 2');
    expect(screen.getAllByText('Relación por validar').length).toBeGreaterThan(0);
    expect(screen.getByTestId('organization-initiative-work-6')).toHaveTextContent('Etapa no determinada');
    expect(screen.queryByText('Evidencia relevante')).not.toBeInTheDocument();
    expect(screen.getByText('Información pendiente que se conserva')).toBeInTheDocument();
    expect(screen.getByText(/Falta comparar cohortes/)).toBeInTheDocument();
    expect(screen.getByText('Resumen del reto')).toBeInTheDocument();
    expect(screen.getByText(/6 iniciativas · 1 directas/i)).toBeInTheDocument();
    expect(screen.getByText(/1 comparación específica/i)).toBeInTheDocument();
    expect(screen.getByText(/0 vacíos críticos/i)).toBeInTheDocument();
    expect(screen.getByText('Estructura estratégica lista para confirmar')).toBeInTheDocument();
    expect(screen.getByText('1 frente')).toBeInTheDocument();
    expect(screen.getByText('1 reto')).toBeInTheDocument();
    expect(screen.getByText('6 alineadas')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Revisar propuesta: Entender y reducir la fricción de activación' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Entender y reducir la fricción de activación' }));
    expect(screen.getByRole('dialog', { name: 'Revisar propuesta de reto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entender por qué Startería lo propone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar reto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Añadir otro reto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Separar en dos retos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Combinar con otro reto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar este reto de la propuesta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No estoy de acuerdo con esta propuesta' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Entender por qué Startería lo propone' }));
    expect(screen.getByRole('heading', { name: 'Por qué Startería propone este reto' })).toBeInTheDocument();
    expect(screen.getByText(/patrón detectado/i)).toBeInTheDocument();
    expect(screen.getByText(/Iniciativa 1, Iniciativa 2/i)).toBeInTheDocument();
    expect(screen.getByText('Evidencia disponible')).toBeInTheDocument();
    expect(screen.getByText('El abandono aparece en la activación.')).toBeInTheDocument();
    expect(screen.getByText('Procedencia')).toBeInTheDocument();
    expect(screen.getByText('Vacíos relevantes')).toBeInTheDocument();
    expect(screen.getAllByText(/Falta comparar cohortes/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/por qué tratarlo como un reto separado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a opciones de revisión' }));

    fireEvent.click(screen.getByRole('button', { name: 'Editar reto' }));
    fireEvent.change(screen.getByLabelText('Nombre del reto'), { target: { value: 'Reducir las barreras de activación' } });
    fireEvent.change(screen.getByLabelText('Problema o incertidumbre del reto'), { target: { value: 'La activación se interrumpe antes de producir valor.' } });
    fireEvent.change(screen.getByLabelText('Decisión que ayuda a tomar'), { target: { value: 'Qué barrera de activación atender primero.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambios al reto' }));
    expect(screen.queryByRole('dialog', { name: 'Revisar propuesta de reto' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reducir las barreras de activación' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Reducir las barreras de activación' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir otro reto' }));
    fireEvent.change(screen.getByLabelText('Nombre del nuevo reto'), { target: { value: 'Validar señales de adopción' } });
    fireEvent.change(screen.getByLabelText('Problema o incertidumbre del nuevo reto'), { target: { value: 'No sabemos qué señal anticipa una adopción sostenida.' } });
    fireEvent.change(screen.getByLabelText('Decisión que ayudaría a tomar'), { target: { value: 'Qué señal usar para priorizar seguimiento.' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Relacionar Iniciativa 6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir reto a la propuesta' }));
    expect(screen.getByRole('heading', { name: 'Validar señales de adopción' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Validar señales de adopción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Combinar con otro reto' }));
    fireEvent.change(screen.getByLabelText('Reto con el que combinar'), { target: { value: 'challenge-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Combinar retos' }));
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Mover Iniciativa 6' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Reducir las barreras de activación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Separar en dos retos' }));
    expect(screen.getByRole('dialog', { name: 'Revisar separación del reto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Cuándo puede tener sentido separar este reto?' })).toBeInTheDocument();
    expect(screen.getByText(/No necesitas crear más retos por completar estructura/i)).toBeInTheDocument();
    expect(screen.getByText(/requieren decisiones diferentes/i)).toBeInTheDocument();
    expect(screen.getByText(/una parte puede avanzar independientemente de la otra/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer una separación' }));
    expect(screen.getByText(/Vista previa: las 6 iniciativas quedarían repartidas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar / volver sin cambios' }));
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Reducir las barreras de activación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Separar en dos retos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear segundo reto' }));
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Revisar propuesta: .*segunda hipótesis/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar este reto de la propuesta' }));
    expect(screen.getByRole('heading', { name: 'Quitar reto de la propuesta' })).toBeInTheDocument();
    expect(screen.getByText(/No se borrará ninguna iniciativa/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Mantener iniciativas sin agrupar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar reto' }));
    expect(screen.getAllByRole('button', { name: /^Revisar propuesta:/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Sin agrupar' }).closest('section')).toHaveTextContent('Iniciativa 4');
    expect(screen.getByRole('heading', { name: 'Sin agrupar' }).closest('section')).toHaveTextContent('Iniciativa 6');

    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Reducir las barreras de activación' }));
    fireEvent.click(screen.getByRole('button', { name: 'No estoy de acuerdo con esta propuesta' }));
    expect(screen.getByRole('radio', { name: 'El problema planteado no es correcto.' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hay más de un problema.' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Estas iniciativas no deberían estar juntas.' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Falta un reto que Startería no detectó.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Prefiero no organizar todavía.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mantener todo sin organizar' }));
    expect(screen.getByRole('heading', { name: 'Has decidido no organizar todavía' })).toBeInTheDocument();
    expect(screen.getAllByText(/No se pierde información/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Sin agrupar' }).closest('section')).toHaveTextContent('8 iniciativas');
    expect(screen.getByRole('button', { name: 'Volver a revisar una organización' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver a revisar una organización' }));
    fireEvent.change(screen.getByLabelText('Nombre del frente estratégico'), { target: { value: 'Adopción inicial sostenible' } });
    fireEvent.click(screen.getByRole('button', { name: /Revisar propuesta:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar reto' }));
    fireEvent.change(screen.getByLabelText('Nombre del reto'), { target: { value: 'Reducir las barreras de activación' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar cambios al reto' }));
    for (const initiativeNumber of [4, 5, 6]) {
      fireEvent.click(screen.getByRole('button', { name: `Mover Iniciativa ${initiativeNumber}` }));
      fireEvent.change(screen.getByLabelText(`Nuevo destino para Iniciativa ${initiativeNumber}`), { target: { value: 'challenge-1' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Mover Iniciativa 1' }));
    const firstDestination = screen.getByLabelText('Nuevo destino para Iniciativa 1');
    expect(firstDestination).toHaveTextContent('Reto 1 · Reducir las barreras de activación');
    expect(firstDestination).toHaveTextContent('Apoyo transversal');
    expect(firstDestination).toHaveTextContent('Sin agrupar');
    expect(firstDestination).toHaveTextContent('Fuera del objetivo actual');
    fireEvent.change(firstDestination, { target: { value: 'outside' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mover Iniciativa 2' }));
    fireEvent.change(screen.getByLabelText('Nuevo destino para Iniciativa 2'), { target: { value: 'ungrouped' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mover Iniciativa 3' }));
    fireEvent.change(screen.getByLabelText('Nuevo destino para Iniciativa 3'), { target: { value: 'cross-cutting' } });
    expect(screen.getByRole('heading', { name: 'Lista para revisión final' })).toBeInTheDocument();
    expect(screen.getByText(/Tienes cambios sin guardar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar después' }));
    await waitFor(() => expect(saveOrganizationProposal).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      payload: expect.objectContaining({ fronts: [expect.objectContaining({
        name: 'Adopción inicial sostenible',
        challenges: [expect.objectContaining({ title: 'Reducir las barreras de activación' })],
      })],
      crossCuttingInitiativeIds: ['work-3'],
      outsideObjectiveInitiativeIds: ['work-7', 'work-1'],
      ungroupedInitiativeIds: ['work-8', 'work-2'],
      }),
    })));

    expect(screen.getByRole('heading', { name: 'Estructura estratégica lista para confirmar' })).toBeInTheDocument();
    expect(screen.getByText('Revisión guardada. Ya puedes confirmar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Nombre del frente estratégico'), { target: { value: 'Adopción final confirmada' } });
    expect(screen.getByRole('heading', { name: 'Lista para revisión final' })).toBeInTheDocument();

    expect(screen.getByTestId('organization-confirmation-summary')).toHaveTextContent('Objetivo → Frente estratégico → Reto → Iniciativas');
    expect(screen.getByText(/Confirmar refleja esta estructura en Portfolio/i)).toBeInTheDocument();
    expect(screen.getByText(/No inicia iniciativas, no asigna equipos y no activa Steps/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar estructura estratégica' }));
    await waitFor(() => expect(saveOrganizationProposal).toHaveBeenLastCalledWith(expect.objectContaining({
      version: 2,
      payload: expect.objectContaining({ fronts: [expect.objectContaining({ name: 'Adopción final confirmada' })] }),
    })));
    await waitFor(() => expect(confirmOrganizationProposal).toHaveBeenCalledWith(expect.objectContaining({ version: 3 })));
    expect((await screen.findAllByText('PL-05 · Briefs')).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/La organización confirmada ya está reflejada en Portfolio/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Configurar con Copilot · 6 de 7/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reducir las barreras de activación' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no preparaste un Brief para este reto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparar primer Brief' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Preparar primer Brief' }));
    expect(await screen.findByRole('heading', { name: 'Prepara el Brief que recibirá tu equipo' })).toBeInTheDocument();
    expect(screen.getAllByText(/Estás revisando una propuesta sin guardar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lo que Startería ya recuperó/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps all-ungrouped work distinct from an explicit opt-out and allows an empty manual challenge', () => {
    const data = makeBootstrapWithProposedMutations();
    const workItemIds = data.workItems.map((item) => item.id);
    const organizationProposal = {
      id: 'proposal-ungrouped', version: 1, status: 'reviewed', sourceVersion: 'source-ungrouped', materialization: null,
      payload: {
        summary: 'Propuesta abierta para organizar más adelante.',
        fronts: [{
          candidateId: 'front-ungrouped', name: 'Adopción sostenible', focus: 'Mejorar la adopción.', rationale: 'Permite comparar decisiones.', coverage: `0 de ${workItemIds.length}`,
          challenges: [{ candidateId: 'challenge-empty', title: 'Hipótesis por revisar', problem: 'El problema todavía no está delimitado.', rationale: 'Conviene mantener la hipótesis visible.', relatedInitiativeIds: [], evidence: [], gaps: [], overlaps: [] }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: workItemIds,
      },
    };
    render(<PortfolioBootstrapHome {...props({ data, organizationProposal, onSaveOrganizationProposal: vi.fn(), onConfirmOrganizationProposal: vi.fn() }) as any} />);

    fireEvent.click(screen.getByRole('button', { name: /5 Organización/i }));
    expect(screen.queryByRole('heading', { name: 'Has decidido no organizar todavía' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hipótesis por revisar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Hipótesis por revisar' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Añadir otro reto' }));
    fireEvent.change(screen.getByLabelText('Nombre del nuevo reto'), { target: { value: 'Reto manual sin iniciativas' } });
    fireEvent.change(screen.getByLabelText('Problema o incertidumbre del nuevo reto'), { target: { value: 'Falta delimitar una segunda incertidumbre.' } });
    fireEvent.change(screen.getByLabelText('Decisión que ayudaría a tomar'), { target: { value: 'Decidir si merece investigación propia.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir reto a la propuesta' }));

    const emptyChallenge = screen.getByRole('heading', { name: 'Reto manual sin iniciativas' }).closest('section');
    expect(emptyChallenge).toHaveTextContent('0 iniciativas');
    expect(emptyChallenge).toHaveTextContent('Este reto no tiene iniciativas');
    expect(screen.queryByRole('heading', { name: 'Has decidido no organizar todavía' })).not.toBeInTheDocument();
  });

  it('explains that removing the only challenge pauses organization before applying it', () => {
    const data = makeBootstrapWithProposedMutations();
    const workItemIds = data.workItems.map((item) => item.id);
    const confirmOrganizationProposal = vi.fn();
    const organizationProposal = {
      id: 'proposal-only-challenge', version: 1, status: 'reviewed', sourceVersion: 'source-only', materialization: null,
      payload: {
        summary: 'Startería propone una organización revisable.',
        fronts: [{
          candidateId: 'front-only', name: 'Adopción sostenible', focus: 'Mejorar la adopción.', rationale: 'Permite comparar decisiones.', coverage: `1 de ${workItemIds.length}`,
          challenges: [{ candidateId: 'challenge-only', title: 'Único reto', problem: 'Existe una incertidumbre.', rationale: 'Ayuda a decidir.', relatedInitiativeIds: workItemIds.slice(0, 1), evidence: [], gaps: [], overlaps: [] }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: workItemIds.slice(1),
      },
    };
    render(<PortfolioBootstrapHome {...props({ data, organizationProposal, onSaveOrganizationProposal: vi.fn(), onConfirmOrganizationProposal: confirmOrganizationProposal }) as any} />);

    fireEvent.click(screen.getByRole('button', { name: /5 Organización/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar propuesta: Único reto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar este reto de la propuesta' }));
    expect(screen.getByText(/Es el único reto de la propuesta/i)).toBeInTheDocument();
    expect(screen.getByText(/la organización quedará pausada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Mantener iniciativas sin agrupar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar reto y dejar todo sin organizar' }));

    expect(screen.getByRole('heading', { name: 'Has decidido no organizar todavía' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin agrupar' }).closest('section')).toHaveTextContent(`${workItemIds.length} iniciativa`);
    expect(screen.getByRole('button', { name: 'Confirmar estructura estratégica' })).toBeDisabled();
    expect(confirmOrganizationProposal).not.toHaveBeenCalled();
  });

  it('locks provisional mutations while confirmation persists its captured review', async () => {
    const data = makeBootstrapWithProposedMutations();
    const workItemIds = data.workItems.map((item) => item.id);
    let resolveSave!: (value: any) => void;
    const saveOrganizationProposal = vi.fn(() => new Promise((resolve) => { resolveSave = resolve; }));
    const confirmOrganizationProposal = vi.fn().mockResolvedValue({
      id: 'proposal-lock', version: 2, status: 'materialized', sourceVersion: 'source-lock',
      materialization: { id: 'materialization-lock', canonicalMappings: { fronts: [], challenges: [] } },
    });
    const organizationProposal = {
      id: 'proposal-lock', version: 1, status: 'reviewed', sourceVersion: 'source-lock', materialization: null,
      payload: {
        summary: 'Startería propone una organización revisable.',
        fronts: [{
          candidateId: 'front-lock', name: 'Nombre inicial', focus: 'Mejorar la adopción.', rationale: 'Permite comparar decisiones.', coverage: `1 de ${workItemIds.length}`,
          challenges: [{ candidateId: 'challenge-lock', title: 'Reto estable', problem: 'Existe una incertidumbre.', rationale: 'Ayuda a decidir.', relatedInitiativeIds: workItemIds.slice(0, 1), evidence: [], gaps: [], overlaps: [] }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: workItemIds.slice(1),
      },
    };
    render(<PortfolioBootstrapHome {...props({ data, organizationProposal, onSaveOrganizationProposal: saveOrganizationProposal, onConfirmOrganizationProposal: confirmOrganizationProposal }) as any} />);

    fireEvent.click(screen.getByRole('button', { name: /5 Organización/i }));
    fireEvent.click(screen.getByText('Editar frente estratégico'));
    const nameInput = screen.getByLabelText('Nombre del frente estratégico');
    fireEvent.change(nameInput, { target: { value: 'Versión capturada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar estructura estratégica' }));

    expect(saveOrganizationProposal).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ fronts: [expect.objectContaining({ name: 'Versión capturada' })] }),
    }));
    expect(nameInput).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Revisar propuesta: Reto estable' })).toBeDisabled();
    fireEvent.change(nameInput, { target: { value: 'Edición tardía' } });
    expect(saveOrganizationProposal).not.toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ fronts: [expect.objectContaining({ name: 'Edición tardía' })] }),
    }));

    resolveSave({ id: 'proposal-lock', version: 2, status: 'reviewed', sourceVersion: 'source-lock', materialization: null });
    await waitFor(() => expect(confirmOrganizationProposal).toHaveBeenCalledWith({ version: 2 }));
  });

  it('keeps multiple Briefs explicit and opens the exact selected Brief identity', async () => {
    const data = makeBootstrapWithProposedMutations();
    const organizationProposal = {
      id: 'proposal-multi-brief', version: 3, status: 'materialized', sourceVersion: 'source-multi-brief',
      payload: {
        summary: 'Organización confirmada.',
        fronts: [{
          candidateId: 'front-1', name: 'Activación sostenible', focus: 'Mejorar activación', rationale: 'Organiza el resultado.', coverage: '1 de 1',
          challenges: [{ candidateId: 'challenge-1', title: 'Reducir fricción', problem: 'Existe fricción.', rationale: 'Permite decidir.', relatedInitiativeIds: ['work-1'], evidence: [], gaps: [], overlaps: [] }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [],
      },
      materialization: {
        id: 'materialization-multi-brief',
        canonicalMappings: {
          fronts: [{ candidateId: 'front-1', canonicalId: 'canonical-front-1' }],
          challenges: [{ candidateId: 'challenge-1', canonicalId: 'canonical-challenge-1' }],
        },
      },
    };
    const version = (id: string, versionNumber: number, status: 'DRAFT' | 'CONFIRMED', intent: string) => ({
      id, versionNumber, status, intent, scope: `${intent} scope`, strategicContextRefs: {},
      inheritedContext: { expectedDeliverable: `${intent} deliverable`, decisionToEnable: `${intent} decision`, horizon: null },
      constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {}, createdAt: '2026-10-22T00:00:00.000Z', confirmedAt: status === 'CONFIRMED' ? '2026-10-22T01:00:00.000Z' : null,
    });
    const briefA = { id: 'brief-a', challengeId: 'canonical-challenge-1', organizationId: 'org-1', versions: [version('version-a', 5, 'CONFIRMED', 'Mandato A confirmado')] };
    let briefB = { id: 'brief-b', challengeId: 'canonical-challenge-1', organizationId: 'org-1', versions: [version('version-b', 1, 'DRAFT', 'Mandato B en revisión')] };
    server.use(
      http.get('/api/v1/portfolio/challenges/canonical-challenge-1/activation-briefs', () => HttpResponse.json({ success: true, data: [briefB, briefA] })),
      http.get('/api/v1/portfolio/challenges/canonical-challenge-1/handoff-assignments', () => HttpResponse.json({ success: true, data: [] })),
      http.get('/api/v1/portfolio/challenges/canonical-challenge-1/assignable-initiatives', () => HttpResponse.json({ success: true, data: { canonicalInitiatives: [], importedRecords: [] } })),
      http.get('/api/v1/portfolio/activation-briefs/brief-a', () => HttpResponse.json({ success: true, data: briefA })),
      http.get('/api/v1/portfolio/activation-briefs/brief-b', () => HttpResponse.json({ success: true, data: briefB })),
      http.post('/api/v1/portfolio/activation-brief-versions/version-b/confirm', () => {
        briefB = { ...briefB, versions: [{ ...briefB.versions[0], status: 'CONFIRMED', confirmedAt: '2026-10-22T02:00:00.000Z' }] };
        return HttpResponse.json({ success: true, data: { version: briefB.versions[0], idempotent: false } });
      }),
    );

    render(<PortfolioBootstrapHome {...props({ data, organizationProposal }) as any} />);

    expect(await screen.findByText('2 Briefs · 1 confirmado · 1 borrador')).toBeInTheDocument();
    expect(screen.getByText('Mandato A confirmado')).toBeInTheDocument();
    expect(screen.getByText('Mandato B en revisión')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Brief: Mandato A confirmado' }));
    expect(await screen.findByTestId('challenge-activation-brief-panel')).toHaveAttribute('data-brief-id', 'brief-a');
    expect(screen.getAllByText(/Versión 5.*Confirmada/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Brief: Mandato B en revisión' }));
    expect(await screen.findByTestId('challenge-activation-brief-panel')).toHaveAttribute('data-brief-id', 'brief-b');
    expect(screen.getAllByText(/Versión 1.*Borrador/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar esta versión' }));
    expect(await screen.findByText('2 Briefs · 2 confirmados · 0 borradores')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Brief: Mandato A confirmado' }));
    expect(await screen.findByTestId('challenge-activation-brief-panel')).toHaveAttribute('data-brief-id', 'brief-a');
    expect(screen.getAllByText(/Versión 5.*Confirmada/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Preparar nuevo Brief' })).toBeEnabled();
    expect(screen.getByText('Brief confirmado')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listo para preparar la asignación' })).toBeInTheDocument();
    const assignmentStage = screen.getByRole('button', { name: /7 Asignación/i });
    expect(assignmentStage).toBeDisabled();
    expect(assignmentStage).toHaveTextContent('Disponible al continuar desde una versión de Brief confirmada');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a asignación' }));
    expect(await screen.findByRole('heading', { name: 'Asigna responsables para abordar este reto' })).toBeInTheDocument();
    expect(screen.getByTestId('pl06a-assignment-preparation')).toHaveAttribute('data-brief-version-id', 'version-a');
    expect(screen.getByRole('button', { name: /7 Asignación/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /enviar|aceptar|rechazar|iniciar/i })).not.toBeInTheDocument();
  });

  it('lets a materialized organization enter Briefs even when the historical analysis still reports a hard blocker', async () => {
    const data = makeBootstrapWithProposedMutations();
    data.proposedMutations[1] = {
      ...data.proposedMutations[1],
      proposedValue: { ...(data.proposedMutations[1].proposedValue as Record<string, unknown>), severity: 'blocking' },
    };
    const organizationProposal = {
      id: 'proposal-materialized', version: 3, status: 'materialized', sourceVersion: 'source-3',
      payload: {
        summary: 'Organización confirmada.',
        fronts: [{
          candidateId: 'front-1', name: 'Activación sostenible', focus: 'Mejorar activación', rationale: 'Organiza el resultado.', coverage: '1 de 1',
          challenges: [{ candidateId: 'challenge-1', title: 'Reducir fricción', problem: 'Existe fricción.', rationale: 'Permite decidir.', relatedInitiativeIds: ['work-1'], evidence: [], gaps: [], overlaps: [] }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [],
      },
      materialization: {
        id: 'materialization-1',
        canonicalMappings: {
          fronts: [{ candidateId: 'front-1', canonicalId: 'canonical-front-1' }],
          challenges: [{ candidateId: 'challenge-1', canonicalId: 'canonical-challenge-1' }],
        },
      },
    };

    render(<PortfolioBootstrapHome {...props({ data, organizationProposal }) as any} />);

    expect(await screen.findByText(/Configurar con Copilot · 6 de 7/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reducir fricción' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparar primer Brief' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /6 Briefs/i })).toBeEnabled();
  });

  it('keeps an explicit Assignment deep link on stage seven when the materialized proposal hydrates', async () => {
    const data = makeBootstrapWithProposedMutations();
    const organizationProposal = {
      id: 'proposal-deep-link', version: 1, status: 'materialized', sourceVersion: 'source-deep-link',
      payload: {
        summary: 'Organización confirmada.',
        fronts: [{
          candidateId: 'front-1', name: 'Activación sostenible', focus: 'Mejorar activación', rationale: 'Organiza el resultado.', coverage: '1 de 1',
          challenges: [{ candidateId: 'challenge-1', title: 'Reducir fricción', problem: 'Existe fricción.', rationale: 'Permite decidir.', relatedInitiativeIds: [], evidence: [], gaps: [], overlaps: [] }],
        }],
        crossCuttingInitiativeIds: [], outsideObjectiveInitiativeIds: [], ungroupedInitiativeIds: [],
      },
      materialization: {
        id: 'materialization-deep-link',
        canonicalMappings: {
          fronts: [{ candidateId: 'front-1', canonicalId: 'canonical-front-1' }],
          challenges: [{ candidateId: 'challenge-1', canonicalId: 'canonical-challenge-1' }],
        },
      },
    };
    const brief = {
      id: 'brief-deep-link', challengeId: 'canonical-challenge-1', organizationId: 'org-1',
      versions: [{ id: 'version-deep-link', versionNumber: 1, status: 'CONFIRMED', intent: 'Validar el encargo', scope: 'Scope confirmado', strategicContextRefs: {}, inheritedContext: {}, constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {}, createdAt: '2026-10-24T00:00:00.000Z', confirmedAt: '2026-10-24T00:01:00.000Z' }],
    };
    server.use(
      http.get('/api/v1/portfolio/activation-briefs/brief-deep-link', () => HttpResponse.json({ success: true, data: brief })),
      http.get('/api/v1/portfolio/challenges/canonical-challenge-1/handoff-assignments', () => HttpResponse.json({ success: true, data: [] })),
      http.get('/api/v1/portfolio/challenges/canonical-challenge-1/assignable-initiatives', () => HttpResponse.json({ success: true, data: { canonicalInitiatives: [], importedRecords: [] } })),
    );

    render(<PortfolioBootstrapHome {...props({
      data,
      organizationProposal,
      initialAssignmentTarget: { challengeId: 'canonical-challenge-1', challengeName: 'Reducir fricción', briefId: 'brief-deep-link', briefVersionId: 'version-deep-link' },
    }) as any} />);

    expect(await screen.findByTestId('pl06a-assignment-preparation')).toHaveAttribute('data-brief-version-id', 'version-deep-link');
    expect(screen.getByText('Configurar con Copilot · 7 de 7')).toBeInTheDocument();
  });
});
