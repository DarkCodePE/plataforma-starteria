import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isDemoDataEnabled } from '../featureFlags';
import { can } from '../authz/permissions';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { usePortfolioHomeEntryContext, useScopedFirstValueEntryAccess } from '../../features/portfolio-entry/home/usePortfolioHomeEntryContext';

const ROLE_LABELS = {
  owner: 'Participante',
  mentor: 'Mentor',
  admin: 'Administrador',
  sponsor: 'Sponsor',
  portfolio_lead: 'Portfolio Lead',
} as const;


export function PortfolioLeadLayout() {
  return <PortfolioLeadLayoutContent />;
}

function PortfolioLeadLayoutContent() {
  const { authLoading, isAuthenticated, logout, setUserRole, user } = useApp();
  const { initiatives } = usePortfolioLead();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasGlobalPortfolioAccess = can(user, 'portfolio:read');
  const isPortfolioHomeArrival = location.pathname === '/portfolio/inicio';
  const isFirstValueArrival = location.pathname === '/portfolio/setup';
  const continuationId = isPortfolioHomeArrival
    ? new URLSearchParams(location.search).get('portfolioEntryContinuationId')
    : null;
  const scopedHomeArrival = Boolean(isAuthenticated && !hasGlobalPortfolioAccess && continuationId);
  const scopedSetupArrival = Boolean(isAuthenticated && !hasGlobalPortfolioAccess && isFirstValueArrival);
  const scopedEntryContext = usePortfolioHomeEntryContext(scopedHomeArrival ? continuationId : null);
  const scopedSetupAccess = useScopedFirstValueEntryAccess(scopedSetupArrival);
  const scopedHomeAuthorized = scopedHomeArrival && scopedEntryContext.status === 'ready' && Boolean(scopedEntryContext.data);
  const scopedSetupAuthorized = scopedSetupArrival && scopedSetupAccess.status === 'ready' && scopedSetupAccess.authorized;
  const scopedEntryAuthorized = scopedHomeAuthorized || scopedSetupAuthorized;
  const scopedEntryChecking = (scopedHomeArrival && (scopedEntryContext.status === 'idle' || scopedEntryContext.status === 'loading'))
    || (scopedSetupArrival && (scopedSetupAccess.status === 'idle' || scopedSetupAccess.status === 'loading'));

  const pendingDecisions = useMemo(
    () => initiatives.filter(item => item.readyForDecision || item.status === 'bloqueada').length,
    [initiatives],
  );

  const navItems = [
    { icon: LayoutDashboard, label: 'Inicio', path: '/portfolio/inicio' },
    { icon: Target, label: 'Frentes estratégicos', path: '/portfolio/frentes-estrategicos' },
    { icon: BriefcaseBusiness, label: 'Retos', path: '/portfolio/retos' },
    { icon: FolderKanban, label: 'Iniciativas', path: '/portfolio/iniciativas' },
    { icon: Building2, label: 'Actores clave', path: '/portfolio/sponsors' },
    {
      icon: ShieldCheck,
      label: 'Reportes y decisiones',
      path: '/portfolio/decisiones',
      badge: pendingDecisions > 0 ? `${pendingDecisions}` : null,
    },
  ];

  // ADR-029: se pregunta por CAPACIDAD, no por identidad.
  //
  // Antes esto enumeraba roles (`role === 'portfolio_lead' || role === 'admin'`), y esa
  // lista tenía que ampliarse a mano cada vez que otro rol necesitaba entrar â€” el parche
  // #156 fue exactamente eso. Ahora quien tenga el permiso entra, y añadir un rol nuevo
  // con acceso al portafolio no toca este archivo.
  //
  // Ya nadie queda encerrado aquí: el redirect-cárcel de AppLayout desapareció, así que
  // un portfolio lead que además es participante conserva su dashboard.
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    if (hasGlobalPortfolioAccess || scopedEntryAuthorized) return;

    if (!scopedEntryChecking) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, hasGlobalPortfolioAccess, scopedEntryAuthorized, scopedEntryChecking]);

  if (authLoading || !isAuthenticated) return null;
  if (scopedEntryChecking) {
    return <p data-testid="portfolio-scoped-access-checking" className="py-16 text-center text-sm text-text-muted">Estamos verificando tu acceso al Portfolio.</p>;
  }
  if (!hasGlobalPortfolioAccess && !scopedEntryAuthorized) return null;

  if (scopedEntryAuthorized) {
    return (
      <div data-testid="scoped-portfolio-entry-layout" className="flex h-screen overflow-hidden bg-[#f5f4ef]">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  const isActive = (path: string) => {
    if (path === '/portfolio/decisiones') {
      return location.pathname === '/portfolio/decisiones' || location.pathname === '/portfolio/reportes';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900">
            <Zap size={15} className="text-amber-300" />
          </div>
          <div>
            <p className="text-sm text-slate-900" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Startería</p>
            <p className="text-xs text-slate-500">Portfolio Lead</p>
          </div>
        </div>
      </div>

      {/* ADR-029: desde aquí se vuelve al workspace sin perder la sesión ni la zona. */}
      <WorkspaceSwitcher activa="portafolio" />

      <div className="mx-3 mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>CAPA ESTRATÉGICA</p>
        <p className="mt-1 text-xs text-amber-700">
          Esta vista acompaña decisiones de portafolio. No reemplaza el workspace operativo de las iniciativas.
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(item => (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              isActive(item.path)
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            style={{ fontWeight: isActive(item.path) ? 600 : 500 }}
          >
            <span className="flex items-center gap-3">
              <item.icon size={16} />
              {item.label}
            </span>
            {item.badge ? (
              <span className={`rounded-full px-2.5 py-1 text-xs ${isActive(item.path) ? 'bg-white/15 text-white' : 'bg-violet-100 text-violet-800'}`}>
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {isDemoDataEnabled() ? (
      <div className="border-t border-slate-100 px-3 py-3">
        <p className="mb-1.5 px-1 text-xs text-slate-400" style={{ fontWeight: 600 }}>VER COMO (demo)</p>
        <div className="grid grid-cols-2 gap-1">
          {(['owner', 'mentor', 'admin', 'sponsor', 'portfolio_lead'] as const).map(role => (
            <button
              key={role}
              onClick={() => setUserRole(role)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                user.role === role
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
              style={{ fontWeight: user.role === role ? 700 : 500 }}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      <div className="px-3 pb-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-900" style={{ fontWeight: 700 }}>
              {user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-900" style={{ fontWeight: 600 }}>{user.name}</p>
              <p className="text-xs text-slate-500">Portfolio Lead</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            style={{ fontWeight: 600 }}
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f4ef]">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-950/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 z-10 w-72 bg-white shadow-xl">
            <div className="flex justify-end border-b border-slate-100 p-3">
              <button onClick={() => setSidebarOpen(false)}>
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white/85 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu size={20} className="text-slate-700" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-slate-900" />
              <span className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Portfolio Lead</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-900" style={{ fontWeight: 700 }}>
              {user.initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
