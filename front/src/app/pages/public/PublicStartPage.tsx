import React from 'react';
import {
  PublicConfidentialityNotice,
  PublicEnterpriseCards,
} from '../../../features/public-start/components';
import { PortfolioEntryExperience } from '../../../features/portfolio-entry/public';

export function PublicStartPage() {
  return (
    <div className="relative bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.10),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_46%,#f8fafc_100%)] px-4 py-4 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl py-2">
        <PortfolioEntryExperience variant="workspace" showPublicPromise />
      </section>

      <div className="mx-auto max-w-5xl space-y-8 pb-10">
        <PublicConfidentialityNotice />
        <PublicEnterpriseCards />
      </div>
    </div>
  );
}
