import React from 'react';
import axios from 'axios';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StarteriaPathExperience } from '../StarteriaPathExperience';
import type { StarteriaPathDto, StarteriaPathSupportedDto } from '../starteriaPath.types';
import { parseStarteriaPathDto } from '../starteriaPath.types';
import { CONVERSION_COPY } from '../conversionPresentation.types';

const versions = {
  pathSchemaVersion: 'starteria-path-dto-v0.2',
  projectionVersion: 'starteria-path-projection-v0.1',
  businessCapabilityBoundaryVersion: 'business-capability-boundary-v0.1',
} as const;

function makeSupportedPath(overrides: Partial<StarteriaPathSupportedDto> = {}): StarteriaPathSupportedDto {
  return {
    conversionPresentation: { availability: 'NO_VERIFIED_DESTINATION', conversionConfigVersion: 1, destinations: [] },
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
      pathSchemaVersion: 'starteria-path-dto-v0.2',
    },
    versions,
    ...overrides,
  };
}

function renderPath(path: StarteriaPathDto, onRetry = vi.fn()) {
  return { ...render(<StarteriaPathExperience requestState="ready" path={path} onRetry={onRetry} />), onRetry };
}

describe('StarteriaPathExperience', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records visible Path and tangible value, but no commercial funnel without a destination', () => {
    const events: Array<Record<string, unknown>> = [];
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer = events;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) { this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    });
    renderPath(makeSupportedPath());
    expect(events.filter((item) => item.event === 'starteria_path_viewed')).toHaveLength(1);
    expect(events.filter((item) => item.event === 'tangible_value_viewed')).toHaveLength(1);
    expect(events.filter((item) => /conversion_cta_viewed|demo_clicked|early_access_clicked|conversion_submitted/.test(String(item.event)))).toHaveLength(0);
    expect(events).not.toContainEqual(expect.objectContaining({ decisionInView: expect.anything() }));
  });
  it('does not recount Path value when only commercial configuration changes', () => {
    const events: Array<Record<string, unknown>> = [];
    (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer = events;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) { this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    });
    const view = renderPath(makeSupportedPath());
    const verified = makeSupportedPath({ conversionPresentation: {
      availability: 'DEMO_ONLY', conversionConfigVersion: 2,
      destinations: [{ type: 'DEMO', status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY',
        contextSharingSupported: true, label: CONVERSION_COPY.DEMO.label,
        availabilityDisclosure: 'Una solicitud no reserva una cita.' }],
    } });
    view.rerender(<StarteriaPathExperience requestState="ready" path={verified} onRetry={vi.fn()} />);
    expect(events.filter((item) => item.event === 'starteria_path_viewed')).toHaveLength(1);
    expect(events.filter((item) => item.event === 'tangible_value_viewed')).toHaveLength(1);
    expect(events.filter((item) => item.event === 'conversion_cta_viewed')).toHaveLength(1);
  });
  it.each(['DEMO', 'EARLY_ACCESS'] as const)('opens only the verified first-party %s form', async (type) => {
    const destination = type === 'DEMO'
      ? { type, status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY', contextSharingSupported: true,
        label: CONVERSION_COPY.DEMO.label,
        availabilityDisclosure: 'Envía una solicitud de contacto para una posible demostración. No reserva una cita.' }
      : { type, status: 'VERIFIED_ACTIVE', destinationKind: 'FIRST_PARTY', contextSharingSupported: true,
        label: CONVERSION_COPY.EARLY_ACCESS.label,
        availabilityDisclosure: 'Envía una solicitud de interés en acceso anticipado. No garantiza acceso.' };
    const path = makeSupportedPath({ conversionPresentation: {
      availability: type === 'DEMO' ? 'DEMO_ONLY' : 'EARLY_ACCESS_ONLY',
      conversionConfigVersion: 2, destinations: [destination],
    } } as unknown as Partial<StarteriaPathSupportedDto>);
    render(<StarteriaPathExperience requestState="ready" path={path} sessionId="session-1"
      decisionInView="Decidir el siguiente paso." onRetry={vi.fn()} />);
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: destination.label }));
    expect(screen.getByTestId(`conversion-submission-form-${type}`)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: destination.label })).not.toBeInTheDocument();
  });
  it('clicks only navigate and never submit or persist Entry context or consent', async () => {
    const post = vi.spyOn(axios.Axios.prototype, 'post');
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'send');
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      renderPath(makeSupportedPath({ conversionPresentation: {
        availability: 'DEMO_ONLY', conversionConfigVersion: 1,
        destinations: [{ type: 'DEMO', status: 'VERIFIED_ACTIVE', destinationKind: 'EXTERNAL',
          href: 'https://calendly.com/starteria/demo', contextSharingSupported: false, ...CONVERSION_COPY.DEMO }],
      } }));
      const link = screen.getByRole('link', { name: 'Solicitar una demo' });
      // jsdom cannot navigate; prevent only the browser default, leaving handlers observable.
      link.addEventListener('click', (event) => event.preventDefault());
      await userEvent.click(link);
      expect(post).not.toHaveBeenCalled();
      expect(xhr).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(storage).not.toHaveBeenCalled();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByText(/reserva confirmada|solicitud enviada/i)).not.toBeInTheDocument();
    } finally {
      post.mockRestore(); xhr.mockRestore(); storage.mockRestore(); fetchSpy.mockRestore();
    }
  });

  it.each([
    ['NO_VERIFIED_DESTINATION', []],
    ['DEMO_ONLY', ['DEMO']],
    ['EARLY_ACCESS_ONLY', ['EARLY_ACCESS']],
    ['EARLY_ACCESS_AND_DEMO', ['DEMO', 'EARLY_ACCESS']],
  ])('presents only verified actions after all value for %s', (availability, types) => {
    const destinations = types.map((type) => ({
      type, status: 'VERIFIED_ACTIVE', destinationKind: 'EXTERNAL',
      label: type === 'DEMO' ? 'Solicitar una demo' : 'Solicitar acceso anticipado',
      href: `https://calendly.com/starteria/${type.toLowerCase()}`,
      contextSharingSupported: false,
      availabilityDisclosure: CONVERSION_COPY[type as keyof typeof CONVERSION_COPY].availabilityDisclosure,
    }));
    const path = makeSupportedPath({ conversionPresentation: {
      availability, conversionConfigVersion: 1, destinations,
    } } as unknown as Partial<StarteriaPathSupportedDto>);
    expect(parseStarteriaPathDto(path)).toEqual(path);
    const { container } = renderPath(path);
    expect(screen.queryAllByRole('link')).toHaveLength(types.length);
    for (const destination of destinations) {
      const link = screen.getByRole('link', { name: destination.label });
      expect(link).toHaveAttribute('href', destination.href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
      for (const id of ['value-bridge', 'tangible-outcome', 'dependencies', 'first-movement', 'boundary']) {
        expect(screen.getByTestId(`starteria-path-${id}`).compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
    expect(container.querySelector('form, input, button')).toBeNull();
    expect(container.innerHTML).not.toMatch(/\/portfolio\/setup|continue-portfolio|pilot-leads|Entrar a Starteria|Ir al producto/);
  });

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
