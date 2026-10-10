import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Clock, Users, AlertTriangle, ChevronRight, Search, Folder, BellRing, MessageSquare, FolderOpen, Layers3, UploadCloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Project, SponsorTouchpoint, TeamMember } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { ProgressBar } from '../components/ProgressBar';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { activationLabel, challengeStatusLabel, challengeTypeLabel } from '../portfolio/portfolioLeadCopy';
import { DashboardPdfDropzone } from '../components/DashboardPdfDropzone';
import {
  getAdaptiveCardState,
  getAdaptiveProgress,
  getAdaptiveSegmentStatus,
  getAdaptiveStatusLabel,
  getAdaptiveStepLabel,
} from './dashboard-initiative-state';

const CREATE_INITIATIVE_PATH = '/initiatives/new';
const IMPORT_INITIATIVE_PATH = '/projects/new?mode=import';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-full mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="h-2 bg-slate-100 rounded w-full" />
    </div>
  );
}

type SponsorAlert = {
  projectId: string;
  projectName: string;
  touchpoint: SponsorTouchpoint;
  commentCount: number;
};

function buildSponsorAlerts(projects: Project[]): SponsorAlert[] {
  return projects.flatMap(project =>
    (project.sponsorTouchpoints ?? [])
      .filter(touchpoint => touchpoint.status !== 'Cerrado')
      .map(touchpoint => ({
        projectId: project.id,
        projectName: project.name,
        touchpoint,
        commentCount: (project.sponsorComments ?? []).filter(comment => comment.touchpointId === touchpoint.id).length,
      }))
  );
}

function getSponsorMilestone(project: Project) {
  const step2 = project.steps.find(step => step.number === 2);
  const step4 = project.steps.find(step => step.number === 4);

  if (project.step0Status !== 'Completado') {
    return {
      label: 'Step 0',
      summary: 'Definir el contexto y convocar el alineamiento inicial.',
    };
  }

  if (step2 && ['En progreso', 'Enviado', 'Feedback IA', 'Ajustado', 'Sesión experto pendiente', 'Aprobado'].includes(step2.status)) {
    return {
      label: 'Cierre Step 2',
      summary: 'Revisar la definición estratégica del problema antes de seguir.',
    };
  }

  if (step4 && step4.status !== 'Bloqueado' && step4.status !== 'No iniciado') {
    return {
      label: 'Step 4',
      summary: 'Participar en la presentación final y acordar el siguiente paso.',
    };
  }

  return {
    label: 'Seguimiento',
    summary: 'La iniciativa sigue avanzando. Aún no tienes una intervención inmediata.',
  };
}

export function DashboardPage() {
  const { projects, projectsLoading, setCurrentProject, user, getProjectMember, acceptSponsorInvitation } = useApp();
  const { challenges, strategicFronts } = usePortfolioLead();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const loading = projectsLoading;

  const isOwner = user?.role === 'owner';
  const isSponsor = user?.role === 'sponsor';
  // El Portfolio Lead no es del equipo de las iniciativas que sigue: las ve en Portafolio.
  const isPortfolioLead = user?.role === 'portfolio_lead';
  const filtered = projects.filter(project =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.description?.toLowerCase().includes(search.toLowerCase())
  );

  // El backend manda el equipo sin email (sólo userId): se reconoce a la persona por cualquiera de los dos.
  const isMe = (member: TeamMember) =>
    (!!user?.id && member.userId === user.id) || (!!user?.email && member.email === user.email);
  const visibleProjects = isOwner
    ? filtered.filter(project => project.team.some(isMe))
    : isSponsor
      ? filtered.filter(project =>
          project.team.some(
            member =>
              isMe(member) &&
              member.role === 'Sponsor' &&
              member.status !== 'Pendiente'
          )
        )
      : filtered;

  const sponsorAlerts = isSponsor ? buildSponsorAlerts(visibleProjects) : [];
  const participantEmail = user?.email?.toLowerCase() ?? '';
  const publishedChallenges = challenges.filter(challenge => challenge.visibleToParticipants);
  const openChallenges = publishedChallenges.filter(challenge => challenge.activationMode === 'convocatoria_abierta');
  const invitedChallenges = publishedChallenges.filter(challenge =>
    challenge.activationMode !== 'convocatoria_abierta'
      && (challenge.activationMode === 'squad_asignado'
        || challenge.selectedPeople.some(person => person.value.toLowerCase() === participantEmail)),
  );

  const handleOpenProject = (id: string) => {
    const project = projects.find(item => item.id === id);
    if (!project) return;
    setCurrentProject(project);
    navigate(`/projects/${id}`);
  };

  const handleContinueProject = (id: string) => {
    const project = projects.find(item => item.id === id);
    if (!project) return;
    setCurrentProject(project);
    const current = getCurrentWorkStep(project);
    navigate(`/projects/${id}/step/${current.number}`);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
    if (hrs > 0) return `Hace ${hrs} h`;
    return `Hace ${mins} min`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl text-slate-900 mb-1" style={{ fontWeight: 700 }}>
            {user?.role === 'owner'
              ? 'Mis iniciativas'
              : user?.role === 'mentor'
                ? 'Proyectos a revisar'
                : user?.role === 'admin'
                ? 'Todos los proyectos'
                  : isPortfolioLead
                    ? 'Mis iniciativas'
                    : 'Iniciativas con sponsor'}
          </h1>
          {user?.role === 'owner' && (
            <p className="text-sm text-slate-500">
              Crea, ordena y continúa tus iniciativas desde el recorrido Step 0-4.
            </p>
          )}
        </div>
        {user?.role === 'owner' && (
          <button
            onClick={() => navigate(CREATE_INITIATIVE_PATH)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
            style={{ fontWeight: 500 }}
          >
            <Plus size={16} /> Crear iniciativa
          </button>
        )}
      </div>

      {user?.role === 'owner' && <DashboardPdfDropzone />}

      {isSponsor && (
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900" style={{ fontWeight: 600 }}>Vista sponsor</p>
          <p className="text-xs text-indigo-700 mt-1">
            Aquí ves solo las iniciativas donde fuiste asignado como sponsor, sus hitos clave y los pendientes donde debes intervenir.
          </p>
        </div>
      )}

      {isSponsor && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <BellRing size={16} className="text-indigo-600" />
            <h2 className="text-sm text-slate-900" style={{ fontWeight: 600 }}>Pendientes del sponsor</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Aquí aparece cuándo el equipo te solicita revisión, agenda una sesión o deja listo un espacio para comentario.
          </p>

          {sponsorAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700" style={{ fontWeight: 500 }}>No tienes alertas activas.</p>
              <p className="text-xs text-slate-500 mt-1">
                Cuando el equipo te convoque en Step 0, cierre Step 2 o Step 4, verás el pendiente aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sponsorAlerts.map(alert => (
                <div key={`${alert.projectId}-${alert.touchpoint.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-900" style={{ fontWeight: 600 }}>{alert.projectName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {alert.touchpoint.stageLabel} · {alert.touchpoint.title}
                      </p>
                    </div>
                    <StatusChip status={alert.touchpoint.status} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Acción: {alert.touchpoint.actionLabel}</span>
                    <span>•</span>
                    <span>{alert.touchpoint.date ? `Fecha: ${alert.touchpoint.date}` : 'Sin fecha confirmada'}</span>
                    <span>•</span>
                    <span>{alert.commentCount > 0 ? `${alert.commentCount} comentario(s) registrados` : 'Sin comentarios aún'}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleOpenProject(alert.projectId)}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Ver detalle
                    </button>
                    <button
                      onClick={() => handleOpenProject(alert.projectId)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-white transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      Dejar comentario
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative mb-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar iniciativas..."
          className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(index => <SkeletonCard key={index} />)}
        </div>
      ) : visibleProjects.length === 0 && !search && user?.role === 'owner' ? (
        <DashboardEmptyState firstChallengeId={publishedChallenges[0]?.id} userName={user?.name} />
      ) : visibleProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Folder size={24} className="text-indigo-400" />
          </div>
          <h3 className="text-slate-800 mb-2" style={{ fontWeight: 600 }}>
            {search
              ? 'Sin resultados'
              : isSponsor
                ? 'No tienes iniciativas asignadas como sponsor'
                : isPortfolioLead
                  ? 'No formas parte del equipo de ninguna iniciativa'
                  : 'No tienes iniciativas aún'}
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-xs">
            {search
              ? `No encontramos proyectos con "${search}". Prueba con otro término.`
              : isSponsor
                ? 'Cuando te asignen como sponsor verás aquí el avance, los hitos donde debes intervenir y la siguiente convocatoria.'
                : isPortfolioLead
                  ? 'Las iniciativas de tus frentes y retos las sigues desde Portafolio.'
                  : 'Crea tu primera iniciativa y empieza a ordenarla desde Step 0.'}
          </p>
          {!search && isPortfolioLead && (
            <button
              onClick={() => navigate('/portfolio/iniciativas')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Layers3 size={16} /> Ver iniciativas del portafolio
            </button>
          )}
          {!search && user?.role === 'owner' && (
            <button
              onClick={() => navigate(CREATE_INITIATIVE_PATH)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus size={16} /> Crear primera iniciativa
            </button>
          )}
        </div>
      ) : isOwner ? (
        <ParticipantInitiativesDashboard
          projects={visibleProjects}
          openChallenges={openChallenges}
          invitedChallenges={invitedChallenges}
          onOpenProject={handleOpenProject}
          onContinueProject={handleContinueProject}
          timeAgo={timeAgo}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map(project => {
            const adaptive = getAdaptiveCardState(project);
            const dashboardSteps = adaptive
              ? project.steps.map(step => ({ ...step, status: getAdaptiveSegmentStatus(adaptive, step.number) }))
              : project.steps;
            const currentStep = getCurrentWorkStep(project);
            const hasBlock = hasActiveBlock(project);
            const pendingSession = project.steps.some(step => step.status === 'Sesión experto pendiente');
            const sponsorMilestone = isSponsor ? getSponsorMilestone(project) : null;
            const sponsorMember = isSponsor ? getProjectMember(project.id, user?.email) : null;
            const sponsorInvitationPendingAcceptance = sponsorMember?.role === 'Sponsor' && sponsorMember.status === 'Enviado';
            const lastTouchpoint = (project.sponsorTouchpoints ?? []).find(item => item.status !== 'Cerrado');

            return (
              <button
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <StatusChip status={adaptive ? getAdaptiveStatusLabel(adaptive) : project.status} size="sm" />
                  {sponsorMember?.role === 'Sponsor' && <StatusChip status={sponsorMember.status} size="sm" />}
                  {pendingSession && <StatusChip status="Sesión experto pendiente" size="sm" />}
                </div>

                <div className="flex gap-1 mb-3">
                  {dashboardSteps.map(step => (
                    <div key={step.number} className="flex-1" title={`Step ${step.number}: ${step.name} — ${step.status}`}>
                      <div className={`h-1.5 rounded-full ${
                        step.status === 'Aprobado'
                          ? 'bg-emerald-500'
                          : ['En progreso', 'Enviado', 'Feedback IA', 'Ajustado', 'Sesión experto pendiente'].includes(step.status)
                            ? 'bg-indigo-500'
                            : step.status === 'No iniciado'
                              ? 'bg-slate-200'
                              : 'bg-slate-100'
                      }`} />
                      <p className="text-xs text-slate-400 mt-1 text-center">{step.number}</p>
                    </div>
                  ))}
                </div>

                {currentStep && (
                  <div className="mb-3">
                    <ProgressBar value={currentStep.progress} size="sm" label={currentStep.label} />
                  </div>
                )}

                {(hasBlock || pendingSession) && (
                  <div className={`flex items-center gap-1.5 text-xs p-2 rounded-lg mb-2 ${
                    hasBlock ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'
                  }`}>
                    <AlertTriangle size={11} />
                    {hasBlock ? getBlockMessage(project) : 'Sesión con experto pendiente de agendar'}
                  </div>
                )}

                {sponsorMilestone && (
                  <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700" style={{ fontWeight: 600 }}>
                      Próxima intervención · {sponsorMilestone.label}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">{sponsorMilestone.summary}</p>
                    {lastTouchpoint && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-indigo-700">
                        <BellRing size={12} />
                        <span>{lastTouchpoint.stageLabel} · {lastTouchpoint.status}</span>
                      </div>
                    )}
                    {sponsorInvitationPendingAcceptance && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-white px-3 py-2">
                        <div>
                          <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Invitación enviada</p>
                          <p className="text-xs text-slate-500">Acepta el acceso para habilitar tu seguimiento formal en Startería.</p>
                        </div>
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            acceptSponsorInvitation(project.id);
                          }}
                          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          Aceptar acceso
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(project.sponsorComments ?? []).length > 0 && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                    <MessageSquare size={12} />
                    <span>{project.sponsorComments?.length} comentario(s) del sponsor registrados</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-1">
                    <Users size={11} /> {project.team.length} miembro{project.team.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={11} /> {timeAgo(project.lastModified)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isFromPublicDraft(project: Project) {
  return project.origin === 'from_public_draft' || !!project.publicDraftContext;
}

function getCurrentWorkStep(project: Project) {
  const adaptive = getAdaptiveCardState(project);
  if (adaptive) {
    return {
      number: adaptive.step,
      label: getAdaptiveStepLabel(adaptive),
      progress: getAdaptiveProgress(adaptive),
      status: adaptive.kind === 'in_step' ? 'En progreso' : 'Aprobado',
    };
  }
  if (project.currentStep === 0 || project.step0Status !== 'Completado') {
    return {
      number: 0,
      label: project.step0Status === 'No iniciado' ? 'Step 0 pendiente' : `Step 0 ${project.step0Status.toLowerCase()}`,
      progress: project.step0Status === 'Completado' ? 100 : project.step0Status === 'En progreso' ? 35 : 0,
      status: project.step0Status,
    };
  }

  const currentStep = project.steps.find(step => step.number === project.currentStep) ?? project.steps[0];
  return {
    number: currentStep?.number ?? 1,
    label: currentStep ? `Step ${currentStep.number} ${currentStep.status.toLowerCase()}` : 'Step 1 pendiente',
    progress: currentStep?.progress ?? 0,
    status: currentStep?.status ?? 'No iniciado',
  };
}

// Con meta de portafolio, el bloqueo es el que reporta el flujo adaptativo; las filas legacy de
// `Step` quedan en BLOCKED aunque nadie esté bloqueado.
function hasActiveBlock(project: Project) {
  const adaptive = getAdaptiveCardState(project);
  if (adaptive) return adaptive.kind === 'in_step' && adaptive.blocker !== null;
  return project.steps.some(step => step.status === 'Bloqueado' && step.number === project.currentStep);
}

function getBlockMessage(project: Project) {
  const adaptive = getAdaptiveCardState(project);
  return adaptive?.kind === 'in_step' && adaptive.blocker ? `Bloqueo: ${adaptive.blocker}` : 'Hay módulos bloqueados que requieren atención';
}

function getParticipantStatus(project: Project) {
  const adaptive = getAdaptiveCardState(project);
  if (adaptive) return adaptive.kind === 'in_step' && adaptive.blocker ? 'Bloqueada' : getAdaptiveStatusLabel(adaptive);
  if (project.steps.some(step => step.status === 'Bloqueado')) return 'Bloqueada';
  if (project.steps.some(step => ['Enviado', 'Feedback IA', 'Sesión experto pendiente'].includes(step.status))) return 'En revisión';
  if (project.step0Status !== 'Completado' || project.status === 'Draft') return 'Borrador';
  return 'En progreso';
}

function getNextParticipantAction(project: Project) {
  const adaptive = getAdaptiveCardState(project);
  if (adaptive?.kind === 'closed') return 'Ver la decisión registrada';
  if (adaptive?.kind === 'ready_for_decision') return 'Decisión del Portfolio Lead pendiente';
  if (adaptive?.kind === 'in_step' && adaptive.blocker) return 'Revisar bloqueo';
  if (adaptive) return `Continuar Step ${adaptive.step}`;
  const current = getCurrentWorkStep(project);
  if (project.steps.some(step => step.status === 'Bloqueado')) return 'Revisar bloqueo';
  if (current.number === 0) {
    return project.step0Status === 'No iniciado' ? 'Completar contexto inicial' : 'Continuar Step 0';
  }
  if (current.status === 'Feedback IA') return 'Revisar feedback';
  if (current.status === 'Enviado' || current.status === 'Sesión experto pendiente') return 'Revisar estado de validación';
  return `Continuar Step ${current.number}`;
}

function getProjectProgress(project: Project) {
  const adaptive = getAdaptiveCardState(project);
  if (adaptive) return getAdaptiveProgress(adaptive);
  const step0Progress = project.step0Status === 'Completado' ? 100 : project.step0Status === 'En progreso' ? 35 : 0;
  const stepProgress = project.steps.reduce((sum, step) => sum + (step.progress ?? 0), 0);
  return Math.round((step0Progress + stepProgress) / (project.steps.length + 1));
}

type ParticipantChallenge = ReturnType<typeof usePortfolioLead>['challenges'][number];

function ParticipantInitiativesDashboard({
  projects,
  openChallenges,
  invitedChallenges,
  onOpenProject,
  onContinueProject,
  timeAgo,
}: {
  projects: Project[];
  openChallenges: ParticipantChallenge[];
  invitedChallenges: ParticipantChallenge[];
  onOpenProject: (id: string) => void;
  onContinueProject: (id: string) => void;
  timeAgo: (iso: string) => string;
}) {
  const sortedProjects = [...projects].sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  const continueProjects = sortedProjects
    .filter(project => project.step0Status !== 'Completado' || project.steps.some(step => step.status !== 'No iniciado' && step.status !== 'Aprobado'))
    .slice(0, 3);

  return (
    <div className="space-y-7">
      {continueProjects.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="text-base text-slate-900" style={{ fontWeight: 700 }}>Continúa donde lo dejaste</h2>
            <p className="mt-1 text-sm text-slate-500">Retoma las iniciativas activas o recientes.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {continueProjects.map(project => (
              <ParticipantContinueCard key={project.id} project={project} onContinueProject={onContinueProject} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3">
          <h2 className="text-base text-slate-900" style={{ fontWeight: 700 }}>Mis iniciativas</h2>
          <p className="mt-1 text-sm text-slate-500">Vista compacta para revisar estado, avance y siguiente acción.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {sortedProjects.map(project => (
            <ParticipantInitiativeRow key={project.id} project={project} onOpenProject={onOpenProject} timeAgo={timeAgo} />
          ))}
        </div>
      </section>

      {(openChallenges.length > 0 || invitedChallenges.length > 0) && (
        <section className="grid gap-6 xl:grid-cols-2">
          <ParticipantChallengePanel
            title="Retos abiertos"
            description="Revisa convocatorias abiertas y decide si alguna conecta con lo que quieres mover."
            emptyTitle="No hay retos abiertos por ahora"
            emptyDescription="Cuando Portfolio Lead publique una convocatoria abierta, aparecerá aquí."
            challenges={openChallenges}
          />
          <ParticipantChallengePanel
            title="Retos donde fui invitado"
            description="Estos retos ya tienen acceso de lectura para ti o para tu squad."
            emptyTitle="No tienes invitaciones activas"
            emptyDescription="Cuando te inviten a un reto publicado, aparecerá aquí."
            challenges={invitedChallenges}
          />
        </section>
      )}
    </div>
  );
}

function ParticipantContinueCard({ project, onContinueProject }: { project: Project; onContinueProject: (id: string) => void }) {
  const current = getCurrentWorkStep(project);
  const nextAction = getNextParticipantAction(project);
  const adaptive = getAdaptiveCardState(project);
  const ctaLabel = adaptive && adaptive.kind !== 'in_step'
    ? 'Ver iniciativa'
    : current.number === 0 ? 'Continuar Step 0' : `Continuar Step ${current.number}`;

  return (
    <button
      type="button"
      onClick={() => onContinueProject(project.id)}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-200 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm text-slate-900 line-clamp-2" style={{ fontWeight: 700 }}>{project.name}</h3>
        <ChevronRight size={16} className="shrink-0 text-slate-300" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusChip status={getParticipantStatus(project)} size="sm" />
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{current.label}</span>
        {isFromPublicDraft(project) ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Creada desde propuesta inicial</span> : null}
      </div>
      <div className="mt-4">
        <ProgressBar value={current.progress} size="sm" label={`Avance ${current.progress}%`} />
      </div>
      <p className="mt-3 text-xs text-slate-500">Siguiente acción: <span className="text-slate-700" style={{ fontWeight: 600 }}>{nextAction}</span></p>
      <p className="mt-4 text-sm text-indigo-700" style={{ fontWeight: 700 }}>{ctaLabel}</p>
    </button>
  );
}

function ParticipantInitiativeRow({
  project,
  onOpenProject,
  timeAgo,
}: {
  project: Project;
  onOpenProject: (id: string) => void;
  timeAgo: (iso: string) => string;
}) {
  const current = getCurrentWorkStep(project);
  const adaptive = getAdaptiveCardState(project);
  const hasBlock = adaptive ? hasActiveBlock(project) : project.steps.some(step => step.status === 'Bloqueado');
  const nextAction = getNextParticipantAction(project);
  const actionLabel = hasBlock
    ? 'Ver bloqueo'
    : adaptive && adaptive.kind !== 'in_step'
      ? 'Ver iniciativa'
      : nextAction.includes('feedback') ? 'Ver feedback' : current.number === 0 ? 'Continuar en Step 0' : 'Continuar';
  const progress = getProjectProgress(project);

  return (
    <button
      type="button"
      onClick={() => onOpenProject(project.id)}
      className="flex w-full flex-col gap-3 border-b border-slate-100 p-4 text-left transition-colors last:border-b-0 hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-sm text-slate-900" style={{ fontWeight: 700 }}>{project.name}</h3>
          {isFromPublicDraft(project) ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Creada desde propuesta inicial</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <StatusChip status={getParticipantStatus(project)} size="sm" />
          <span>{current.label}</span>
          <span>Última actividad: {timeAgo(project.lastModified)}</span>
          {hasBlock ? <span className="text-amber-700">Bloqueo activo</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-3 md:w-52">
        <div className="hidden flex-1 md:block">
          <ProgressBar value={progress} size="sm" label={`${progress}%`} />
        </div>
        <span className="shrink-0 text-sm text-indigo-700" style={{ fontWeight: 700 }}>{actionLabel}</span>
      </div>
    </button>
  );
}

function getWelcomeCopy(name?: string) {
  const displayName = name?.trim().split(/\s+/)[0] || 'bienvenido';
  const feminine = displayName.toLowerCase().endsWith('a');
  return `${feminine ? 'Bienvenida' : 'Bienvenido'}, ${displayName}`;
}

function DashboardEmptyState({ firstChallengeId, userName }: { firstChallengeId?: string; userName?: string }) {
  const navigate = useNavigate();
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
      <div className="max-w-2xl">
        <p className="text-xs uppercase text-indigo-600" style={{ fontWeight: 800, letterSpacing: '0.08em' }}>{getWelcomeCopy(userName)}</p>
        <h2 className="mt-3 text-3xl text-slate-950" style={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
          Empieza ordenando tu primera iniciativa
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Describe una idea, problema u oportunidad. Starteria te ayudará a convertirla en un borrador claro desde Step 0.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Tu iniciativa empieza como borrador privado. Podrás editarla antes de compartirla.
        </p>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate(CREATE_INITIATIVE_PATH)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm text-white shadow-sm transition-colors hover:bg-indigo-700"
          style={{ fontWeight: 700 }}
        >
          <Plus size={16} /> Crear mi primera iniciativa
        </button>
        <button
          type="button"
          onClick={() => navigate(IMPORT_INITIATIVE_PATH)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          style={{ fontWeight: 700 }}
        >
          <UploadCloud size={16} /> Importar iniciativa existente
        </button>
        {firstChallengeId ? (
          <button
            type="button"
            onClick={() => navigate(`/retos/${firstChallengeId}`)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            style={{ fontWeight: 700 }}
          >
            <FolderOpen size={16} /> Explorar retos disponibles
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ParticipantChallengePanel({
  title,
  description,
  emptyTitle,
  emptyDescription,
  challenges,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  challenges: ReturnType<typeof usePortfolioLead>['challenges'];
}) {
  const { user } = useApp();
  const { strategicFronts, initiatives } = usePortfolioLead();
  const navigate = useNavigate();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{title}</h2>
      <p className="mt-2 text-xs text-slate-500">{description}</p>

      {challenges.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{emptyTitle}</p>
          <p className="mt-1 text-xs text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {challenges.map(challenge => {
            const front = strategicFronts.find(item => item.id === challenge.strategicFrontId);
            const relatedInitiatives = initiatives.filter(item => item.challengeId === challenge.id);
            const initiativeCount = challenge.initiativeCount || relatedInitiatives.length;
            return (
              <button
                key={challenge.id}
                type="button"
                onClick={() => navigate(`/retos/${challenge.id}`)}
                className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-5 py-5 text-left transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-4">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                      <FolderOpen size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{challengeStatusLabel(challenge.status)}</span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">{activationLabel(challenge.activationMode)}</span>
                      </div>
                      <p className="mt-3 text-base text-slate-900" style={{ fontWeight: 700 }}>{challenge.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                        <span>{front?.name ?? 'Sin frente'}</span>
                        <span>{challengeTypeLabel(challenge.challengeType)}</span>
                        {user?.cohort && (
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                            {user.cohort}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-slate-300" />
                </div>

                <div className="mt-5 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(180px,0.85fr)]">
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                    <p className="text-[11px] text-slate-400">Estado visible</p>
                    <p className="mt-1 text-slate-700" style={{ fontWeight: 600 }}>{challengeStatusLabel(challenge.status)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                    <p className="text-[11px] text-slate-400">Modalidad</p>
                    <p className="mt-1 text-slate-700" style={{ fontWeight: 600 }}>{activationLabel(challenge.activationMode)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 sm:col-span-2 xl:col-span-1">
                    <p className="text-[11px] text-slate-400">Iniciativas asociadas</p>
                    <p className="mt-1 flex items-center gap-1 text-slate-700" style={{ fontWeight: 600 }}>
                      <Layers3 size={12} />
                      {initiativeCount > 0 ? `${initiativeCount} iniciativa${initiativeCount !== 1 ? 's' : ''}` : 'Sin iniciativas aun'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs leading-5 text-slate-500">
                    {challenge.selectedPeople.some(person => person.value.toLowerCase() === (user?.email?.toLowerCase() ?? ''))
                      ? 'Tienes acceso a revisar este reto antes de decidir si quieres sumarte.'
                      : 'Abre el reto para entenderlo primero antes de decidir si te conviene participar.'}
                  </p>
                  <div className="mt-4">
                    <span className="inline-flex rounded-lg bg-slate-900 px-3.5 py-2 text-xs text-white" style={{ fontWeight: 600 }}>
                      Abrir reto
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
