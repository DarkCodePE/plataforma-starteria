import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AutofillProvider, useAutofillContext } from '../../context/AutofillContext';
import type { AutofillProposalDto } from '../../services/pdfAutofillService';
import { AutofillField } from '../../components/autofill/AutofillField';

/**
 * Integration-contract test for the Step0Page autofill wiring.
 *
 * A full Step0Page mount requires AppProvider (async data fetch),
 * PortfolioLeadContext, and a populated router param — heavy and flaky in
 * jsdom. Per the task brief we instead exercise the exact wrapping pattern
 * Step0Page uses for a representative field (`step0.initiativeTitle`),
 * against the REAL AutofillProvider/reducer (no context mock). This proves
 * that wrapping the local `Input` helper in `<AutofillField>` surfaces the
 * "Propuesto por IA" chip, the Confirmar action, and that confirming calls
 * back into `setField`-style `onChange`.
 */

// Force the feature flag on for these tests.
vi.mock('../../services/featureFlags', () => ({
  isEnabled: () => true,
  isPdfAutofillEnabled: () => true,
  isStepReasoningCopilotEnabled: () => false,
}));

// Stub the service so confirm/edit/discard don't issue real HTTP.
vi.mock('../../services/pdfAutofillService', async () => {
  const actual = await vi.importActual<
    typeof import('../../services/pdfAutofillService')
  >('../../services/pdfAutofillService');
  return {
    ...actual,
    confirmProposal: vi.fn().mockResolvedValue(undefined),
    editProposal: vi.fn().mockResolvedValue(undefined),
    discardProposal: vi.fn().mockResolvedValue(undefined),
    restoreProposal: vi.fn().mockResolvedValue(undefined),
    resolveConflict: vi.fn().mockResolvedValue(undefined),
  };
});

const INITIATIVE_ID = 'proj-1';

function makeDto(overrides: Partial<AutofillProposalDto> = {}): AutofillProposalDto {
  return {
    fieldPath: 'step0.initiativeTitle',
    proposedValue: 'Programa de retención de clientes',
    status: 'unconfirmed',
    provenance: {
      sourcePdfId: 'pdf-1',
      sourcePdfName: 'iniciativa.pdf',
      pageNumbers: [1],
      quotedExcerpt: 'Iniciativa: Programa de retención de clientes',
      confidenceScore: 0.91,
      confidenceBand: 'high',
    },
    confidenceScore: 0.91,
    confidenceBand: 'high',
    runId: 'run-1',
    ...overrides,
  };
}

// Seeds a proposal into the real context before rendering children.
function SeededHarness({
  proposal,
  children,
}: {
  proposal: AutofillProposalDto;
  children: React.ReactNode;
}) {
  const { dispatch } = useAutofillContext();
  React.useEffect(() => {
    dispatch({
      type: 'MERGE_FROM_RUN',
      initiativeId: INITIATIVE_ID,
      proposals: [proposal],
    });
  }, [dispatch, proposal]);
  return <>{children}</>;
}

// Mirrors Step0Page's local `Input` helper.
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

// Mirrors the exact Step0Page wrapping pattern for `initiativeTitle`.
function renderWrappedField(proposal: AutofillProposalDto) {
  const setField = vi.fn();
  const value = '';
  const utils = render(
    <AutofillProvider>
      <SeededHarness proposal={proposal}>
        <AutofillField
          fieldPath="step0.initiativeTitle"
          initiativeId={INITIATIVE_ID}
          value={value}
          onChange={(v) => setField('initiativeTitle', v as string)}
          label="¿Como se llama tu iniciativa?"
        >
          {({ value: v, onChange, readOnly }) => (
            <Input
              aria-label="initiativeTitle-input"
              value={v as string}
              onChange={(e) => onChange(e.target.value)}
              readOnly={readOnly}
            />
          )}
        </AutofillField>
      </SeededHarness>
    </AutofillProvider>,
  );
  return { ...utils, setField };
}

describe('Step0Page autofill wiring — initiativeTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces the "Propuesto por IA" chip and the Confirmar action', async () => {
    renderWrappedField(makeDto());

    expect(await screen.findByText('Propuesto por IA')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Confirmar/i })).toBeInTheDocument();

    // The wrapper exposes the data-attribute QA scrapes.
    const wrapper = screen.getByLabelText(/Valor propuesto por inteligencia artificial/i);
    expect(wrapper.getAttribute('data-autofill-state')).toBe('ai-proposed-unconfirmed');
  });

  it('shows the proposed value in the field and locks it until confirmed', async () => {
    renderWrappedField(makeDto());

    const input = (await screen.findByLabelText('initiativeTitle-input')) as HTMLInputElement;
    expect(input.value).toBe('Programa de retención de clientes');
    expect(input.readOnly).toBe(true);
  });

  it('confirming calls through to setField with the proposed value', async () => {
    const { setField } = renderWrappedField(makeDto());

    const confirm = await screen.findByRole('button', { name: /Confirmar/i });
    fireEvent.click(confirm);

    await new Promise((r) => setTimeout(r, 0));
    expect(setField).toHaveBeenCalledWith(
      'initiativeTitle',
      'Programa de retención de clientes',
    );
  });
});
