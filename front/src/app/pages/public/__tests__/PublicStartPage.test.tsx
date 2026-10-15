import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PublicStartPage } from '../PublicStartPage';

vi.mock('../../../../features/portfolio-entry/public', () => ({
  PortfolioEntryExperience: ({ showPublicPromise }: { showPublicPromise?: boolean }) =>
    <form aria-label="Portfolio Entry" data-public-promise={String(showPublicPromise)} />,
}));

vi.mock('../../../../features/public-start/components', () => ({
  PublicConfidentialityNotice: () => null,
  PublicEnterpriseCards: () => null,
}));

describe('PublicStartPage strategic clarity framing', () => {
  it('delegates the approved pre-entry promise to the session-aware experience without a second hero', () => {
    render(<MemoryRouter><PublicStartPage /></MemoryRouter>);

    expect(screen.getByRole('form', { name: 'Portfolio Entry' })).toHaveAttribute('data-public-promise', 'true');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
