import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, matchPath } from 'react-router';
import {
  LayoutDashboard, FolderOpen, Users, BarChart3, User, HelpCircle,
  LogOut, Menu, X, ChevronRight, Bell, Settings, Zap, CreditCard, Target, ShieldCheck
} from 'lucide-react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useApp } from '../context/AppContext';
import { isDemoDataEnabled } from '../featureFlags';
import { can } from '../authz/permissions';
import { ROLE_LABELS, userRoleLabel } from './roleLabels';
import { AutofillHydrator } from '../components/autofill/AutofillHydrator';
import * as portfolioService from '../services/portfolioService';
import type { InitiativeMeta } from '../services/portfolioService';



export function AppLayout() {
  const { user, logout, setUserRole, currentProject, isAuthenticated, authLoading, canAccessProject } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // #93: resolve which reto/frente the active iniciativa belongs to (persisted link
  // from #92) so the Steps portal can show a Frente › Reto › Iniciativa breadcrumb.
  const [initiativeMeta, setInitiativeMeta] = useState<InitiativeMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentProject?.id) {
      setInitiativeMeta(null);
      return;
    }
    portfolioService
      .getInitiativeMeta(currentProject.id)
      .then((meta) => { if (!cancelled) setInitiativeMeta(meta); })
      .catch(() => { if (!cancelled) setInitiativeMeta(null); });
    return () => { cancelled = true; };
  }, [currentProject?.id]);

  useEffect(() => {
    // KAN-67: al abrir o recargar una ruta, la sesión todavía se está restaurando y
    // `isAuthenticated` es false por un instante. Sin esperar, se mandaba a /auth y de
    // ahí al dashboard. Mismo guard que PortfolioLeadLayout.
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    // ADR-029: AQUÍ vivía el redirect que encerraba al portfolio lead en /portfolio.
    // Comparaba el rol PRIMARIO, así que quien fuera participante Y portfolio lead
    // perdía su dashboard, sus iniciativas y el flujo Step 0-4 — no por una decisión
    // de producto, sino porque `role` era un escalar y no sabía decir "las dos cosas".
    // Ahora la zona se ELIGE (WorkspaceSwitcher) en vez de imponerse.

    if (user?.role !== 'sponsor') return;

    const blockedStaticPaths = ['/projects/new', '/initiatives/new', '/initial-reviews', '/mentor', '/admin'];
    if (blockedStaticPaths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'))) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const projectHomeMatch = matchPath('/projects/:projectId', location.pathname);
    const stepMatch = matchPath('/projects/:projectId/step/:stepId', location.pathname);
    const evidenceMatch = matchPath('/projects/:projectId/evidencias', location.pathname);

    if (stepMatch?.params.projectId && !canAccessProject(stepMatch.params.projectId, 'step')) {
      navigate(`/projects/${stepMatch.params.projectId}`, { replace: true });
      return;
    }

    if (evidenceMatch?.params.projectId && !canAccessProject(evidenceMatch.params.projectId, 'evidence')) {
      navigate(`/projects/${evidenceMatch.params.projectId}`, { replace: true });
      return;
    }

    if (
      projectHomeMatch?.params.projectId &&
      !stepMatch &&
      !evidenceMatch &&
      !canAccessProject(projectHomeMatch.params.projectId, 'overview')
    ) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, user?.role, location.pathname, navigate, canAccessProject]);

  if (authLoading || !isAuthenticated) return null;

  const isActive = (path: string) => {
    if (path === '/evidencias' && matchPath('/projects/:projectId/evidencias', location.pathname)) return true;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  const canOpenProjectSteps = user?.role !== 'sponsor';
// ADR-029: el menú se compone por permisos, no por el rol primario.
// El rol primario solo afecta copy/presentación; los accesos reales salen
// de los permisos efectivos del usuario.
const etiquetaDashboard =
  user?.role === 'sponsor'
    ? 'Iniciativas patrocinadas'
    : user?.role === 'mentor' || user?.role === 'admin'
      ? 'Todos los proyectos'
      : 'Mis iniciativas';

const links = [
  {
    icon: LayoutDashboard,
    label: etiquetaDashboard,
    path: '/dashboard',
  },

  ...(can(user, 'mentor:panel')
    ? [
        {
          icon: Users,
          label: 'Revisiones pendientes',
          path: '/mentor',
        },
      ]
    : []),

  ...(can(user, 'cohort:manage')
    ? [
        {
          icon: BarChart3,
          label: 'Panel cohorte',
          path: '/admin',
        },
        {
          icon: Users,
          label: 'Mentores',
          path: '/admin#mentores',
        },
      ]
    : []),

  ...(can(user, 'users:assign-roles')
    ? [
        {
          icon: ShieldCheck,
          label: 'Roles de plataforma',
          path: '/admin/roles',
        },
      ]
    : []),

  ...(can(user, 'portfolio:read')
    ? [
        {
          icon: Target,
          label: 'Portafolio',
          path: '/portfolio/inicio',
        },
      ]
    : []),

  ...(can(user, 'project:own')
    ? [
        {
          icon: FolderOpen,
          label: 'Evidencias',
          path: '/evidencias',
        },
      ]
    : []),

  {
    icon: User,
    label: 'Mi perfil',
    path: '/perfil',
  },
];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-base text-slate-900" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Startería</span>
        </div>
      </div>

      {/* ADR-029: elegir zona en vez de que se imponga por rol. Invisible para
          quien pertenece a una sola superficie. */}
      <WorkspaceSwitcher activa="iniciativas" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(link => (
          <button
            key={link.path + link.label}
            onClick={() => { if (!('disabled' in link && link.disabled)) { navigate(link.path); setSidebarOpen(false); }}}
            disabled={'disabled' in link && !!link.disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
              ${isActive(link.path) && !('disabled' in link && link.disabled)
                ? 'bg-indigo-50 text-indigo-700'
                : ('disabled' in link && link.disabled)
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            style={{ fontWeight: isActive(link.path) ? 600 : 400 }}
          >
            <link.icon size={16} />
            {link.label}
          </button>
        ))}
      </nav>

      {/* Project context (if in project) */}
      {currentProject && (
        <div className="mx-3 mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          {/* #93: Frente › Reto › Iniciativa breadcrumb — only when the iniciativa is
              linked to a reto. Clicking returns to the Portfolio Lead dashboard. */}
          {initiativeMeta?.challenge && (
            <button
              type="button"
              onClick={() => navigate('/portfolio/iniciativas')}
              title="Ver en Portfolio Lead"
              className="mb-1 block max-w-full truncate text-left text-[11px] text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              {initiativeMeta.challenge.strategicFront?.name
                ? `${initiativeMeta.challenge.strategicFront.name} › `
                : ''}
              {initiativeMeta.challenge.name ?? initiativeMeta.challenge.title}
            </button>
          )}
          <p className="text-xs text-indigo-500 mb-0.5" style={{ fontWeight: 600 }}>PROYECTO ACTIVO</p>
          <p className="text-sm text-indigo-800 truncate" style={{ fontWeight: 500 }}>{currentProject.name}</p>

          {/* Step progress dots */}
          <div className="flex gap-1 mt-2">
            {/* Paso 0 dot */}
            <button
              onClick={() => {
                if (!canOpenProjectSteps) return;
                navigate(`/projects/${currentProject.id}/step/0`);
              }}
              title="Paso 0: Punto de partida"
              disabled={!canOpenProjectSteps}
              className={`w-4 h-1.5 rounded-full transition-colors ${
                currentProject.step0Status === 'Completado' ? 'bg-emerald-500' :
                currentProject.step0Status === 'En progreso' ? 'bg-indigo-400' :
                'bg-slate-200'
              } ${!canOpenProjectSteps ? 'cursor-not-allowed opacity-60' : ''}`}
            />
            {currentProject.steps.map(s => (
              <button
                key={s.number}
                onClick={() => {
                  if (!canOpenProjectSteps) return;
                  navigate(`/projects/${currentProject.id}/step/${s.number}`);
                }}
                title={`Step ${s.number}: ${s.name}`}
                disabled={!canOpenProjectSteps}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s.status === 'Aprobado' ? 'bg-emerald-500' :
                  s.status === 'En progreso' || s.status === 'Enviado' || s.status === 'Feedback IA' || s.status === 'Ajustado' || s.status === 'Sesión experto pendiente' ? 'bg-indigo-500' :
                  'bg-slate-200'
                } ${!canOpenProjectSteps ? 'cursor-not-allowed opacity-60' : ''}`}
              />
            ))}
          </div>

          {/* Mentor credits */}
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-indigo-100">
            <div className="flex items-center gap-1 text-xs text-indigo-400">
              <CreditCard size={11} />
              <span>Créditos mentor</span>
            </div>
            <div className="group relative">
              <span
                className="text-xs text-indigo-700 cursor-default"
                style={{ fontWeight: 600 }}
              >
                {currentProject.mentorCredits ?? '?'} disponibles
              </span>
              {/* Tooltip */}
              <div className="absolute right-0 bottom-5 w-48 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50" style={{ lineHeight: 1.4 }}>
                Se usan para sesiones de validación con un mentor experto.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role switcher (demo) */}
      {isDemoDataEnabled() ? (
      <div className="px-3 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 px-1 mb-1.5" style={{ fontWeight: 600 }}>VER COMO (demo)</p>
        <div className="grid grid-cols-2 gap-1">
          {(['owner', 'mentor', 'admin', 'sponsor', 'portfolio_lead'] as const).map(r => (
            <button
              key={r}
              onClick={() => setUserRole(r)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${user?.role === r ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              style={{ fontWeight: user?.role === r ? 600 : 400 }}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      ) : null}

      {user?.role === 'owner' && (
        <div className="mx-3 mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>¿Gestionas iniciativas de un equipo?</p>
          <button
            type="button"
            onClick={() => {
              navigate('/portfolio-lead/intro');
              setSidebarOpen(false);
            }}
            className="mt-2 text-left text-xs text-indigo-700 hover:text-indigo-800"
            style={{ fontWeight: 700 }}
          >
            Conocer Portfolio Lead
          </button>
        </div>
      )}

      {/* User */}
      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={() => navigate('/perfil')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>
            {user?.initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm text-slate-800 truncate" style={{ fontWeight: 500 }}>{user?.name}</p>
            <p className="text-xs text-slate-400">{userRoleLabel(user)}</p>
          </div>
        </button>
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-slate-200 bg-white shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl z-10">
            <div className="flex justify-end p-3 border-b border-slate-100">
              <button onClick={() => setSidebarOpen(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-600" />
            <span className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Startería</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700" style={{ fontWeight: 700 }}>
            {user?.initials}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {/*
            Side-effect-only hydrator. Reads `:projectId` from the active route
            via useParams() and pre-fills the AutofillContext slice on mount so
            that hard refreshes / direct deep-links to /projects/:id/step/N
            still render the dashed-border chips. Returns null. See
            components/autofill/AutofillHydrator.tsx for the rationale.
          */}
          <AutofillHydrator />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
