import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser } from '../services/auth.service';
import { PERMISSIONS, type Permission } from '../authz/permissions';
import { initAuth, getAccessToken, parseApiError, AuthError } from '../services/api';
import * as projectService from '../services/projectService';
import { mapPublicDraftToStep0Data } from '../../features/public-start/domain/mappers';
import {
  getPublicDraft,
  isPublicDraftExpired,
  updatePublicDraft,
} from '../../features/public-start/services/publicDraftStorage';
import { saveStep0Prefill } from '../../features/public-start/services/publicStep0PrefillService';
import type { AdaptiveInitiativeCore } from '../../features/adaptive-core/domain/types';

export type { AuthError } from '../services/api';

export type Role = 'owner' | 'mentor' | 'admin' | 'sponsor' | 'portfolio_lead';

export type Step0Status = 'No iniciado' | 'En progreso' | 'Completado';
export type Step0Mode = 'independent' | 'linked_to_challenge';
export type Step0Frame = 'correccion' | 'crecimiento' | 'exploracion' | 'mejora_proceso' | '';
export type Step0ClarityLevel =
  | 'observacion_inicial'
  | 'algunas_senales'
  | 'hipotesis_clara'
  | 'idea_pensada'
  | 'decision_por_destrabar'
  | '';
export type Step0PrimaryObjective =
  | 'eficiencia'
  | 'experiencia_cliente'
  | 'ingresos'
  | 'riesgo'
  | 'productividad'
  | 'aprendizaje'
  | 'otro'
  | '';
export type Step0ContributionType =
  | 'descubrir_problema'
  | 'validar_hipotesis'
  | 'resolver_parte'
  | 'resolver_directo'
  | 'no_claro'
  | '';
export type Step0AdditionalStakeholders = 'no' | 'si' | 'no_claro' | '';
export type LeaderFeedbackStatus =
  | 'pending'
  | 'proposal_sent'
  | 'meeting_scheduled'
  | 'feedback_received'
  | 'approved_to_investigate'
  | 'aligned_with_conditions'
  | 'not_prioritized'
  | 'not_applicable';
export type Step0EvidenceType =
  | ''
  | 'datos'
  | 'testimonios'
  | 'feedback_clientes'
  | 'feedback_equipo'
  | 'reclamos_tickets'
  | 'demoras'
  | 'retrabajo'
  | 'benchmark'
  | 'hipotesis'
  | 'sin_senales'
  | 'otro';

export type ProjectStatus =
  | 'Draft'
  | 'En progreso'
  | 'En revisión IA'
  | 'Iteración'
  | 'Sesión experto pendiente'
  | 'Paso aprobado'
  | 'Finalizado';

export type StepStatus =
  | 'No iniciado'
  | 'En progreso'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Sesión experto pendiente'
  | 'Aprobado'
  | 'Bloqueado';

export type ModuleStatus =
  | 'Draft'
  | 'En progreso'
  | 'Completado'
  | 'Bloqueado'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Aprobado';

export type RunStatus = 'Draft' | 'En ejecución' | 'Cerrado' | 'Revisar cambios';
export type EvidenceStatus = 'Subida' | 'Verificada' | 'Rechazada';

export interface Step0Data {
  nombreParticipante: string;
  rolArea: string;
  origen: '' | 'problema' | 'oportunidad' | 'idea' | 'explorando' | 'otra';
  quePasaQueQuieres: string;
  impacta: string[];
  parteProceso: '' | 'antes' | 'durante' | 'despues' | 'transversal' | 'otra';
  impacto3meses: '' | 'ingresos' | 'costos' | 'riesgo' | 'cliente' | 'productividad' | 'no_claro' | 'otro';
  respaldo: Step0EvidenceType;
  quienEscuchar: string;
  siMinimo: string[];
  mode?: Step0Mode;
  initiativeTitle?: string;
  initiativeFrame?: Step0Frame;
  clarityLevel?: Step0ClarityLevel;
  primaryObjective?: Step0PrimaryObjective;
  specificChallengePart?: string;
  challengeGoalConnection?: string;
  linkedContributionType?: Step0ContributionType;
  impactWho?: string;
  visibleMoment?: string;
  whyNowText?: string;
  ifNotNowConsequence?: string;
  evidenceType?: Step0EvidenceType;
  currentEvidence?: string;
  validationSignal?: string;
  sponsorInterestReason?: string;
  supportNeeded?: string;
  decisionRequested?: string;
  deliveryEmail?: string;
  additionalStakeholders?: Step0AdditionalStakeholders;
  additionalStakeholdersDetail?: string;
  alignmentStatus?: 'pending' | 'scheduled' | 'feedback_received' | 'aligned' | 'aligned_with_observations' | 'not_aligned' | 'unknown';
  alignmentPerson?: string;
  alignmentRoleArea?: string;
  alignmentDate?: string;
  alignmentFeedback?: string;
  alignmentInitialDecision?: string;
  alignmentEvidenceType?: string;
  alignmentEvidenceNote?: string;
  alignmentAdvancedPending?: boolean;
  leaderFeedbackStatus?: LeaderFeedbackStatus;
  leaderFeedbackPerson?: string;
  leaderFeedbackRoleArea?: string;
  leaderFeedbackDate?: string;
  leaderFeedbackComment?: string;
  leaderFeedbackInitialDecision?: string;
  leaderFeedbackEvidenceType?: string;
  leaderFeedbackEvidenceNote?: string;
  leaderFeedbackTopic?: string;
  leaderFeedbackClosedPending?: boolean;
  adaptiveCore?: AdaptiveInitiativeCore;
}

export interface ProjectChallengeLink {
  challengeId: string;
  createdFrom: 'challenge';
}

export type TeamMemberRole = 'Owner' | 'Editor' | 'Viewer' | 'Sponsor';
export type TeamMemberStatus = 'Pendiente' | 'Enviado' | 'Activo';

export interface TeamMember {
  id: string;
  /** Usuario de la fila TeamMember del backend; la lista de proyectos no trae su email. */
  userId?: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  initials: string;
}

/**
 * ¿Esta fila del equipo es la persona? El equipo que manda el backend trae userId y no email;
 * el que arma el front (borradores, invitaciones) trae email.
 */
export function isSameTeamMember(member: Pick<TeamMember, 'userId' | 'email'>, person: { id?: string; email?: string }): boolean {
  if (person.id && member.userId === person.id) return true;
  return !!person.email && !!member.email && member.email.toLowerCase() === person.email.toLowerCase();
}

export interface Evidence {
  id: string;
  name: string;
  type: 'Imagen' | 'PDF' | 'Video' | 'Link' | 'Otro';
  size?: string;
  url?: string;
  stepRef: number;
  moduleRef?: string;
  owner: string;
  date: string;
  status: EvidenceStatus;
}

export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  createdAt: string;
  metrics?: { name: string; expected: string; actual?: string; passed?: boolean }[];
  learningCard?: { what: string; learned: string; decision: 'Iterar' | 'Pivot' | 'Kill' | null };
}

export interface Step {
  number: 1 | 2 | 3 | 4;
  name: string;
  status: StepStatus;
  progress: number;
  modules: { id: string; name: string; status: ModuleStatus }[];
  feedbackIA?: FeedbackIA | null;
  mentorSession?: MentorSession | null;
  runs?: Run[];
}

export interface FeedbackIA {
  status: 'Aprobado' | 'Iterar' | 'Bloqueado';
  summary: string;
  goodPoints: string[];
  missing: string[];
  actions: string[];
  questions: string[];
  contradictions?: string[];
  timestamp?: string;
}

export interface MentorSession {
  id: string;
  mentor: string;
  mode?: 'meeting' | 'async_review';
  date?: string;
  status: 'Pendiente agendar' | 'Agendada' | 'Pendiente revisión' | 'Realizada';
  result?: 'Aprobado' | 'Iterar' | 'Bloqueado';
  comments?: string;
}

export type SponsorTouchpointId = 'step0' | 'step2' | 'step4';
export type SponsorTouchpointStatus =
  | 'Pendiente de convocatoria'
  | 'Revisión solicitada'
  | 'Sesión agendada'
  | 'Comentario enviado'
  | 'Cerrado';

export interface SponsorTouchpoint {
  id: SponsorTouchpointId;
  title: string;
  stageLabel: string;
  status: SponsorTouchpointStatus;
  date?: string;
  actionLabel: string;
}

export interface SponsorComment {
  id: string;
  touchpointId: SponsorTouchpointId;
  authorName: string;
  authorRole: 'Sponsor';
  message: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  origin?: 'manual' | 'from_public_draft';
  publicDraftContext?: {
    draftId: string;
    originalText: string;
    suggestedTitle?: string;
    suggestedSummary?: string;
  };
  status: ProjectStatus;
  currentStep: number;
  step0Status: Step0Status;
  step0Data?: Partial<Step0Data>;
  mentorCredits: number; // POR DEFINIR: cantidad, recarga y qué consume crédito
  steps: Step[];
  team: TeamMember[];
  sponsorTouchpoints?: SponsorTouchpoint[];
  sponsorComments?: SponsorComment[];
  evidence: Evidence[];
  createdAt: string;
  lastModified: string;
  cohort?: string;
  riskLevel?: 'Bajo' | 'Medio' | 'Alto';
  challengeLink?: ProjectChallengeLink;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /**
   * ADR-029: rol de PRESENTACIÓN (etiqueta del sidebar, badge de perfil).
   * NO decide acceso — para eso está `permissions` / `can()`. Un usuario con dos
   * roles tiene un solo `role` primario, así que compararlo para decidir a qué
   * zona entra es justo el bug que ADR-029 arregla.
   */
  role: Role;
  /** ADR-029: permisos derivados en el servidor. La base de toda decisión de acceso. */
  permissions: Permission[];
  initials: string;
  skills: string[];
  cohort?: string;
}

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  projects: Project[];
  projectsLoading: boolean;
  currentProject: Project | null;
  login: (email: string, password: string, options?: { loadProjects?: boolean }) => Promise<{ success: boolean; waitlisted?: boolean; waitlistedEmail?: string; error?: AuthError }>;
  register: (name: string, email: string, password: string, options?: { loadProjects?: boolean }) => Promise<{ success: boolean; waitlisted?: boolean; waitlistedEmail?: string; error?: AuthError }>;
  googleSignIn: (idToken: string, options?: { loadProjects?: boolean }) => Promise<{ success: boolean; waitlisted?: boolean; waitlistedEmail?: string; error?: AuthError }>;
  logout: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  createProject: (
    name: string,
    description?: string,
    teamMembers?: TeamMember[],
    options?: { challengeLink?: ProjectChallengeLink },
  ) => Promise<{ success: true; project: Project } | { success: false; error: string }>;
  createProjectFromPublicDraft: (draftId: string) => Promise<Project>;
  hydrateProjectStep0FromPrefill: (projectId: string, step0Data: Step0Data) => void;
  setUserRole: (role: Role) => void;
  updateStep0: (projectId: string, data: Partial<Step0Data>, status: Step0Status) => void;
  getProjectMember: (projectId: string, email?: string) => TeamMember | null;
  canAccessProject: (projectId: string, accessLevel?: 'overview' | 'step' | 'evidence') => boolean;
  markSponsorInvitationSent: (projectId: string, sponsorEmail: string) => void;
  acceptSponsorInvitation: (projectId: string) => void;
  updateSponsorTouchpoint: (
    projectId: string,
    touchpointId: SponsorTouchpointId,
    updates: Partial<SponsorTouchpoint>
  ) => void;
  addSponsorComment: (projectId: string, touchpointId: SponsorTouchpointId, message: string) => void;
}

const inferNameFromEmail = (email: string) =>
  email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const inferInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

export function createTeamMember(
  email: string,
  role: TeamMember['role'] = 'Editor',
  status: TeamMember['status'] = 'Pendiente',
  initials?: string
): TeamMember {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
  const fallbackName = inferNameFromEmail(normalizedEmail) || localPart;
  const derivedInitials = initials ?? localPart.slice(0, 2).toUpperCase();

  return {
    id: `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: fallbackName,
    email: normalizedEmail,
    role,
    status,
    initials: derivedInitials,
  };
}

export const DEFAULT_SPONSOR_TOUCHPOINTS: SponsorTouchpoint[] = [
  {
    id: 'step0',
    title: 'Alineamiento inicial',
    stageLabel: 'Step 0',
    status: 'Pendiente de convocatoria',
    actionLabel: 'Confirmar contexto inicial',
  },
  {
    id: 'step2',
    title: 'Revisión estratégica',
    stageLabel: 'Cierre Step 2',
    status: 'Pendiente de convocatoria',
    actionLabel: 'Revisar definición del problema',
  },
  {
    id: 'step4',
    title: 'Presentación final',
    stageLabel: 'Step 4',
    status: 'Pendiente de convocatoria',
    actionLabel: 'Preparar decisión final',
  },
];

const AppContext = createContext<AppContextType | null>(null);

const PENDING_CONVERSION_KEY = 'starteria.publicStart.pendingConversion';

function writeSessionJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function enrichProject(raw: any, currentUser: User | null): Project {
  const normalizeStep0Status = (status: unknown): Step0Status => {
    if (status === 'NOT_STARTED' || status === 'not_started' || status === 'No iniciado') return 'No iniciado';
    if (status === 'IN_PROGRESS' || status === 'in_progress' || status === 'En progreso') return 'En progreso';
    if (status === 'COMPLETED' || status === 'completed' || status === 'Completado') return 'Completado';
    return 'No iniciado';
  };

  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((s: any, idx: number) => ({
        ...s,
        number: s.number ?? s.stepNumber ?? idx,
        name: s.name ?? s.title ?? `Paso ${idx}`,
        status: s.status ?? 'No iniciado',
        progress: typeof s.progress === 'number' ? s.progress : 0,
        modules: Array.isArray(s.modules)
          ? s.modules.map((m: any) => ({ ...m, name: m.name ?? m.title ?? '' }))
          : [],
      }))
    : [];

  const capitalize = (r: string) =>
    r ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : 'Editor';

  const MEMBER_STATUS: Record<string, TeamMemberStatus> = { ACTIVE: 'Activo', PENDING: 'Pendiente' };
  // El backend devuelve el equipo como `teamMembers` (filas TeamMember); `team` es la forma local.
  const rawTeam = Array.isArray(raw.team) ? raw.team : Array.isArray(raw.teamMembers) ? raw.teamMembers : null;

  let team: TeamMember[] = rawTeam
    ? rawTeam.map((m: any) => ({
        id: m.id ?? `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId: m.userId ?? m.user?.id,
        name: m.name ?? m.user?.name ?? m.email?.split('@')[0] ?? '',
        email: m.email ?? m.user?.email ?? '',
        role: capitalize(m.role ?? 'editor') as TeamMemberRole,
        status: (MEMBER_STATUS[m.status] ?? m.status ?? 'Activo') as TeamMemberStatus,
        initials:
          m.initials ?? (m.name ?? m.email ?? '').toString().slice(0, 2).toUpperCase(),
      }))
    : [];

  if (team.length === 0 && raw.ownerId && currentUser && raw.ownerId === currentUser.id) {
    team = [
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: 'Owner',
        status: 'Activo',
        initials: currentUser.initials,
      },
    ];
  }

  return {
    ...raw,
    steps,
    team,
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    sponsorTouchpoints: raw.sponsorTouchpoints ?? DEFAULT_SPONSOR_TOUCHPOINTS,
    sponsorComments: Array.isArray(raw.sponsorComments) ? raw.sponsorComments : [],
    lastModified: raw.lastModified ?? raw.updatedAt ?? new Date().toISOString(),
    riskLevel: raw.riskLevel ?? 'Bajo',
    mentorCredits: typeof raw.mentorCredits === 'number' ? raw.mentorCredits : 3,
    step0Status: normalizeStep0Status(raw.step0Status),
  } as unknown as Project;
}

function createLocalProjectDraft(
  name: string,
  description: string | undefined,
  user: User | null,
  teamMembers: TeamMember[],
  options?: { challengeLink?: ProjectChallengeLink },
): Project {
  const now = new Date().toISOString();
  const ownerMember: TeamMember | null = user
    ? { id: user.id, name: user.name, email: user.email, role: 'Owner', status: 'Activo', initials: user.initials }
    : null;

  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    origin: 'manual',
    status: 'Draft',
    currentStep: 0,
    step0Status: 'No iniciado',
    mentorCredits: 3,
    steps: [
      { number: 1, name: 'Entender el problema', status: 'No iniciado', progress: 0, modules: [] },
      { number: 2, name: 'Diseñar la validación', status: 'No iniciado', progress: 0, modules: [] },
      { number: 3, name: 'Ejecutar experimento', status: 'No iniciado', progress: 0, modules: [] },
      { number: 4, name: 'Presentar decisión', status: 'No iniciado', progress: 0, modules: [] },
    ],
    team: ownerMember ? [ownerMember, ...teamMembers] : teamMembers,
    sponsorTouchpoints: DEFAULT_SPONSOR_TOUCHPOINTS,
    sponsorComments: [],
    evidence: [],
    createdAt: now,
    lastModified: now,
    riskLevel: 'Bajo',
    challengeLink: options?.challengeLink,
  };
}

// ADR-028: `portfolio_lead` viaja en el token como los demás roles. Antes se sintetizaba
// aquí comparando el correo del usuario contra un Set (con override por
// VITE_PORTFOLIO_LEAD_EMAIL), lo que hacía que el backend nunca supiera quién era un
// portfolio lead — su JWT decía `viewer` y las escrituras de portafolio devolvían 403.
const BACKEND_TO_FRONTEND_ROLE: Record<string, Role> = {
  participante: 'owner',
  colaborador: 'owner',
  viewer: 'owner',
  mentor: 'mentor',
  admin: 'admin',
  sponsor: 'sponsor',
  portfolio_lead: 'portfolio_lead',
};

// Exportada para test: es la función que decide el rol, y era la única pieza de esta
// cadena sin cobertura (ADR-028).
export function mapBackendUser(raw: AuthUser): User {
  const rawAny = raw as AuthUser & { cohortCode?: string | null };
  const role = BACKEND_TO_FRONTEND_ROLE[raw.role] ?? 'owner';

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role,
    // ADR-029: se filtran a los permisos conocidos por este cliente. Un permiso que
    // el backend conozca y el front no simplemente no se usa — falla cerrado.
    permissions: ((raw.permissions ?? []) as Permission[]).filter((p) =>
      (PERMISSIONS as readonly string[]).includes(p),
    ),
    initials: raw.initials || inferInitials(raw.name),
    skills: [],
    cohort: rawAny.cohortCode ?? raw.cohort ?? '',
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const loadProjects = async (currentUser: User | null) => {
    try {
      setProjectsLoading(true);
      const list = await projectService.list();
      setProjects(list.map(p => enrichProject(p, currentUser)));
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        if (cancelled) return;
        if (getAccessToken()) {
          const me = await authService.getMe();
          if (cancelled) return;
          const mappedUser = mapBackendUser(me);
          setUser(mappedUser);
          setIsAuthenticated(true);
          if (cancelled) return;
          await loadProjects(mappedUser);
        }
      } catch {
        // no session — stay logged out
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (
    email: string,
    password: string,
    options: { loadProjects?: boolean } = {},
  ): Promise<{ success: boolean; waitlisted?: boolean; waitlistedEmail?: string; error?: AuthError }> => {
    try {
      const result = await authService.login(email, password);
      const mappedUser = mapBackendUser(result.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      if (options.loadProjects !== false) {
        await loadProjects(mappedUser);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    options: { loadProjects?: boolean } = {},
  ): Promise<{ success: boolean; waitlisted?: boolean; waitlistedEmail?: string; error?: AuthError }> => {
    try {
      const result = await authService.register(name, email, password);
      if (result.waitlisted || !result.accessToken && !result.tokens?.accessToken) {
        return { success: true, waitlisted: true, waitlistedEmail: result.user.email };
      }
      const mappedUser = mapBackendUser(result.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      if (options.loadProjects !== false) {
        await loadProjects(mappedUser);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const googleSignIn = async (
    idToken: string,
    options: { loadProjects?: boolean } = {},
  ): Promise<{ success: boolean; waitlisted?: boolean; waitlistedEmail?: string; error?: AuthError }> => {
    try {
      const result = await authService.googleSignIn(idToken);
      if (result.waitlisted || !result.accessToken && !result.tokens?.accessToken) {
        return { success: true, waitlisted: true, waitlistedEmail: result.user.email };
      }
      const mappedUser = mapBackendUser(result.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      if (options.loadProjects !== false) {
        await loadProjects(mappedUser);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: parseApiError(err) };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
    setIsAuthenticated(false);
    setCurrentProject(null);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...updates, lastModified: new Date().toISOString() } : p)));
    if (currentProject?.id === id) {
      setCurrentProject(prev => prev ? { ...prev, ...updates, lastModified: new Date().toISOString() } : null);
    }
  };

  const getProjectMember = (projectId: string, email = user?.email ?? ''): TeamMember | null => {
    const project = projects.find(item => item.id === projectId);
    if (!project || !email) return null;
    // Para el usuario actual también vale su userId (el equipo del backend viene sin email).
    const isCurrentUser = !!user && email.toLowerCase() === user.email.toLowerCase();
    return project.team.find(member => isSameTeamMember(member, { id: isCurrentUser ? user.id : undefined, email })) ?? null;
  };

  const canAccessProject = (
    projectId: string,
    accessLevel: 'overview' | 'step' | 'evidence' = 'overview'
  ) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'mentor') return true;
    if (user.role === 'portfolio_lead') return false;

    const member = getProjectMember(projectId, user.email);
    if (!member) return false;

    if (user.role === 'sponsor') {
      if (member.role !== 'Sponsor') return false;
      if (accessLevel === 'overview') return member.status === 'Enviado' || member.status === 'Activo';
      return false;
    }

    return member.status === 'Activo';
  };

  const updateStep0 = (projectId: string, data: Partial<Step0Data>, status: Step0Status) => {
    updateProject(projectId, { step0Data: data, step0Status: status });
  };

  const hydrateProjectStep0FromPrefill = (projectId: string, step0Data: Step0Data) => {
    updateProject(projectId, {
      currentStep: 0,
      step0Status: 'En progreso',
      step0Data,
    });
  };

  const markSponsorInvitationSent = (projectId: string, sponsorEmail: string) => {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      team: project.team.map(member =>
        member.role === 'Sponsor' && member.email.toLowerCase() === sponsorEmail.toLowerCase()
          ? { ...member, status: member.status === 'Activo' ? member.status : 'Enviado' }
          : member
      ),
    });
  };

  const acceptSponsorInvitation = (projectId: string) => {
    if (!user || user.role !== 'sponsor') return;
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      team: project.team.map(member =>
        member.role === 'Sponsor' && member.email.toLowerCase() === user.email.toLowerCase()
          ? { ...member, status: 'Activo' }
          : member
      ),
    });
  };

  const updateSponsorTouchpoint = (
    projectId: string,
    touchpointId: SponsorTouchpointId,
    updates: Partial<SponsorTouchpoint>
  ) => {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      sponsorTouchpoints: (project.sponsorTouchpoints ?? DEFAULT_SPONSOR_TOUCHPOINTS).map(item =>
        item.id === touchpointId ? { ...item, ...updates } : item
      ),
    });
  };

  const addSponsorComment = (projectId: string, touchpointId: SponsorTouchpointId, message: string) => {
    if (!user || user.role !== 'sponsor' || !message.trim()) return;
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    const newComment: SponsorComment = {
      id: `sc-${Date.now()}`,
      touchpointId,
      authorName: user.name,
      authorRole: 'Sponsor',
      message: message.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };

    updateProject(projectId, {
      sponsorComments: [...(project.sponsorComments ?? []), newComment],
      sponsorTouchpoints: (project.sponsorTouchpoints ?? DEFAULT_SPONSOR_TOUCHPOINTS).map(item =>
        item.id === touchpointId ? { ...item, status: 'Comentario enviado' } : item
      ),
    });
  };

  const createProject = async (
    name: string,
    description?: string,
    teamMembers: TeamMember[] = [],
    options?: { challengeLink?: ProjectChallengeLink },
  ): Promise<{ success: true; project: Project } | { success: false; error: string }> => {
    try {
      // Issue #92: forward the reto link so the backend persists InitiativePortfolioMeta
      // (the iniciativa shows up under its reto in the portfolio-lead dashboard).
      const response = await projectService.create({
        name,
        description,
        challengeId: options?.challengeLink?.challengeId,
        challengeLink: options?.challengeLink,
      });
      const ownerMember: TeamMember | null = user
        ? { id: user.id, name: user.name, email: user.email, role: 'Owner', status: 'Activo', initials: user.initials }
        : null;
      const merged = {
        ...response,
        sponsorTouchpoints: DEFAULT_SPONSOR_TOUCHPOINTS,
        sponsorComments: [],
        team: ownerMember ? [ownerMember, ...teamMembers] : teamMembers,
        evidence: (response.evidence as Evidence[] | undefined) ?? [],
        lastModified: (response.lastModified as string | undefined) ?? new Date().toISOString(),
        challengeLink: options?.challengeLink,
      } as unknown as Project;
      setProjects(prev => [merged, ...prev]);
      return { success: true, project: merged };
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.code === 'INTERNAL_ERROR' || parsed.code === 'NETWORK_ERROR') {
        const localProject = createLocalProjectDraft(name, description, user, teamMembers, options);
        setProjects(prev => [localProject, ...prev]);
        return { success: true, project: localProject };
      }

      return {
        success: false,
        error: parsed.message || 'No pudimos guardar tu iniciativa. Intenta de nuevo.',
      };
    }
  };

  const createProjectFromPublicDraft = async (draftId: string): Promise<Project> => {
    if (!user) {
      throw new Error('AUTH_REQUIRED');
    }

    const draft = getPublicDraft(draftId);
    if (!draft) {
      throw new Error('PUBLIC_DRAFT_NOT_FOUND');
    }
    if (draft.status === 'discarded') {
      throw new Error('PUBLIC_DRAFT_DISCARDED');
    }
    if (draft.status === 'converted') {
      throw new Error('PUBLIC_DRAFT_ALREADY_CONVERTED');
    }
    if (draft.status === 'expired' || isPublicDraftExpired(draft)) {
      throw new Error('PUBLIC_DRAFT_EXPIRED');
    }

    const mappedStep0Data = mapPublicDraftToStep0Data(draft);
    const projectName = draft.aiOutput.proposalTitle?.trim() || 'Propuesta de iniciativa';
    const projectDescription = draft.aiOutput.whatToMove?.trim() || draft.inputText;

    const response = await projectService.create({
      name: projectName,
      description: projectDescription,
    });

    const ownerMember: TeamMember = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'Owner',
      status: 'Activo',
      initials: user.initials,
    };

    const createdProject = {
      ...response,
      name: response.name ?? projectName,
      description: response.description ?? projectDescription,
      origin: 'from_public_draft',
      publicDraftContext: {
        draftId: draft.id,
        originalText: draft.inputText,
        suggestedTitle: draft.aiOutput.proposalTitle,
        suggestedSummary: draft.aiOutput.whatToMove,
      },
      currentStep: 0,
      step0Status: 'En progreso',
      step0Data: mappedStep0Data,
      sponsorTouchpoints: DEFAULT_SPONSOR_TOUCHPOINTS,
      sponsorComments: [],
      team: [ownerMember],
      evidence: (response.evidence as Evidence[] | undefined) ?? [],
      lastModified: (response.lastModified as string | undefined) ?? new Date().toISOString(),
    } as unknown as Project;

    saveStep0Prefill(createdProject.id, mappedStep0Data);

    setProjects(prev => [createdProject, ...prev.filter(project => project.id !== createdProject.id)]);
    setCurrentProject(createdProject);

    updatePublicDraft(draft.id, {
      status: 'converted',
      convertedByUserId: user.id,
      convertedProjectId: createdProject.id,
    });

    let pendingConversion: Record<string, unknown> = {};
    if (typeof window !== 'undefined') {
      try {
        pendingConversion = JSON.parse(window.sessionStorage.getItem(PENDING_CONVERSION_KEY) ?? '{}');
      } catch {
        pendingConversion = {};
      }
    }

    writeSessionJson(PENDING_CONVERSION_KEY, {
      ...pendingConversion,
      draftId,
      next: 'convert_to_project_step0',
      status: 'converted',
      projectId: createdProject.id,
      convertedAt: new Date().toISOString(),
    });

    return createdProject;
  };

  const setUserRole = (role: Role) => {
    setUser(prev => prev ? { ...prev, role } : prev);
  };

  return (
    <AppContext.Provider value={{ user, isAuthenticated, authLoading, projects, projectsLoading, currentProject, login, register, googleSignIn, logout, setCurrentProject, updateProject, createProject, createProjectFromPublicDraft, hydrateProjectStep0FromPrefill, setUserRole, updateStep0, getProjectMember, canAccessProject, markSponsorInvitationSent, acceptSponsorInvitation, updateSponsorTouchpoint, addSponsorComment }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
