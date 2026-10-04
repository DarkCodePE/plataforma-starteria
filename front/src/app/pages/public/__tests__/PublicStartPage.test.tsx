import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PublicStartPage } from '../PublicStartPage';

vi.mock('../../../../features/portfolio-entry/public', () => ({
  PortfolioEntryExperience: () => <form aria-label="Portfolio Entry" />,
}));

vi.mock('../../../../features/public-start/components', () => ({
  PublicConfidentialityNotice: () => null,
  PublicEnterpriseCards: () => null,
}));

describe('PublicStartPage strategic clarity framing', () => {
  it('promises a provisional strategic reading before action, not a finished plan', () => {
    render(<MemoryRouter><PublicStartPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Aclara qué quieres conseguir antes de decidir qué hacer.' })).toBeInTheDocument();
    expect(screen.getByText(/qué quieres lograr, para qué, qué está pasando y qué parece estar en juego/i)).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Portfolio Entry' })).toBeInTheDocument();
    expect(screen.queryByText(/plan de acción definitivo|portfolio automático|priorización automática/i)).not.toBeInTheDocument();
  });
});
