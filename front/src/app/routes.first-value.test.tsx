import { describe, expect, it } from 'vitest';
import { appRoutes } from './routes';
import { PortfolioLeadLayout } from './layout/PortfolioLeadLayout';
import { PortfolioLeadFirstValuePage } from '../features/portfolio-lead/first-value/PortfolioLeadFirstValuePage';

describe('First Value canonical route', () => {
  it('FV-01: registra una sola ruta /portfolio/setup bajo el layout y auth actuales', () => {
    const root = appRoutes[0];
    const portfolio = root.children?.find(route => 'path' in route && route.path === '/portfolio');
    const setupRoutes = portfolio?.children?.filter(route => 'path' in route && route.path === 'setup') ?? [];

    expect(setupRoutes).toHaveLength(1);
    expect(portfolio?.Component).toBe(PortfolioLeadLayout);
    expect(setupRoutes[0]?.Component).toBe(PortfolioLeadFirstValuePage);
    const portfolioIndex = portfolio?.children?.find(route => 'index' in route && route.index === true);
    const homeRedirect = portfolioIndex && 'loader' in portfolioIndex
      ? (portfolioIndex.loader as () => Response)()
      : undefined;
    expect(homeRedirect?.headers.get('Location')).toBe('/portfolio/inicio');
  });
});
