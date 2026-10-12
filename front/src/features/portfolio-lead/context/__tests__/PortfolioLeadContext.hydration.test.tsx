import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// El provider monta global en RootLayout (incluida la landing pública). La
// hidratación desde el backend solo debe dispararse con sesión autenticada:
// un visitante anónimo no debe generar llamadas autenticadas (401 → refresh
// fallido → redirect a /auth) desde una ruta pública.
vi.mock('../../../../app/services/portfolioService', () => ({
  listStrategicFronts: vi.fn(),
  listChallenges: vi.fn(),
  listInitiatives: vi.fn(),
}));

vi.mock('../../../../app/context/AppContext', () => ({
  useApp: vi.fn(),
}));

import * as portfolioService from '../../../../app/services/portfolioService';
import { useApp } from '../../../../app/context/AppContext';
import { PortfolioLeadProvider, usePortfolioLead } from '../PortfolioLeadContext';

const listStrategicFronts = portfolioService.listStrategicFronts as ReturnType<typeof vi.fn>;
const listChallenges = portfolioService.listChallenges as ReturnType<typeof vi.fn>;
const listInitiatives = portfolioService.listInitiatives as ReturnType<typeof vi.fn>;
const mockedUseApp = useApp as unknown as ReturnType<typeof vi.fn>;

function Counts() {
  const { strategicFronts, challenges, initiatives } = usePortfolioLead();
  return (
    <div
      data-testid="counts"
      data-fronts={strategicFronts.length}
      data-challenges={challenges.length}
      data-initiatives={initiatives.length}
    />
  );
}

function renderProvider(suppressHydration = false) {
  return render(
    <PortfolioLeadProvider suppressHydration={suppressHydration}>
      <Counts />
    </PortfolioLeadProvider>,
  );
}

describe('PortfolioLeadProvider — hidratación gateada por sesión', () => {
  beforeEach(() => {
    listStrategicFronts.mockReset();
    listChallenges.mockReset();
    listInitiatives.mockReset();
    mockedUseApp.mockReset();
  });

  it('NO llama al backend cuando el visitante es anónimo (landing pública)', async () => {
    mockedUseApp.mockReturnValue({ isAuthenticated: false, authLoading: false });
    renderProvider();
    // Esperar un macrotask: si fuese a llamar, ya habría disparado el efecto.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listStrategicFronts).not.toHaveBeenCalled();
  });

  it('NO llama al backend mientras la sesión aún se está resolviendo', async () => {
    mockedUseApp.mockReturnValue({ isAuthenticated: false, authLoading: true });
    renderProvider();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listStrategicFronts).not.toHaveBeenCalled();
  });

  it('hidrata desde el backend cuando hay sesión autenticada', async () => {
    mockedUseApp.mockReturnValue({ isAuthenticated: true, authLoading: false });
    listStrategicFronts.mockResolvedValue([]);
    renderProvider();
    await waitFor(() => expect(listStrategicFronts).toHaveBeenCalledTimes(1));
  });

  it('114F arrival suppresses all tenant Portfolio transport before the consumer gate', async () => {
    mockedUseApp.mockReturnValue({ isAuthenticated: true, authLoading: false });
    renderProvider(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listStrategicFronts).not.toHaveBeenCalled();
    expect(listChallenges).not.toHaveBeenCalled();
    expect(listInitiatives).not.toHaveBeenCalled();
  });

  it('no sustituye con mocks cuando falla la hidratacion primaria del portfolio', async () => {
    mockedUseApp.mockReturnValue({ isAuthenticated: true, authLoading: false });
    listStrategicFronts.mockResolvedValue([{ id: 'front-1', name: 'Frente real' }]);
    listChallenges.mockRejectedValue(new Error('backend down'));
    const { getByTestId } = renderProvider();

    await waitFor(() => expect(listChallenges).toHaveBeenCalledTimes(1));
    const counts = getByTestId('counts');
    expect(counts.getAttribute('data-fronts')).toBe('0');
    expect(counts.getAttribute('data-challenges')).toBe('0');
    expect(counts.getAttribute('data-initiatives')).toBe('0');
    expect(listInitiatives).not.toHaveBeenCalled();
  });
});
