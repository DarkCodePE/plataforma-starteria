import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HandoffInvitationPage } from '../HandoffInvitationPage';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  claim: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(),
  start: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ isAuthenticated: true }) }));
vi.mock('../../../features/portfolio-handoff/services/handoffInvitationService', () => ({
  readHandoffInvitation: mocks.read,
  claimHandoffInvitation: mocks.claim,
  acceptHandoffAssignment: mocks.accept,
  rejectHandoffAssignment: mocks.reject,
  startAssignedWork: mocks.start,
  resolvePostStartContinuity: mocks.resolve,
  savePendingHandoffInvitation: vi.fn(),
}));

const accepted = {
  assignmentId: 'assignment-1', targetKind: 'EXISTING_INITIATIVE' as const, challengeId: 'challenge-1', initiativeId: 'project-1',
  briefVersion: null, state: 'ACCEPTED' as const, version: 3, rejectionReason: null, portfolioResponse: null,
  acceptedAt: '2026-10-24T08:05:00Z', rejectedAt: null, authenticationRequired: true, identityClaimStatus: 'MATCHED' as const,
};

const started = { ...accepted, state: 'STARTED' as const, version: 4 };
const ready = {
  outcome: 'EXISTING_READY' as const,
  assignmentId: 'assignment-1', targetKind: 'EXISTING_INITIATIVE' as const, challengeId: 'challenge-1', initiativeId: 'project-1',
  challenge: { id: 'challenge-1', title: 'Reto de activacion' }, contextNote: null, briefVersion: null, handoffState: 'STARTED' as const,
  project: { id: 'project-1', name: 'Onboarding guiado', organizationId: 'org-1', status: 'IN_PROGRESS', currentStep: 2, isArchived: false, activationStatus: 'OWNER_CONFIRMED' as const, retrospectiveAssessmentStatus: 'ASSESSED' as const, stepCount: 4, operationalStep: 2, activeCheckpointStep: 2, workspacePath: '/projects/project-1' },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/handoff/invitations/token-1']}>
      <Routes>
        <Route path="/handoff/invitations/:token" element={<HandoffInvitationPage />} />
        <Route path="/projects/:projectId" element={<div>WORKSPACE_REAL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('KAN-178 HandoffInvitationPage continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue(accepted);
    mocks.claim.mockResolvedValue(accepted);
    mocks.start.mockResolvedValue(started);
    mocks.resolve.mockResolvedValue(ready);
  });

  it('resolves after explicit Start and only navigates to the Overview after another human action', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Empezar' }));
    expect(mocks.start).toHaveBeenCalledWith('assignment-1', 3);
    expect(await screen.findByRole('heading', { name: /continúa tu iniciativa/i })).toBeInTheDocument();
    expect(screen.getByText(/los Steps existentes están disponibles/i)).toBeInTheDocument();
    expect(mocks.resolve).toHaveBeenCalledWith('assignment-1');
    expect(screen.queryByText('WORKSPACE_REAL')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /abrir overview/i }));
    expect(await screen.findByText('WORKSPACE_REAL')).toBeInTheDocument();
  });

  it('recovers the same continuity on re-entry without replaying Start', async () => {
    mocks.read.mockResolvedValue(started);
    mocks.claim.mockResolvedValue(started);
    renderPage();

    expect(await screen.findByRole('heading', { name: /continúa tu iniciativa/i })).toBeInTheDocument();
    await waitFor(() => expect(mocks.resolve).toHaveBeenCalledWith('assignment-1'));
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

