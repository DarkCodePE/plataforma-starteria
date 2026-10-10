import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StarteriaPathExperience } from '../StarteriaPathExperience';
import type { StarteriaPathDto, StarteriaPathSupportedDto } from '../starteriaPath.types';

const versions = {
  pathSchemaVersion: 'starteria-path-dto-v0.1',
  projectionVersion: 'starteria-path-projection-v0.1',
  businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
} as const;

function makeSupportedPath(overrides: Partial<StarteriaPathSupportedDto> = {}): StarteriaPathSupportedDto {
  return {
    experienceState: 'SUPPORTED',
    starteriaPathStatus: 'SUPPORTED',
    valueBridge: {
      currentState: 'Hay varias iniciativas y falta comparar la capacidad disponible.',
      starteriaContribution: [{
        statement: 'Starteria podría ordenar la información ya compartida alrededor de esta decisión.',
        capabilityClass: 'CAN_SUPPORT',
        availabilityState: 'REQUIRES_IMPLEMENTATION',
      }],
      tangibleOutcome: {
        statement: 'Una lectura estructurada que se pueda revisar.',
        observableArtifact: 'Vista de decisión con evidencia y dudas visibles.',
      },
      remainingDependency: [{
        statement: 'La organización debe confirmar la capacidad disponible.',
        dependencyType: 'REQUIRES_ORGANIZATIONAL_INPUT',
      }],
    },
    capabilityPath: [{
      capabilityType: 'MAKE_VISIBLE',
      statement: 'Hacer visibles juntas la evidencia disponible y las dudas abiertas.',
      whyRelevant: 'La comparación depende de qué información existe para cada iniciativa.',
    }],
    dependencies: [{
      dependencyType: 'REQUIRES_ORGANIZATIONAL_INPUT',
      statement: 'La organización debe confirmar la capacidad disponible.',
      whyItMatters: 'Sin ese dato no se puede valorar el espacio real para avanzar.',
    }],
    firstSupportedMovement: {
      movement: 'Revisar la evidencia que ya existe para cada iniciativa.',
      whyNow: 'La decisión depende de comparar lo que ya está disponible.',
      whatItMayClarify: 'Qué opciones cuentan con evidencia suficiente para conversar.',
      boundary: 'Esta revisión no decide cómo asignar capacidad.',
    },
    boundaryStatement: 'La lectura prepara una conversación; la decisión sigue en manos de la organización.',
    sourceBinding: {
      criticalHandoffId: 'handoff-1',
      criticalHandoffVersion: 3,
      sourceContextRevision: 7,
      current: true,
      confirmed: true,
      projectionVersion: 'starteria-path-projection-v0.1',
      businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
      pathSchemaVersion: 'starteria-path-dto-v0.1',
    },
    versions,
    ...overrides,
  };
}

function renderPath(path: StarteriaPathDto, onRetry = vi.fn()) {
  return { ...render(<StarteriaPathExperience requestState="ready" path={path} onRetry={onRetry} />), onRetry };
}

describe('StarteriaPathExperience', () => {
  it('renders a supported Path as a contextual sequence after the confirmed reading', () => {
    renderPath(makeSupportedPath());

    expect(screen.getByRole('heading', { name: 'Así puede ayudarte Starteria' })).toBeInTheDocument();
    expect(screen.getByText('Hay varias iniciativas y falta comparar la capacidad disponible.')).toBeInTheDocument();
    expect(screen.getByText('Starteria podría ordenar la información ya compartida alrededor de esta decisión.')).toBeInTheDocument();
    expect(screen.getByText('Una lectura estructurada que se pueda revisar.')).toBeInTheDocument();
    expect(screen.getByText('Vista de decisión con evidencia y dudas visibles.')).toBeInTheDocument();
    expect(screen.getAllByText('La organización debe confirmar la capacidad disponible.')).toHaveLength(2);
  });

  it('renders bounded Path with its uncertainty and boundary visible', () => {
    const path = makeSupportedPath({
      experienceState: 'BOUNDED',
      starteriaPathStatus: 'BOUNDED',
      boundaryStatement: 'La lectura mantiene incertidumbres relevantes que requieren evidencia externa.',
    });
    renderPath(path);

    expect(screen.getByText(/La lectura mantiene incertidumbres relevantes/)).toBeInTheDocument();
    expect(screen.getByText(/Esta ayuda requiere implementación antes de estar disponible/)).toBeInTheDocument();
  });

  it('renders only contextual capability nodes supplied by the DTO', () => {
    const path = makeSupportedPath({
      capabilityPath: [{
        capabilityType: 'PREPARE_DECISION',
        statement: 'Preparar una conversación con evidencia y dudas explícitas.',
        whyRelevant: 'La lectura identifica una decisión de capacidad todavía abierta.',
      }],
    });
    renderPath(path);

    const section = screen.getByTestId('starteria-path-capabilities');
    expect(within(section).getByText('Preparar una conversación con evidencia y dudas explícitas.')).toBeInTheDocument();
    expect(within(section).getByText('La lectura identifica una decisión de capacidad todavía abierta.')).toBeInTheDocument();
    expect(within(section).queryByText(/hacerlo todo|todas las capacidades/i)).not.toBeInTheDocument();
  });

  it('renders dependency details when present and omits the section when empty', () => {
    const view = renderPath(makeSupportedPath());
    expect(screen.getByRole('heading', { name: 'Dependencias que siguen abiertas' })).toBeInTheDocument();
    expect(screen.getByText('Sin ese dato no se puede valorar el espacio real para avanzar.')).toBeInTheDocument();

    view.rerender(<StarteriaPathExperience requestState="ready" path={makeSupportedPath({ dependencies: [] })} onRetry={view.onRetry} />);
    expect(screen.queryByRole('heading', { name: 'Dependencias que siguen abiertas' })).not.toBeInTheDocument();
  });

  it('renders only the first movement fields supplied by the API and omits the section when absent', () => {
    const view = renderPath(makeSupportedPath());
    expect(screen.getByRole('heading', { name: 'Un primer movimiento posible' })).toBeInTheDocument();
    expect(screen.getByText('Revisar la evidencia que ya existe para cada iniciativa.')).toBeInTheDocument();
    expect(screen.getByText('Esta revisión no decide cómo asignar capacidad.')).toBeInTheDocument();

    view.rerender(<StarteriaPathExperience requestState="ready" path={makeSupportedPath({ firstSupportedMovement: null })} onRetry={view.onRetry} />);
    expect(screen.queryByRole('heading', { name: 'Un primer movimiento posible' })).not.toBeInTheDocument();
  });

  it('fails closed for insufficient basis without showing any supported value', () => {
    const path: StarteriaPathDto = {
      experienceState: 'UNAVAILABLE_INSUFFICIENT_BASIS',
      boundaryStatement: 'internal unsupported detail',
      versions,
    };
    renderPath(path);

    expect(screen.getByText('Todavía no hay base suficiente para mostrar cómo Starteria podría ayudarte sin inventar una recomendación.')).toBeInTheDocument();
    expect(screen.queryByText(/Hay varias iniciativas|Una lectura estructurada/)).not.toBeInTheDocument();
  });

  it('shows the unconfirmed state without Path content', () => {
    renderPath({ experienceState: 'UNAVAILABLE_UNCONFIRMED', boundaryStatement: 'internal', versions });
    expect(screen.getByText('La lectura todavía necesita confirmación antes de continuar.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Así puede ayudarte Starteria' })).not.toBeInTheDocument();
  });

  it('keeps an API invalid state neutral and hides its boundary details', () => {
    renderPath({ experienceState: 'UNAVAILABLE_INVALID', boundaryStatement: 'private provider schema failure', versions });
    expect(screen.getByText('No pudimos validar esta lectura. Intenta cargarla de nuevo.')).toBeInTheDocument();
    expect(screen.queryByText(/private provider schema failure|provider|schema/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Así puede ayudarte Starteria' })).not.toBeInTheDocument();
  });

  it('shows stale and missing states without supported-looking content', () => {
    const view = renderPath({ experienceState: 'STALE', boundaryStatement: 'internal', versions });
    expect(screen.getByText('La situación cambió desde la última lectura. Revísala antes de continuar.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Así puede ayudarte Starteria' })).not.toBeInTheDocument();

    view.rerender(<StarteriaPathExperience requestState="missing" onRetry={view.onRetry} />);
    expect(screen.getByText('No hay una lectura confirmada disponible para mostrar esta experiencia.')).toBeInTheDocument();
  });

  it('keeps invalid and error recovery neutral, keyboard reachable, and hides internal details', async () => {
    const onRetry = vi.fn();
    const view = render(<StarteriaPathExperience requestState="invalid" onRetry={onRetry} />);
    expect(screen.getByText('No pudimos validar esta lectura. Intenta cargarla de nuevo.')).toBeInTheDocument();
    expect(screen.queryByText(/schema|provider|projectionVersion|internal/i)).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledTimes(1);

    view.rerender(<StarteriaPathExperience requestState="error" onRetry={onRetry} />);
    expect(screen.getByText('No pudimos cargar esta experiencia. Puedes intentarlo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('provides an accessible loading status and a wrapping mobile-safe content layout', () => {
    const view = render(<StarteriaPathExperience requestState="loading" onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    view.rerender(<StarteriaPathExperience requestState="ready" path={makeSupportedPath()} onRetry={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Así puede ayudarte Starteria' })).toHaveClass('min-w-0');
    expect(screen.getByText('Hay varias iniciativas y falta comparar la capacidad disponible.')).toHaveClass('break-words');
  });

  it('does not expose commercial actions, routes, legacy semantics, or internal taxonomy', () => {
    renderPath(makeSupportedPath());

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/Early Access|Demo|Aterrizarlo con Starteria|Empezar con Starteria|continuar con Starteria|continue-portfolio|portfolio\/setup/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/starteria_path|recommended_approach|recommended_cta|suggestedRoute|CAN_DO|CAN_SUPPORT|REQUIRES_IMPLEMENTATION|projectionVersion/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Core|Steps|challenge|strategic front/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Esto describe una ayuda y un artefacto que podrían quedar disponibles; no garantiza un resultado de negocio/)).toBeInTheDocument();
  });
});
