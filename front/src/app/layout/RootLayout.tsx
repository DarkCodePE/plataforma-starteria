import React from 'react';
import { Outlet, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { AppProvider } from '../context/AppContext';
import { AutofillProvider } from '../context/AutofillContext';
import { PortfolioLeadProvider } from '../portfolio/PortfolioLeadContext';
import { isDemoDataEnabled } from '../featureFlags';
import { portfolioSetupArrivalIdentity } from '../../features/portfolio-entry/home/portfolioSetupArrivalIdentity';


function PortfolioLeadDataBoundary() {
  const location = useLocation();
  const suppressHydration = portfolioSetupArrivalIdentity(location.pathname, location.search).present;
  // ADR-028: aquí había un correo hardcodeado que activaba fixtures de demo. Se quita
  // sin sustituirlo por `role === 'portfolio_lead'`: esto sirve datos FALSOS, y dárselos
  // a todo portfolio lead real sería un cambio de comportamiento que nadie pidió. Queda
  // solo el flag explícito.
  const enableDemoData = isDemoDataEnabled();

  return (
    <PortfolioLeadProvider enableDemoData={enableDemoData && !suppressHydration} suppressHydration={suppressHydration}>
      <Toaster position="top-center" richColors closeButton />
      <Outlet />
    </PortfolioLeadProvider>
  );
}

/**
 * RootLayout wraps every route with AppProvider so that React context
 * and route components always share the same React tree — avoiding HMR
 * mismatches where a reloaded context module creates a new Context object
 * that doesn't match the one used by the Provider sitting outside the router.
 */
export function RootLayout() {
  return (
    <AppProvider>
      <AutofillProvider>
        <PortfolioLeadDataBoundary />
      </AutofillProvider>
    </AppProvider>
  );
}
