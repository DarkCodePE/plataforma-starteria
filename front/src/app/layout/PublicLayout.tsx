import React from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Zap } from 'lucide-react';
import { PUBLIC_START_COPY } from '../../features/public-start/domain/copy';

export function PublicLayout() {
  const location = useLocation();
  const showFooterNotice = location.pathname !== '/public/start';
  const isPublicStart = location.pathname === '/public/start';
  const isWidePublicWorkspace = location.pathname.startsWith('/public/draft/') || location.pathname.startsWith('/auth/continue/');
  const containerClass = isWidePublicWorkspace ? 'max-w-[1600px]' : 'max-w-5xl';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className={`mx-auto flex ${containerClass} min-w-0 flex-wrap items-center justify-between gap-2 px-5 py-3`}>
          <Link to="/public/start" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600">
              <Zap size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Starteria</p>
              <p className="text-xs text-slate-500">{isPublicStart ? 'Copilot de orientación' : 'Entrada pública'}</p>
            </div>
          </Link>
          <Link
            to="/auth"
            className="min-h-11 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm text-slate-600 whitespace-normal break-words transition-colors hover:bg-slate-50"
            style={{ fontWeight: 600 }}
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className={`mx-auto ${containerClass} ${isPublicStart ? 'px-0 py-0' : 'px-5 py-8'}`}>
        <Outlet />
      </main>

      {showFooterNotice && (
        <footer className={`mx-auto ${containerClass} px-5 pb-8`}>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {PUBLIC_START_COPY.confidentialityNotice}
          </div>
        </footer>
      )}
    </div>
  );
}
