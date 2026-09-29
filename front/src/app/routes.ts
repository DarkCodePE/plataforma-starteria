import React from 'react';
import { createBrowserRouter, redirect } from 'react-router';
import { RootLayout } from './layout/RootLayout';
import { LandingPage } from './pages/LandingPage';
import { AppLayout } from './layout/AppLayout';
import { PortfolioLeadLayout } from './layout/PortfolioLeadLayout';
import { PublicLayout } from './layout/PublicLayout';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { ProjectHomePage } from './pages/ProjectHomePage';
import { InitiativeOverviewPage } from './pages/InitiativeOverviewPage';
import { InitiativeReviewStartPage } from '../features/initiative-review/pages/InitiativeReviewStartPage';
import { InitiativeReviewResultPage } from '../features/initiative-review/pages/InitiativeReviewResultPage';
import { Step0Page } from './pages/Step0Page';
import { Step1Page } from './pages/Step1Page';
import { Step2Page } from './pages/Step2Page';
import { Step3Page } from './pages/Step3Page';
import { Step4Page } from './pages/Step4Page';
import { EvidenciasPage } from './pages/EvidenciasPage';
import { MentorPanelPage } from './pages/MentorPanelPage';
import { AdminCohorte } from './pages/AdminCohorte';
import { RoleAdminPage } from './pages/RoleAdminPage';
import { PerfilPage } from './pages/PerfilPage';
import { ParticipantChallengeDetailPage } from './pages/ParticipantChallengeDetailPage';
import { PortfolioLeadIntroPage } from './pages/PortfolioLeadIntroPage';
import { PortfolioLeadHomePage } from './pages/PortfolioLeadHomePage';
import { PortfolioLeadStartPage } from './pages/PortfolioLeadStartPage';
import { PortfolioLeadSectionPage } from './pages/PortfolioLeadSectionPage';
import { PortfolioLeadStrategicFrontsPage } from './pages/PortfolioLeadStrategicFrontsPage';
import { PortfolioLeadChallengesPage } from './pages/PortfolioLeadChallengesPage';
import { PortfolioLeadInitiativesPage } from './pages/PortfolioLeadInitiativesPage';
import { PortfolioLeadDecisionsPage } from './pages/PortfolioLeadDecisionsPage';
import { PortfolioLeadExecutiveOutputPage } from './pages/PortfolioLeadExecutiveOutputPage';
import { PublicStartPage } from './pages/public/PublicStartPage';
import { PublicInitiativeStartPage } from './pages/public/PublicInitiativeStartPage';
import { PublicProposalEditorPage } from './pages/public/PublicProposalEditorPage';
import { PublicProposalResultPage } from './pages/public/PublicProposalResultPage';
import { ProgressiveSignupPage } from './pages/public/ProgressiveSignupPage';
import { PublicResumeWithCodePage } from './pages/public/PublicResumeWithCodePage';
import { AuthenticatedProvisionalContinuationPage } from './pages/public/AuthenticatedProvisionalContinuationPage';
import { ContinuePilotPage } from './pages/ContinuePilotPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { StrategicFramingWorkspacePage } from '../features/portfolio-lead/strategic-framing/StrategicFramingWorkspacePage';
import { HandoffInvitationPage } from './pages/HandoffInvitationPage';
import { PortfolioLeadFirstValuePage } from '../features/portfolio-lead/first-value/PortfolioLeadFirstValuePage';

export const appRoutes = [
  {
    // RootLayout provides AppProvider for every route in the tree,
    // keeping context inside the React Router rendering context.
    Component: RootLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        // Landing público (ADR-019). Index de RootLayout → fuera del guard de
        // AppLayout, visible para todos. `/` ya no rebota a /dashboard/login.
        index: true,
        Component: LandingPage,
      },
      {
        path: '/auth',
        Component: AuthPage,
      },
      { path: '/handoff/invitations/:token', Component: HandoffInvitationPage },
      {
        path: '/auth/continue/:draftId',
        Component: PublicLayout,
        children: [
          { index: true, Component: ProgressiveSignupPage },
        ],
      },
      {
        path: '/public',
        Component: PublicLayout,
        children: [
          { path: 'start', Component: PublicStartPage },
          { path: 'provisional-continuation', Component: AuthenticatedProvisionalContinuationPage },
          { path: 'start/initiative', Component: PublicInitiativeStartPage },
          { path: 'continuar', Component: PublicResumeWithCodePage },
          { path: 'draft/:draftId/edit', Component: PublicProposalEditorPage },
          { path: 'draft/:draftId/result', Component: PublicProposalResultPage },
        ],
      },
      {
        // AppLayout es pathless (sin `path`) para que `/` lo gane el landing
        // (index de RootLayout, ADR-019). Sus hijos usan rutas absolutas y el
        // guard de auth de AppLayout sigue protegiéndolos igual que antes.
        Component: AppLayout,
        children: [
          { path: '/dashboard', Component: DashboardPage },
          { path: '/continuar-piloto', Component: ContinuePilotPage },
          { path: '/retos/:challengeId', Component: ParticipantChallengeDetailPage },
          { path: '/projects/new', Component: CreateProjectPage },
          { path: '/initiatives/new', Component: InitiativeReviewStartPage },
          { path: '/initiatives/review/:reviewId', Component: InitiativeReviewResultPage },
          { path: '/initiatives/:projectId/overview', Component: InitiativeOverviewPage },
          { path: '/projects/:projectId', Component: ProjectHomePage },
          { path: '/projects/:projectId/step/0', Component: Step0Page },
          { path: '/projects/:projectId/step/1', Component: Step1Page },
          { path: '/projects/:projectId/step/2', Component: Step2Page },
          { path: '/projects/:projectId/step/3', Component: Step3Page },
          { path: '/projects/:projectId/step/4', Component: Step4Page },
          { path: '/projects/:projectId/evidencias', Component: EvidenciasPage },
          { path: '/evidencias', Component: EvidenciasPage },
          { path: '/companies', Component: CompaniesPage },
          { path: '/mentor', Component: MentorPanelPage },
          { path: '/admin', Component: AdminCohorte },
          // ADR-029: administración de roles de plataforma. El gate real está en el
          // servidor; la página misma se degrada si el usuario no puede asignar.
          { path: '/admin/roles', Component: RoleAdminPage },
          { path: '/perfil', Component: PerfilPage },
        ],
      },
      {
        path: '/portfolio',
        Component: PortfolioLeadLayout,
        children: [
          { index: true, loader: () => redirect('/portfolio/inicio') },
          { path: 'inicio', Component: PortfolioLeadHomePage },
          { path: 'setup', Component: PortfolioLeadFirstValuePage },
          { path: 'iniciar', Component: PortfolioLeadStartPage },
          { path: 'frentes-estrategicos', Component: PortfolioLeadStrategicFrontsPage },
          { path: 'retos', Component: PortfolioLeadChallengesPage },
          { path: 'iniciativas', Component: PortfolioLeadInitiativesPage },
          { path: 'decisiones', Component: PortfolioLeadDecisionsPage },
          { path: 'salida-ejecutiva', Component: PortfolioLeadExecutiveOutputPage },
          { path: 'sponsors', Component: PortfolioLeadSectionPage },
          { path: 'reportes', Component: PortfolioLeadSectionPage },
          { path: 'empresa', Component: CompaniesPage },
          { path: 'framing/:stateId', Component: StrategicFramingWorkspacePage },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
