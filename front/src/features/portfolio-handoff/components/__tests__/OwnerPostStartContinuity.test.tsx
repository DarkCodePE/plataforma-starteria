import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OwnerPostStartContinuity } from '../OwnerPostStartContinuity';
import type { HandoffOwnerContinuity } from '../../services/handoffInvitationService';

const briefVersion = {
  id: 'brief-version-7',
  versionNumber: 7,
  status: 'CONFIRMED' as const,
  intent: 'Reducir la friccion de activacion',
  scope: 'Primeros siete dias',
};

const base = {
  assignmentId: 'assignment-1',
  challengeId: 'challenge-1',
  challenge: { id: 'challenge-1', title: 'Reducir la friccion de activacion' },
  contextNote: 'Contrastar primero la friccion observada.',
  briefVersion,
  handoffState: 'STARTED' as const,
};

describe('KAN-178 Owner post-Start continuity', () => {
  it('offers the existing Overview without jumping to a Step', () => {
    const onOpenWorkspace = vi.fn();
    const continuity: HandoffOwnerContinuity = {
      ...base,
      outcome: 'EXISTING_READY',
      targetKind: 'EXISTING_INITIATIVE',
      initiativeId: 'project-1',
      project: {
        id: 'project-1', name: 'Onboarding guiado', organizationId: 'org-1', status: 'IN_PROGRESS',
        currentStep: 2, isArchived: false, activationStatus: 'OWNER_CONFIRMED',
        retrospectiveAssessmentStatus: 'ASSESSED', stepCount: 4, operationalStep: 2, activeCheckpointStep: 2,
        workspacePath: '/projects/project-1',
      },
    };

    render(<OwnerPostStartContinuity continuity={continuity} onOpenWorkspace={onOpenWorkspace} />);
    expect(screen.getByRole('heading', { name: /continÃºa tu iniciativa/i })).toBeInTheDocument();
    expect(screen.getByText('Onboarding guiado')).toBeInTheDocument();
    expect(screen.getByText(/estado real.*Step 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /abrir overview/i }));
    expect(onOpenWorkspace).toHaveBeenCalledWith('/projects/project-1');
  });

  it('explains activation pending and does not offer an operational route', () => {
    const continuity: HandoffOwnerContinuity = {
      ...base,
      outcome: 'EXISTING_ACTIVATION_REQUIRED',
      targetKind: 'EXISTING_INITIATIVE',
      initiativeId: 'project-1',
      reasons: ['OPERATIONAL_ACCESS_REQUIRED', 'OWNER_ACTIVATION_REQUIRED', 'STEPS_NOT_MATERIALIZED', 'OPERATIONAL_STATE_UNRESOLVED'],
      project: {
        id: 'project-1', name: 'Iniciativa ADR-009', organizationId: 'org-1', status: 'DRAFT',
        currentStep: 0, isArchived: false, activationStatus: 'OWNER_PENDING',
        retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT', stepCount: 0, operationalStep: null, activeCheckpointStep: null,
      },
    };

    render(<OwnerPostStartContinuity continuity={continuity} onOpenWorkspace={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /necesita activaciÃ³n/i })).toBeInTheDocument();
    expect(screen.getByText(/todavÃ­a no tiene Steps persistidos/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /abrir overview/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 0 creado/i)).not.toBeInTheDocument();
  });

  it('keeps a Challenge connected to its exact Brief without creating an Initiative', () => {
    const continuity: HandoffOwnerContinuity = {
      ...base,
      outcome: 'CHALLENGE_FORMULATION_REQUIRED',
      targetKind: 'CHALLENGE',
      initiativeId: null,
    };

    render(<OwnerPostStartContinuity continuity={continuity} onOpenWorkspace={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /formula una iniciativa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reducir la friccion de activacion' })).toBeInTheDocument();
    expect(screen.getByText(/Brief confirmado Â· versiÃ³n 7/i)).toBeInTheDocument();
    expect(screen.getByText(/no ha creado una iniciativa ni Steps/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear iniciativa/i })).not.toBeInTheDocument();
  });

  it('shows a closed access result without a Portfolio Home escape', () => {
    render(<OwnerPostStartContinuity continuity={{ outcome: 'ACCESS_DENIED', assignmentId: 'assignment-1' }} onOpenWorkspace={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos validar tu acceso/i);
    expect(screen.queryByText(/portafolio/i)).not.toBeInTheDocument();
  });
});

