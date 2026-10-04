import React from 'react';
import {
  PublicConfidentialityNotice,
  PublicEnterpriseCards,
} from '../../../features/public-start/components';
import { PortfolioEntryExperience } from '../../../features/portfolio-entry/public';

export function PublicStartPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.10),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_46%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl py-7 lg:py-12">
        <div className="mb-7 max-w-3xl">
          <p className="text-xs font-semibold uppercase text-indigo-700">Entrada publica Starteria</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-950 md:text-5xl">
            Aclara qué quieres conseguir antes de decidir qué hacer.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            Prepara una lectura inicial de qué quieres lograr, para qué, qué está pasando y qué parece estar en juego. Starteria puede ayudarte a orientar una decisión y un posible punto de partida como hipótesis, y a ver qué falta aclarar.
          </p>
        </div>

        <PortfolioEntryExperience variant="workspace" />
      </section>

      <div className="mx-auto max-w-5xl space-y-8 pb-10">
        <PublicConfidentialityNotice />
        <PublicEnterpriseCards />
      </div>
    </div>
  );
}
