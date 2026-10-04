import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  MoreVertical,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';
import {
  activationLabel,
  challengeStatusLabel,
  challengeTypeLabel,
  coverageLabel,
  getChallengeActivationReadiness,
  getChallengeActivationRecommendation,
  getChallengeCards,
  getInitiativesByChallengeId,
  initiativeStatusLabel,
  usePortfolioLead,
} from '../../features/portfolio-lead';
import type {
  Challenge,
  ChallengeActivationInputs,
  ChallengeActivationMode,
  ChallengeCoverageStatus,
  ChallengeStatus,
  ChallengeType,
  CreateChallengeInput,
  PortfolioLeadState,
  StakeholderStatus,
  StrategicFront,
} from '../../features/portfolio-lead';
import {
  AISuggestionPanel,
  ContextSummary,
  EmptyState,
  NextAction,
  PageHeader,
} from '../components/design-system/patterns';
import { DomainStatusBadge, type DomainStatus } from '../components/design-system/status';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { PortfolioLeadBreadcrumbs } from '../components/portfolio/PortfolioLeadPageElements';
import { buildLegacyChallengeProjectPath } from '../routes/legacy-route-boundary';

type TabKey = 'all' | 'ready' | 'active' | 'blocked' | 'with_initiatives' | 'decision';
type DrawerMode = 'create' | 'edit' | null;
type DrawerFocus = 'general' | 'owner' | 'sponsor' | 'status';

type ChallengeFormState = {
  name: string;
  strategicFrontId: string;
  challengeType: ChallengeType | '';
  whatWeWantToMove: string;
  objective: string;
  whyNow: string;
  successCriteria: string;
  knownFacts: string;
  openQuestions: string;
  constraints: string;
  dependencies: string;
  expectedDecision: string;
  challengeOwner: string;
  sponsorName: string;
  sponsorEmail: string;
  challengeOwnerStatus: StakeholderStatus;
  sponsorStatus: StakeholderStatus;
  activationMode: ChallengeActivationMode;
  status: ChallengeStatus;
  urgency: ChallengeActivationInputs['urgency'];
  timeAvailable: ChallengeActivationInputs['timeAvailable'];
  estimatedEffort: ChallengeActivationInputs['estimatedEffort'];
  challengeClarity: ChallengeActivationInputs['challengeClarity'];
  informationSensitivity: ChallengeActivationInputs['informationSensitivity'];
  internalCapacity: ChallengeActivationInputs['internalCapacity'];
  technicalNeed: ChallengeActivationInputs['technicalNeed'];
  dependency: ChallengeActivationInputs['dependency'];
  area: string;
  horizon: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof ChallengeFormState, string>>;

type RecommendationCard = {
  id: string;
  kind: string;
  challengeId: string;
  challengeName: string;
  frontName: string;
  whyItMatters: string;
  action: string;
  ctaLabel: string;
  actionKind: 'initiative' | 'edit' | 'owner' | 'sponsor';
  score: number;
};

const TAB_LABELS: Record<TabKey, string> = {
  all: 'Todos',
  ready: 'Por activar',
  active: 'Activos',
  blocked: 'Con bloqueos',
  with_initiatives: 'Con iniciativas',
  decision: 'Pendientes de decisión',
};

const STATUS_OPTIONS: Array<{ value: ChallengeStatus; label: string }> = [
  { value: 'draft', label: 'Borrador' },
  { value: 'listo_para_activar', label: 'Listo para activar' },
  { value: 'activo_interno', label: 'Activando equipo' },
  { value: 'publicado', label: 'Activo' },
  { value: 'recibiendo_iniciativas', label: 'Recibiendo iniciativas' },
  { value: 'con_iniciativas_activas', label: 'En seguimiento' },
  { value: 'pendiente_de_decision', label: 'Pendiente de decisión' },
  { value: 'cerrado', label: 'Cerrado' },
];

const TYPE_OPTIONS: Array<{ value: ChallengeType | ''; label: string }> = [
  { value: '', label: 'Sin clasificar' },
  { value: 'correccion', label: 'Corrección' },
  { value: 'crecimiento', label: 'Crecimiento' },
  { value: 'exploracion', label: 'Exploración' },
];

const ACTIVATION_MODE_OPTIONS: Array<{ value: ChallengeActivationMode; label: string; description: string }> = [
  { value: 'convocatoria_abierta', label: 'Convocatoria abierta', description: 'El reto se abre a participación amplia.' },
  { value: 'personas_seleccionadas', label: 'Personas seleccionadas', description: 'Se invita a perfiles concretos.' },
  { value: 'squad_asignado', label: 'Squad asignado', description: 'Se activa con un squad ya definido.' },
  { value: 'equipo_core_encargado', label: 'Equipo core encargado', description: 'Un equipo mínimo toma el frente.' },
  { value: 'innovacion_abierta_partner_externo', label: 'Innovación abierta / partner externo', description: 'Se requiere capacidad externa o especializada.' },
  { value: 'mantener_en_definicion', label: 'Mantener en definición', description: 'Todavía falta claridad para activarlo.' },
];

const STATUS_STAKEHOLDER_OPTIONS: Array<{ value: StakeholderStatus; label: string }> = [
  { value: 'definido', label: 'Pendiente' },
  { value: 'notificado', label: 'Notificado' },
  { value: 'confirmado', label: 'Confirmado' },
];

const URGENCY_OPTIONS: Array<{ value: ChallengeActivationInputs['urgency']; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const TIME_OPTIONS: Array<{ value: ChallengeActivationInputs['timeAvailable']; label: string }> = [
  { value: 'muy_poco', label: 'Muy poco' },
  { value: 'acotado', label: 'Acotado' },
  { value: 'suficiente', label: 'Suficiente' },
];

const EFFORT_OPTIONS: Array<{ value: ChallengeActivationInputs['estimatedEffort']; label: string }> = [
  { value: 'alto', label: 'Alto' },
  { value: 'medio', label: 'Medio' },
  { value: 'bajo', label: 'Bajo' },
];

const CLARITY_OPTIONS: Array<{ value: ChallengeActivationInputs['challengeClarity']; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const SENSITIVITY_OPTIONS: Array<{ value: ChallengeActivationInputs['informationSensitivity']; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const CAPACITY_OPTIONS: Array<{ value: ChallengeActivationInputs['internalCapacity']; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const TECHNICAL_OPTIONS: Array<{ value: ChallengeActivationInputs['technicalNeed']; label: string }> = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const DEPENDENCY_OPTIONS: Array<{ value: ChallengeActivationInputs['dependency']; label: string }> = [
  { value: 'ninguna', label: 'Ninguna' },
  { value: 'ti', label: 'TI' },
  { value: 'legal', label: 'Legal' },
  { value: 'data', label: 'Data' },
  { value: 'operaciones', label: 'Operaciones' },
  { value: 'comercial', label: 'Comercial' },
];

const HORIZON_OPTIONS = [
  '30 días',
  '60 días',
  '90 días',
  'Trimestre',
  'Semestre',
  'Año',
];

const EMPTY_FORM: ChallengeFormState = {
  name: '',
  strategicFrontId: '',
  challengeType: '',
  whatWeWantToMove: '',
  objective: '',
  whyNow: '',
  successCriteria: '',
  knownFacts: '',
  openQuestions: '',
  constraints: '',
  dependencies: '',
  expectedDecision: '',
  challengeOwner: '',
  sponsorName: '',
  sponsorEmail: '',
  challengeOwnerStatus: 'definido',
  sponsorStatus: 'definido',
  activationMode: 'mantener_en_definicion',
  status: 'draft',
  urgency: 'media',
  timeAvailable: 'acotado',
  estimatedEffort: 'medio',
  challengeClarity: 'media',
  informationSensitivity: 'media',
  internalCapacity: 'media',
  technicalNeed: 'media',
  dependency: 'ninguna',
  area: '',
  horizon: '',
  notes: '',
};

export function PortfolioLeadChallengesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    strategicFronts,
    challenges,
    initiatives,
    initiativeOverlaps,
    portfolioDecisions,
    executiveOutputs,
    createChallenge,
    updateChallenge,
    updateChallengeStakeholderStatus,
  } = usePortfolioLead();

  const domainState = useMemo(
    () => ({
      strategicFronts,
      challenges,
      initiatives,
      initiativeOverlaps,
      portfolioDecisions,
      executiveOutputs,
    }),
    [challenges, executiveOutputs, initiativeOverlaps, initiatives, portfolioDecisions, strategicFronts],
  );

  const challengeCards = useMemo(() => getChallengeCards(domainState), [domainState]);
  const challengeMap = useMemo(() => new Map(challenges.map(challenge => [challenge.id, challenge] as const)), [challenges]);
  const frontMap = useMemo(() => new Map(strategicFronts.map(front => [front.id, front] as const)), [strategicFronts]);
  const challengeRecommendationMap = useMemo(
    () => new Map(challenges.map(challenge => [challenge.id, getChallengeActivationRecommendation(domainState, challenge.id)] as const)),
    [challenges, domainState],
  );

  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [drawerFocus, setDrawerFocus] = useState<DrawerFocus>('general');
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(searchParams.get('challengeId') ?? null);
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [frontFilter, setFrontFilter] = useState(searchParams.get('frontId') ?? 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | ChallengeStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ChallengeType>('all');
  const [coverageFilter, setCoverageFilter] = useState<'all' | ChallengeCoverageStatus>('all');
  const [form, setForm] = useState<ChallengeFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [aiInsight, setAiInsight] = useState<{
    good: string[];
    missing: string[];
    next: string;
  } | null>(null);

  const filteredCards = useMemo(() => {
    const query = normalize(search);

    return challengeCards.filter(card => {
      const challenge = challengeMap.get(card.id);
      if (!challenge) return false;

      if (frontFilter !== 'all' && card.frontId !== frontFilter) return false;
      if (statusFilter !== 'all' && challenge.status !== statusFilter) return false;
      if (typeFilter !== 'all' && challenge.challengeType !== typeFilter) return false;
      if (coverageFilter !== 'all' && card.coverageStatus !== coverageFilter) return false;

      if (tab !== 'all' && !matchesTab(tab, card, challenge)) return false;

      if (!query) return true;

      const sponsor = getChallengeSponsor(challenge, frontMap.get(challenge.strategicFrontId) ?? null);
      const haystack = normalize([
        card.name,
        card.frontName,
        card.challengeTypeLabel,
        sponsor,
        challenge.challengeOwner,
        challenge.whatWeWantToMove,
        challenge.objective,
        challenge.successCriteria,
        card.nextActionDescription,
      ].join(' '));

      return haystack.includes(query);
    });
  }, [challengeCards, challengeMap, coverageFilter, frontFilter, frontMap, search, statusFilter, tab, typeFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      all: challengeCards.length,
      ready: challengeCards.filter(card => card.status === 'draft' || card.status === 'listo_para_activar').length,
      active: challengeCards.filter(card => ['activo_interno', 'publicado', 'recibiendo_iniciativas', 'con_iniciativas_activas'].includes(card.status)).length,
      blocked: challengeCards.filter(card => card.blockedInitiativesCount > 0 || card.coverageStatus === 'sin_cobertura').length,
      with_initiatives: challengeCards.filter(card => card.initiativesCount > 0).length,
      decision: challengeCards.filter(card => card.pendingDecisionsCount > 0).length,
    };
    return counts;
  }, [challengeCards]);

  const frontOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los frentes' },
      ...strategicFronts.map(front => ({ value: front.id, label: front.name })),
    ],
    [strategicFronts],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los estados' },
      ...STATUS_OPTIONS,
    ],
    [],
  );

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: 'Todos los tipos' },
      ...TYPE_OPTIONS.filter(option => option.value !== ''),
    ],
    [],
  );

  const coverageOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas las coberturas' },
      { value: 'sin_cobertura', label: 'Sin cobertura' },
      { value: 'cobertura_parcial', label: 'Cobertura parcial' },
      { value: 'cobertura_suficiente', label: 'Cobertura suficiente' },
      { value: 'resuelto', label: 'Resuelto' },
      { value: 'reformular', label: 'Reformular' },
      { value: 'cerrar', label: 'Cerrar' },
    ],
    [],
  );

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setDrawerFocus('general');
    setEditingChallengeId(null);
    const frontId = frontFilter !== 'all' ? frontFilter : strategicFronts[0]?.id ?? '';
    const front = frontMap.get(frontId) ?? null;
    setForm({
      ...EMPTY_FORM,
      strategicFrontId: frontId,
      sponsorName: front?.sponsor ?? '',
      horizon: front?.horizon ?? '',
      area: front?.area ?? '',
    });
    setFormErrors({});
    setAiInsight(null);
  };

  const openEditDrawer = (challengeId: string, focus: DrawerFocus = 'general') => {
    const challenge = challengeMap.get(challengeId);
    if (!challenge) return;

    setDrawerMode('edit');
    setDrawerFocus(focus);
    setEditingChallengeId(challengeId);
    setForm(mapChallengeToForm(challenge, frontMap.get(challenge.strategicFrontId) ?? null));
    setFormErrors({});
    setAiInsight(null);
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setDrawerFocus('general');
    setEditingChallengeId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setAiInsight(null);
  };

  const applyCreate = (statusOverride?: ChallengeStatus) => {
    const nextStatus = statusOverride ?? form.status;
    const nextErrors = validateChallengeForm(form, nextStatus);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const created = createChallenge(mapFormToCreateInput(form, nextStatus));
    toast.success('Reto creado.');
    setExpandedChallengeId(created.id);
    closeDrawer();
  };

  const applyUpdate = () => {
    const currentChallenge = editingChallengeId ? challengeMap.get(editingChallengeId) ?? null : null;
    if (!editingChallengeId || !currentChallenge) return;

    const nextErrors = validateChallengeForm(form, form.status);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    updateChallenge(editingChallengeId, {
      name: form.name.trim(),
      strategicFrontId: form.strategicFrontId,
      challengeType: form.challengeType,
      whatWeWantToMove: form.whatWeWantToMove.trim(),
      objective: form.objective.trim(),
      whyNow: form.whyNow.trim(),
      successCriteria: form.successCriteria.trim(),
      knownFacts: form.knownFacts.trim(),
      openQuestions: form.openQuestions.trim(),
      constraints: form.constraints.trim(),
      dependencies: form.dependencies.trim(),
      expectedDecision: form.expectedDecision.trim(),
      challengeOwner: form.challengeOwner.trim(),
      sponsorName: form.sponsorName.trim() || undefined,
      sponsorEmail: form.sponsorEmail.trim() || undefined,
      activationMode: form.activationMode,
      status: form.status,
      activationInputs: {
        ...currentChallenge.activationInputs,
        urgency: form.urgency,
        timeAvailable: form.timeAvailable,
        estimatedEffort: form.estimatedEffort,
        challengeClarity: form.challengeClarity,
        informationSensitivity: form.informationSensitivity,
        internalCapacity: form.internalCapacity,
        technicalNeed: form.technicalNeed,
        dependency: form.dependency,
      },
      challengeOwnerStatus: form.challengeOwnerStatus,
      sponsorStatus: form.sponsorStatus,
      area: form.area.trim() || undefined,
      horizon: form.horizon.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    toast.success('Reto actualizado.');
    closeDrawer();
  };

  const updateFrontFilter = (value: string) => {
    setFrontFilter(value);
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs items={[{ label: 'Portfolio Lead', path: '/portfolio/inicio' }, { label: 'Retos' }]} />

      <PageHeader
        eyebrow="Retos"
        title="Retos"
        description="Crea, revisa y actualiza los retos que activan tus frentes estratégicos."
        metadata={[
          { label: 'Retos visibles', value: challengeCards.length },
          { label: 'Filtrados', value: filteredCards.length },
          { label: 'Con iniciativas', value: tabCounts.with_initiatives },
          { label: 'Decisiones pendientes', value: tabCounts.decision },
        ]}
        primaryAction={{
          id: 'create-challenge',
          label: 'Crear nuevo reto',
          ariaLabel: 'Crear nuevo reto',
        }}
        onAction={actionId => {
          if (actionId === 'create-challenge') openCreateDrawer();
        }}
      />

      <ChallengesTabs
        activeTab={tab}
        counts={tabCounts}
        onChange={setTab}
      />

      <ChallengesToolbar
        search={search}
        onSearchChange={setSearch}
        frontFilter={frontFilter}
        onFrontFilterChange={updateFrontFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        coverageFilter={coverageFilter}
        onCoverageFilterChange={setCoverageFilter}
        frontOptions={frontOptions}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        coverageOptions={coverageOptions}
      />
      <section className="mt-6 rounded-ds-lg border border-border-default bg-surface-default p-5 md:p-6">
        <ContextSummary
          density="compact"
          title="Retos creados"
          description="Cada reto muestra su frente estratégico, responsables, avance de iniciativas y estado de cobertura."
          items={[
            { label: 'Total', value: `${challengeCards.length} retos` },
            { label: 'Por activar', value: `${tabCounts.ready}` },
            { label: 'Activos', value: `${tabCounts.active}` },
            { label: 'Con bloqueos', value: `${tabCounts.blocked}` },
            { label: 'Con iniciativas', value: `${tabCounts.with_initiatives}` },
            { label: 'Pendientes de decision', value: `${tabCounts.decision}` },
          ]}
        />

        {filteredCards.length === 0 ? (
          <EmptyChallengesState
            onCreate={openCreateDrawer}
            onClear={() => {
              setSearch('');
              setTab('all');
              setFrontFilter('all');
              setStatusFilter('all');
              setTypeFilter('all');
              setCoverageFilter('all');
            }}
          />
        ) : (
          <div className="mt-5 space-y-4">
            {filteredCards.map(card => {
              const challenge = challengeMap.get(card.id)!;
              const front = frontMap.get(challenge.strategicFrontId) ?? null;
              const recommendation = challengeRecommendationMap.get(challenge.id) ?? null;
              const initiativesForChallenge = getInitiativesByChallengeId(initiatives, challenge.id);
              const isExpanded = expandedChallengeId === challenge.id;

              return (
                <ChallengeListItem
                  key={card.id}
                  card={card}
                  challenge={challenge}
                  front={front}
                  initiatives={initiativesForChallenge}
                  recommendation={recommendation}
                  expanded={isExpanded}
                  onToggleDetail={() => setExpandedChallengeId(current => (current === challenge.id ? null : challenge.id))}
                  onExplore={() => navigate(`/portfolio/iniciativas?challengeId=${encodeURIComponent(card.id)}`)}
                  // KEEP_COMPAT: legacy Challenge -> Project consumer; not canonical Handoff.
                  onCreateInitiative={() => navigate(buildLegacyChallengeProjectPath(challenge.id))}
                  onEdit={() => openEditDrawer(card.id)}
                  onChangeStatus={(nextStatus) => updateChallenge(challenge.id, { status: nextStatus })}
                  onChangeOwnerStatus={(status) => updateChallengeStakeholderStatus(challenge.id, 'challengeOwnerStatus', status)}
                  onChangeSponsorStatus={(status) => updateChallengeStakeholderStatus(challenge.id, 'sponsorStatus', status)}
                  onExploreInitiative={initiativeId => navigate(`/portfolio/iniciativas?challengeId=${encodeURIComponent(challenge.id)}&initiativeId=${encodeURIComponent(initiativeId)}&frontId=${encodeURIComponent(challenge.strategicFrontId)}`)}
                />
              );
            })}
          </div>
        )}
      </section>

      {drawerMode ? (
        <ChallengeFormDrawer
          mode={drawerMode}
          focus={drawerFocus}
          form={form}
          errors={formErrors}
          onClose={closeDrawer}
          onChange={setForm}
          onImproveWithAi={() => setAiInsight(buildFormInsight(form))}
          aiInsight={aiInsight}
          frontOptions={frontOptions.filter(option => option.value !== 'all')}
          onSaveDraft={() => applyCreate('draft')}
          onCreate={() => applyCreate()}
          onSaveChanges={applyUpdate}
        />
      ) : null}
    </div>
  );
}

function ChallengesHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8f5ec_0%,#ffffff_70%,#eef4ff_100%)] p-6 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>RETOS</p>
          <h1 className="mt-2 text-3xl text-slate-950 md:text-4xl" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
            Retos
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            Crea, revisa y actualiza los retos que activan tus frentes estratégicos.
          </p>
        </div>

        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white transition-colors hover:bg-slate-800"
          style={{ fontWeight: 700 }}
        >
          <Plus size={16} />
          Crear nuevo reto
        </button>
      </div>
    </div>
  );
}

function ChallengesTabs({
  activeTab,
  counts,
  onChange,
}: {
  activeTab: TabKey;
  counts: Record<TabKey, number>;
  onChange: (value: TabKey) => void;
}) {
  const tabs: TabKey[] = ['all', 'ready', 'active', 'blocked', 'with_initiatives', 'decision'];

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              activeTab === tab
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
            style={{ fontWeight: 700 }}
          >
            {TAB_LABELS[tab]} ({counts[tab]})
          </button>
        ))}
      </div>
    </section>
  );
}

function ChallengesToolbar({
  search,
  onSearchChange,
  frontFilter,
  onFrontFilterChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  coverageFilter,
  onCoverageFilterChange,
  frontOptions,
  statusOptions,
  typeOptions,
  coverageOptions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  frontFilter: string;
  onFrontFilterChange: (value: string) => void;
  statusFilter: 'all' | ChallengeStatus;
  onStatusFilterChange: (value: 'all' | ChallengeStatus) => void;
  typeFilter: 'all' | ChallengeType;
  onTypeFilterChange: (value: 'all' | ChallengeType) => void;
  coverageFilter: 'all' | ChallengeCoverageStatus;
  onCoverageFilterChange: (value: 'all' | ChallengeCoverageStatus) => void;
  frontOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  typeOptions: Array<{ value: string; label: string }>;
  coverageOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr]">
        <SearchField value={search} onChange={onSearchChange} placeholder="Buscar por reto, frente, sponsor o challenge owner" />
        <SelectField label="Frente estratégico" value={frontFilter} onChange={onFrontFilterChange} options={frontOptions} />
        <SelectField label="Estado" value={statusFilter} onChange={value => onStatusFilterChange(value as 'all' | ChallengeStatus)} options={statusOptions} />
        <SelectField label="Tipo de reto" value={typeFilter} onChange={value => onTypeFilterChange(value as 'all' | ChallengeType)} options={typeOptions} />
        <SelectField label="Cobertura" value={coverageFilter} onChange={value => onCoverageFilterChange(value as 'all' | ChallengeCoverageStatus)} options={coverageOptions} />
      </div>
    </section>
  );
}

function ChallengeListItem({
  card,
  challenge,
  front,
  initiatives,
  recommendation,
  expanded,
  onToggleDetail,
  onExplore,
  onCreateInitiative,
  onEdit,
  onChangeStatus,
  onChangeOwnerStatus,
  onChangeSponsorStatus,
  onExploreInitiative,
}: {
  card: ReturnType<typeof getChallengeCards>[number];
  challenge: Challenge;
  front: StrategicFront | null;
  initiatives: ReturnType<typeof getInitiativesByChallengeId>;
  recommendation: ReturnType<typeof getChallengeActivationRecommendation> | null;
  expanded: boolean;
  onToggleDetail: () => void;
  onExplore: () => void;
  onCreateInitiative: () => void;
  onEdit: () => void;
  onChangeStatus: (status: ChallengeStatus) => void;
  onChangeOwnerStatus: (status: StakeholderStatus) => void;
  onChangeSponsorStatus: (status: StakeholderStatus) => void;
  onExploreInitiative: (initiativeId: string) => void;
}) {
  const sponsor = getChallengeSponsor(challenge, front);
  const metric = getChallengeMetricSnapshot(challenge, front);
  const lastUpdated = challenge.lastUpdatedAt ? formatRelativeDate(challenge.lastUpdatedAt) : formatRelativeDate(challenge.createdAt);
  const progress = getChallengeAverageProgress(initiatives);
  const activeCount = initiatives.filter(initiative => !['bloqueada', 'cerrada'].includes(initiative.status)).length;

  return (
    <article className="overflow-hidden rounded-ds-lg border border-border-default bg-surface-default">
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>RETO</p>
              <h3 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{card.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{card.whatWeWantToMove}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-500 md:pt-1" style={{ fontWeight: 700 }}>{lastUpdated}</span>
          </div>

          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-700">Frente estratégico:</span> {card.frontName}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-semibold text-slate-700">Sponsor:</span> {sponsor}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-semibold text-slate-700">Challenge owner:</span> {challenge.challengeOwner || 'Sin definir'}
          </p>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-700" style={{ fontWeight: 700 }}>Métrica que busca mover</p>
                <p className="mt-1 text-sm text-slate-600">Las iniciativas asociadas a este reto buscan reducir esta brecha.</p>
              </div>
              <span className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Horizonte: {metric.horizon}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="KPI principal" value={metric.kpi} />
              <MiniMetric label="Baseline" value={metric.baseline} />
              <MiniMetric label="Meta" value={metric.target} />
              <MiniMetric label="Estado actual" value={metric.current} />
            </div>
          </section>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-700" style={{ fontWeight: 700 }}>Avance operativo de las iniciativas</p>
              <span className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{progress}%</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Promedio de avance de las iniciativas vinculadas a este reto. No representa todavía impacto real en la métrica.</p>
            <Progress value={progress} aria-label={`Avance operativo ${progress}%`} className="mt-3" />
            <p className="mt-2 text-xs text-slate-500">
              {card.initiativesCount} iniciativas asociadas · {activeCount} activas · {card.blockedInitiativesCount} bloqueadas
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MiniMetric label="Iniciativas asociadas" value={`${card.initiativesCount}`} />
            <MiniMetric label="Activas" value={`${activeCount}`} />
            <MiniMetric label="Bloqueadas" value={`${card.blockedInitiativesCount}`} />
            <MiniMetric label="Listas para decisión" value={`${card.pendingDecisionsCount}`} />
            <MiniMetric label="Cobertura" value={card.coverageLabel} />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              onClick={onToggleDetail}
            >
              <Eye size={15} />
              {expanded ? 'Ocultar detalle' : 'Ver detalle'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
            >
              <PencilLine size={15} />
              Editar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onExplore}
            >
              Ver iniciativas
              <ArrowRight size={15} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onCreateInitiative}
              data-testid="create-initiative-from-challenge"
            >
              Crear iniciativa{challenge.assignedSquad.length > 0 ? ' con este squad' : ''}
              <ArrowRight size={15} />
            </Button>
            <details className="group relative">
              <summary className="list-none">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  style={{ fontWeight: 700 }}
                >
                  <MoreVertical size={15} />
                  Más acciones
                </button>
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <MenuAction onClick={() => onChangeStatus('listo_para_activar')}>Cambiar estado</MenuAction>
                <MenuAction onClick={() => onChangeOwnerStatus('confirmado')}>Cambiar challenge owner</MenuAction>
                <MenuAction onClick={() => onChangeSponsorStatus('confirmado')}>Cambiar sponsor</MenuAction>
                <MenuAction onClick={() => onChangeStatus('activo_interno')}>Pausar reto</MenuAction>
                <MenuAction onClick={() => onChangeStatus('cerrado')}>Cerrar reto</MenuAction>
              </div>
            </details>
          </div>
        </div>
      </div>

      {expanded ? (
        <ChallengeAccordionDetail
          card={card}
          challenge={challenge}
          front={front}
          initiatives={initiatives}
          recommendation={recommendation}
          onChangeStatus={onChangeStatus}
          onChangeOwnerStatus={onChangeOwnerStatus}
          onChangeSponsorStatus={onChangeSponsorStatus}
          onExploreInitiative={onExploreInitiative}
          onEdit={onEdit}
          onExplore={onExplore}
          onCreateInitiative={onCreateInitiative}
        />
      ) : null}
    </article>
  );
}

function ChallengeAccordionDetail({
  card,
  challenge,
  front,
  initiatives,
  recommendation,
  onChangeStatus,
  onChangeOwnerStatus,
  onChangeSponsorStatus,
  onExploreInitiative,
  onEdit,
  onExplore,
  onCreateInitiative,
}: {
  card: ReturnType<typeof getChallengeCards>[number];
  challenge: Challenge;
  front: StrategicFront | null;
  initiatives: ReturnType<typeof getInitiativesByChallengeId>;
  recommendation: ReturnType<typeof getChallengeActivationRecommendation> | null;
  onChangeStatus: (status: ChallengeStatus) => void;
  onChangeOwnerStatus: (status: StakeholderStatus) => void;
  onChangeSponsorStatus: (status: StakeholderStatus) => void;
  onExploreInitiative: (initiativeId: string) => void;
  onEdit: () => void;
  onExplore: () => void;
  onCreateInitiative: () => void;
}) {
  const sponsor = getChallengeSponsor(challenge, front);
  const statusTags = [
    'Frente estratégico',
    challengeStatusLabel(challenge.status),
    challengeTypeLabel(challenge.challengeType),
    activationLabel(challenge.activationMode),
    coverageLabel(challenge.coverageStatus),
  ];
  const metric = getChallengeMetricSnapshot(challenge, front);
  const urgency = labelUrgency(challenge.activationInputs.urgency);

  return (
    <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-5 md:px-6">
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Detalle del reto</p>
              <p className="mt-1 text-sm text-slate-600">Apertura ejecutiva del reto y sus condiciones actuales.</p>
            </div>

            <DetailBlock
              title="Condición general"
              items={[
                ['Estado del reto', challengeStatusLabel(challenge.status)],
                ['Tipo de reto', challengeTypeLabel(challenge.challengeType)],
                ['Frente estratégico padre', front?.name ?? 'Sin frente visible'],
                ['Modalidad de activación', activationLabel(challenge.activationMode)],
                ['Estado de cobertura', coverageLabel(challenge.coverageStatus)],
                ['KPI o señal principal', challenge.successCriteria || challenge.objective || 'Sin señal visible'],
                ['Urgencia', urgency],
                ['Sponsor', sponsor || 'Sin definir'],
                ['Challenge owner', challenge.challengeOwner || 'Sin definir'],
                ['Última actualización', challenge.lastUpdatedAt ? formatRelativeDate(challenge.lastUpdatedAt) : formatRelativeDate(challenge.createdAt)],
              ]}
            />

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Métrica que busca mover</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DetailStat label="KPI principal" value={metric.kpi} />
                <DetailStat label="Baseline" value={metric.baseline} />
                <DetailStat label="Meta esperada" value={metric.target} />
                <DetailStat label="Estado actual" value={metric.current} />
                <DetailStat label="Horizonte" value={metric.horizon} />
              </div>
              <p className="mt-3 text-sm text-slate-600">Las iniciativas asociadas buscan mover esta métrica, no solo avanzar etapas internas.</p>
            </section>

            <div className="flex flex-wrap gap-2">
              {statusTags.map(tag => (
                <Pill key={tag} tone="slate">{tag}</Pill>
              ))}
              {challenge.blockedInitiativesCount > 0 ? <Pill tone="rose">{challenge.blockedInitiativesCount} bloqueo{challenge.blockedInitiativesCount === 1 ? '' : 's'}</Pill> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => onChangeStatus('activo_interno')}>Cambiar estado</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onChangeSponsorStatus('confirmado')}>Cambiar sponsor</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onChangeOwnerStatus('confirmado')}>Cambiar challenge owner</Button>
            </div>
          </div>
        </section>

        <ActivationInvitationHandoffPanel
          card={card}
          challenge={challenge}
          front={front}
          recommendation={recommendation}
          onCreateInitiative={onCreateInitiative}
          onEdit={onEdit}
        />

        <ChallengeInitiativesPreview initiatives={initiatives} onExploreInitiative={onExploreInitiative} />

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Contribución de iniciativas a la métrica</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {initiatives.length === 0 ? (
              <li>No hay iniciativas asociadas todavía.</li>
            ) : (
              initiatives.slice(0, 4).map(initiative => (
                <li key={initiative.id} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-slate-400" />
                  <span>
                    <span className="font-semibold text-slate-900">{initiative.name}</span>
                    {' '}? {getInitiativeContributionToMetric(initiative)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        {recommendation ? (
          <ChallengeRecommendationBlock
            recommendation={recommendation}
            challenge={challenge}
            card={card}
            onEdit={onEdit}
            onExplore={onExplore}
          />
        ) : null}
      </div>
    </div>
  );
}

function ChallengeInitiativesPreview({
  initiatives,
  onExploreInitiative,
}: {
  initiatives: ReturnType<typeof getInitiativesByChallengeId>;
  onExploreInitiative: (initiativeId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Iniciativas asociadas</p>
          <p className="mt-1 text-sm text-slate-600">Resumen compacto de las iniciativas vinculadas a este reto.</p>
        </div>
      </div>

      {initiatives.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Aún no hay iniciativas asociadas a este reto.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
            <div className="min-w-[1220px]">
              <div className="grid grid-cols-[1.5fr_1fr_0.7fr_0.7fr_1.2fr_0.9fr_1.1fr_1fr_0.8fr] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
              <span>Iniciativa</span>
              <span>Owner</span>
              <span>Step actual</span>
              <span>Avance</span>
              <span>Contribución a la métrica</span>
              <span>Estado</span>
              <span>Comentarios recientes</span>
              <span>Alerta</span>
              <span>Acción</span>
              </div>
              <div className="divide-y divide-slate-200 bg-white">
              {initiatives.map(initiative => {
                const progress = getInitiativeProgressPercent(initiative);
                const stateLabel = getInitiativeOperationalStateLabel(initiative);
                const contribution = getInitiativeContributionToMetric(initiative);
                const recentComment = initiative.aiCommentSummary || initiative.mentorCommentSummary || initiative.lastActivity;
                const alert = initiative.mainAlert || initiative.mainBlocker || 'Sin alertas visibles';
                return (
                  <div key={initiative.id} className="grid grid-cols-[1.5fr_1fr_0.7fr_0.7fr_1.2fr_0.9fr_1.1fr_1fr_0.8fr] items-start gap-0 px-4 py-4 text-sm text-slate-700">
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-slate-950">{initiative.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{initiative.signalSummary}</p>
                    </div>
                    <div className="pr-3">{initiative.teamOwner}</div>
                    <div className="pr-3">{initiative.currentStep}</div>
                    <div className="pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{progress}%</span>
                      </div>
                    </div>
                    <div className="pr-3 text-xs text-slate-600">{contribution}</div>
                    <div className="pr-3"><Pill tone={initiative.status === 'bloqueada' ? 'rose' : initiative.status === 'lista_para_decision' ? 'violet' : initiative.status === 'cerrada' ? 'slate' : 'emerald'}>{stateLabel}</Pill></div>
                    <div className="pr-3 text-xs text-slate-600">{recentComment}</div>
                    <div className={`pr-3 text-xs ${initiative.status === 'bloqueada' ? 'text-rose-700' : 'text-slate-600'}`}>{alert}</div>
                    <button type="button" onClick={() => onExploreInitiative(initiative.id)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100">Ver más</button>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:hidden">
            {initiatives.map(initiative => {
              const progress = getInitiativeProgressPercent(initiative);
              const stateLabel = getInitiativeOperationalStateLabel(initiative);
              const contribution = getInitiativeContributionToMetric(initiative);
              const recentComment = initiative.aiCommentSummary || initiative.mentorCommentSummary || initiative.lastActivity;
              const alert = initiative.mainAlert || initiative.mainBlocker || 'Sin alertas visibles';
              return (
                <div key={initiative.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">{initiative.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Owner: {initiative.teamOwner}</p>
                    </div>
                    <button type="button" onClick={() => onExploreInitiative(initiative.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Ver más</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-700">
                    <MiniMetric label="Step" value={initiative.currentStep} />
                    <MiniMetric label="Avance" value={`${progress}%`} />
                    <MiniMetric label="Estado" value={stateLabel} />
                    <MiniMetric label="Contribución" value={contribution} />
                  </div>
                  <p className="mt-3 text-xs text-slate-600">Comentario: {recentComment}</p>
                  {initiative.status === 'bloqueada' ? <p className="mt-2 text-xs text-rose-700">Alerta: {alert}</p> : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function ChallengeRecommendationBlock({
  recommendation,
  challenge,
  card,
  onEdit,
  onExplore,
}: {
  recommendation: ReturnType<typeof getChallengeActivationRecommendation>;
  challenge: Challenge;
  card: ReturnType<typeof getChallengeCards>[number];
  onEdit: () => void;
  onExplore: () => void;
}) {
  const ctaLabel = getRecommendationActionLabel(challenge, card, recommendation);

  return (
    <AISuggestionPanel
      title="Starteria sugiere revisar este reto"
      suggestion={recommendation.nextSteps[0] ?? recommendation.justification}
      why={[
        recommendation.justification,
        recommendation.risks[0] ?? 'El reto puede quedarse sin cobertura suficiente o perder tracción.',
        recommendation.nextSteps[0] ?? 'Revisar la definición del reto y su modalidad de activación.',
      ]}
      provenance={[
        { label: 'Modalidad sugerida', value: recommendation.recommendedModeLabel },
        { label: 'Cobertura visible', value: card.coverageLabel },
      ]}
      actions={[
        { id: 'explore', label: ctaLabel },
        { id: 'edit', label: 'Editar reto', tone: 'secondary' },
      ]}
      onAction={actionId => {
        if (actionId === 'explore') onExplore();
        if (actionId === 'edit') onEdit();
      }}
    />
  );
}

function ActivationInvitationHandoffPanel({
  card,
  challenge,
  front,
  recommendation,
  onCreateInitiative,
  onEdit,
}: {
  card: ReturnType<typeof getChallengeCards>[number];
  challenge: Challenge;
  front: StrategicFront | null;
  recommendation: ReturnType<typeof getChallengeActivationRecommendation> | null;
  onCreateInitiative: () => void;
  onEdit: () => void;
}) {
  const invitationCounts = summarizeInvitations(challenge.selectedPeople);
  const readinessStatus = activationStateStatus(card.activationState);
  const publicationStatus: DomainStatus = challenge.visibleToParticipants ? 'active' : 'draft';

  return (
    <section className="rounded-ds-md border border-border-default bg-surface-default p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-text-muted">Activacion e invitacion</p>
          <h4 className="mt-1 text-base font-semibold text-text-primary">Handoff del reto antes de crear iniciativas</h4>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            La pantalla muestra la modalidad, visibilidad y personas suministradas por el estado actual del reto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DomainStatusBadge status={readinessStatus} label={card.activationStateLabel} />
          <DomainStatusBadge status={publicationStatus} label={challenge.visibleToParticipants ? 'Visible' : 'No publicado'} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <ContextSummary
          density="compact"
          title="Contexto de activacion"
          description="Datos existentes del reto. La presentacion no recalcula readiness ni modalidad."
          items={[
            { label: 'Modalidad', value: activationLabel(challenge.activationMode), metadata: recommendation ? `Starteria sugiere: ${recommendation.recommendedModeLabel}` : undefined },
            { label: 'Estado del reto', value: challengeStatusLabel(challenge.status), metadata: card.activationStateLabel },
            { label: 'Frente', value: front?.name ?? 'Sin frente visible', metadata: front?.mainKpi ? `KPI: ${front.mainKpi}` : undefined },
            { label: 'Challenge owner', value: challenge.challengeOwner || 'Sin definir', metadata: stakeholderStatusLabel(challenge.challengeOwnerStatus) },
            { label: 'Sponsor', value: getChallengeSponsor(challenge, front), metadata: stakeholderStatusLabel(challenge.sponsorStatus) },
            { label: 'Publicacion', value: challenge.publicationNotes || 'Sin nota de publicacion', metadata: challenge.lastPublishedAt ? `Publicado: ${formatRelativeDate(challenge.lastPublishedAt)}` : undefined },
          ]}
        />

        <div className="space-y-4">
          <PeopleHandoffList
            title="Personas invitadas"
            emptyLabel="No hay personas seleccionadas para invitacion."
            items={challenge.selectedPeople.map(person => ({
              id: person.id,
              value: person.value,
              status: person.status,
            }))}
          />
          <SquadHandoffList
            title="Squad asignado"
            emptyLabel="No hay squad asignado."
            items={challenge.assignedSquad}
          />
        </div>
      </div>

      {recommendation ? (
        <AISuggestionPanel
          className="mt-4"
          title="Starteria recomienda una ruta de activacion"
          suggestion={recommendation.recommendedModeLabel}
          why={[
            recommendation.justification,
            recommendation.missingItems[0] ?? 'No hay faltantes criticos visibles en esta recomendacion.',
            recommendation.nextSteps[0] ?? 'Revisar modalidad y contexto antes de activar.',
          ]}
          provenance={[
            { label: 'Confianza', value: `${recommendation.confidenceLabel} (${Math.round(recommendation.confidenceScore * 100)}%)` },
            { label: 'Riesgo sponsor', value: recommendation.sponsorRisk ? 'Visible' : 'Sin riesgo visible' },
            { label: 'Invitaciones', value: `${invitationCounts.total} registradas` },
          ]}
          actions={[
            { id: 'edit-activation', label: 'Revisar activacion', tone: 'secondary' },
          ]}
          onAction={actionId => {
            if (actionId === 'edit-activation') onEdit();
          }}
        />
      ) : null}

      <NextAction
        className="mt-4"
        eyebrow="Handoff"
        title="Crear iniciativa desde este reto"
        description="Usa el flujo existente para convertir este reto en una iniciativa. La aceptacion o creacion no confirma Step 0 ni completa la alineacion estrategica."
        context={
          <div className="space-y-2">
            <p>{'Ruta explicativa posterior: Overview -> Step 0 -> Step 1 -> Step 2 -> Step 3 -> Step 4.'}</p>
            <p>Contexto heredado: {front?.name ?? 'frente no visible'} / {challenge.name} / {activationLabel(challenge.activationMode)}.</p>
          </div>
        }
        status={<Badge variant="neutral">{invitationCounts.label}</Badge>}
        primaryAction={{
          id: 'create-initiative-from-handoff',
          label: challenge.assignedSquad.length > 0 ? 'Crear iniciativa con este squad' : 'Crear iniciativa',
          ariaLabel: `Crear iniciativa desde ${challenge.name}`,
        }}
        secondaryAction={{ id: 'edit-activation', label: 'Revisar activacion', tone: 'secondary' }}
        onAction={actionId => {
          if (actionId === 'create-initiative-from-handoff') onCreateInitiative();
          if (actionId === 'edit-activation') onEdit();
        }}
      />
    </section>
  );
}

function PeopleHandoffList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ id: string; value: string; status: Challenge['selectedPeople'][number]['status'] }>;
}) {
  return (
    <section className="rounded-ds-md border border-border-default bg-background-subtle p-4">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-text-primary">{title}</h5>
        <Badge variant="neutral">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(item => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-ds-sm border border-border-default bg-surface-default p-3">
              <span className="min-w-0 text-sm font-medium text-text-primary">{item.value}</span>
              <DomainStatusBadge status={invitationStatusStatus(item.status)} label={invitationStatusLabel(item.status)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SquadHandoffList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Challenge['assignedSquad'];
}) {
  return (
    <section className="rounded-ds-md border border-border-default bg-background-subtle p-4">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-text-primary">{title}</h5>
        <Badge variant="neutral">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(item => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-ds-sm border border-border-default bg-surface-default p-3">
              <span className="min-w-0 text-sm font-medium text-text-primary">{item.value}</span>
              <Badge variant="secondary">{item.role === 'lider' ? 'Lider' : 'Colaborador'}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-1 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function getChallengeAverageProgress(initiatives: ReturnType<typeof getInitiativesByChallengeId>) {
  if (initiatives.length === 0) return 0;
  const total = initiatives.reduce((sum, initiative) => sum + getInitiativeProgressPercent(initiative), 0);
  return Math.round(total / initiatives.length);
}

function getChallengeActiveInitiativesCount(initiatives: ReturnType<typeof getInitiativesByChallengeId>) {
  return initiatives.filter(initiative => !['bloqueada', 'cerrada'].includes(initiative.status)).length;
}

function getInitiativeProgressPercent(initiative: ReturnType<typeof getInitiativesByChallengeId>[number]) {
  if (initiative.status === 'cerrada') return 100;
  switch (initiative.currentStep) {
    case 'Step 0': return 15;
    case 'Step 1': return 35;
    case 'Step 2': return 55;
    case 'Step 3': return 75;
    case 'Step 4': return 90;
    default: return 0;
  }
}

function getChallengeMetricSnapshot(challenge: Challenge, front: StrategicFront | null) {
  return {
    kpi: front?.mainKpi || challenge.successCriteria || 'Sin KPI visible',
    baseline: front?.baseline || 'Sin baseline visible',
    target: front?.target || challenge.successCriteria || 'Sin meta visible',
    current: challenge.currentMetricValue || 'Sin dato visible',
    horizon: challenge.horizon || front?.horizon || 'Sin horizonte visible',
  };
}

function getInitiativeContributionToMetric(initiative: ReturnType<typeof getInitiativesByChallengeId>[number]) {
  return initiative.signalSummary
    || initiative.hypothesisCovered
    || initiative.attackedArea
    || initiative.mainMetric
    || 'Contribución aún no explícita';
}

function getInitiativeOperationalStateLabel(initiative: ReturnType<typeof getInitiativesByChallengeId>[number]) {
  if (initiative.status === 'bloqueada') return 'Bloqueada';
  if (initiative.status === 'lista_para_decision' || initiative.readyForDecision || initiative.currentStep === 'Step 4') return 'Lista para decisión';
  if (initiative.status === 'cerrada') return 'Cerrada';
  return 'En curso';
}

function getRecommendationActionLabel(
  challenge: Challenge,
  card: ReturnType<typeof getChallengeCards>[number],
  recommendation: ReturnType<typeof getChallengeActivationRecommendation>,
) {
  if (card.blockedInitiativesCount > 0) return 'Resolver bloqueo';
  if (challenge.status === 'draft' || challenge.status === 'listo_para_activar') return 'Activar reto';
  if (card.pendingDecisionsCount > 0) return 'Revisar decisión';
  if (recommendation.recommendedMode !== challenge.activationMode) return 'Reformular reto';
  return 'Ver iniciativas';
}

function ChallengeFormDrawer({
  mode,
  focus,
  form,
  errors,
  aiInsight,
  onClose,
  onChange,
  onImproveWithAi,
  frontOptions,
  onSaveDraft,
  onCreate,
  onSaveChanges,
}: {
  mode: DrawerMode;
  focus: DrawerFocus;
  form: ChallengeFormState;
  errors: FormErrors;
  aiInsight: { good: string[]; missing: string[]; next: string } | null;
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<ChallengeFormState>>;
  onImproveWithAi: () => void;
  frontOptions: Array<{ value: string; label: string }>;
  onSaveDraft: () => void;
  onCreate: () => void;
  onSaveChanges: () => void;
}) {
  const title = mode === 'edit' ? 'Editar reto' : 'Crear nuevo reto';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 md:p-6">
      <div className="ml-auto flex h-full w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex h-full w-full flex-col overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>
                  {mode === 'edit' ? 'EDITAR RETO' : 'CREAR NUEVO RETO'}
                </p>
                <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{title}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Convierte un frente estratégico en un problema, oportunidad o exploración accionable.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {focus !== 'general' ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {focus === 'owner'
                  ? 'Atajo abierto: revisa challenge owner y estado del responsable.'
                  : focus === 'sponsor'
                    ? 'Atajo abierto: revisa sponsor y estado del sponsor.'
                    : 'Atajo abierto: revisa estado, modalidad y señal principal del reto.'}
              </div>
            ) : null}
          </div>

          <div className="grid flex-1 gap-0 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="border-r border-slate-200 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <TextField
                  label="Nombre del reto"
                  required
                  value={form.name}
                  onChange={value => onChange(prev => ({ ...prev, name: value }))}
                  placeholder="Ej. Reducir fricción en onboarding interno"
                  helper="Nombra el problema, oportunidad o exploración de forma clara."
                  error={errors.name}
                />
                <SelectField
                  label="Frente estratégico asociado"
                  required
                  value={form.strategicFrontId}
                  onChange={value => {
                    onChange(prev => {
                      return {
                        ...prev,
                        strategicFrontId: value,
                      };
                    });
                  }}
                  options={frontOptions}
                  error={errors.strategicFrontId}
                />
                <SelectField
                  label="Tipo de reto"
                  required
                  value={form.challengeType}
                  onChange={value => onChange(prev => ({ ...prev, challengeType: value as ChallengeType | '' }))}
                  options={TYPE_OPTIONS}
                  error={errors.challengeType}
                />
                <SelectField
                  label="Estado"
                  required
                  value={form.status}
                  onChange={value => onChange(prev => ({ ...prev, status: value as ChallengeStatus }))}
                  options={STATUS_OPTIONS}
                  error={errors.status}
                />
                <TextField
                  label="Challenge owner"
                  required
                  value={form.challengeOwner}
                  onChange={value => onChange(prev => ({ ...prev, challengeOwner: value }))}
                  placeholder="Nombre del responsable"
                  error={errors.challengeOwner}
                />
                <TextField
                  label="Sponsor"
                  value={form.sponsorName}
                  onChange={value => onChange(prev => ({ ...prev, sponsorName: value }))}
                  placeholder="Nombre del sponsor"
                  helper="El sponsor puede quedar pendiente; se mostrará como riesgo si no está confirmado."
                />
                <TextField
                  label="Email del sponsor"
                  value={form.sponsorEmail}
                  onChange={value => onChange(prev => ({ ...prev, sponsorEmail: value }))}
                  placeholder="sponsor@empresa.com"
                />
                <SelectField
                  label="Estado del challenge owner"
                  value={form.challengeOwnerStatus}
                  onChange={value => onChange(prev => ({ ...prev, challengeOwnerStatus: value as StakeholderStatus }))}
                  options={STATUS_STAKEHOLDER_OPTIONS}
                />
                <SelectField
                  label="Estado del sponsor"
                  value={form.sponsorStatus}
                  onChange={value => onChange(prev => ({ ...prev, sponsorStatus: value as StakeholderStatus }))}
                  options={STATUS_STAKEHOLDER_OPTIONS}
                />
              </div>

              <div className="mt-5 grid gap-5">
                <TextAreaField
                  label="Qué busca mover"
                  required
                  value={form.whatWeWantToMove}
                  onChange={value => onChange(prev => ({ ...prev, whatWeWantToMove: value }))}
                  placeholder="Qué cambio concreto quieres mover con este reto."
                  error={errors.whatWeWantToMove}
                />
                <TextAreaField
                  label="Por qué importa ahora"
                  required
                  value={form.whyNow}
                  onChange={value => onChange(prev => ({ ...prev, whyNow: value }))}
                  placeholder="Explica la urgencia o razón de negocio."
                  error={errors.whyNow}
                />
                <TextAreaField
                  label="Objetivo"
                  required
                  value={form.objective}
                  onChange={value => onChange(prev => ({ ...prev, objective: value }))}
                  placeholder="Describe el resultado esperado del reto."
                  error={errors.objective}
                />
                <TextField
                  label="KPI o señal principal"
                  required
                  value={form.successCriteria}
                  onChange={value => onChange(prev => ({ ...prev, successCriteria: value }))}
                  placeholder="Ej. Bajar de 12 a 6 días el tiempo de habilitación completa"
                  helper="Usa un indicador que te permita ver avance."
                  error={errors.successCriteria}
                />
              </div>

              {/* Challenge Constraint Envelope (Core §14.1, E2E Job-Driven §15): lo que necesita
                  quien recibe el reto para entender qué respuesta tiene sentido. Todo opcional. */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Lo que debe saber quien recibe el reto</p>
                <p className="mt-1 text-xs text-slate-500">Opcional. Las iniciativas del reto lo heredan y lo ven antes de empezar.</p>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <TextAreaField
                    label="Qué se sabe"
                    value={form.knownFacts}
                    onChange={value => onChange(prev => ({ ...prev, knownFacts: value }))}
                    placeholder="Datos, señales o resultados que ya existen."
                  />
                  <TextAreaField
                    label="Qué está abierto"
                    value={form.openQuestions}
                    onChange={value => onChange(prev => ({ ...prev, openQuestions: value }))}
                    placeholder="Lo que todavía no sabemos y podría cambiar la respuesta."
                  />
                  <TextAreaField
                    label="Restricciones"
                    value={form.constraints}
                    onChange={value => onChange(prev => ({ ...prev, constraints: value }))}
                    placeholder="Lo que ninguna iniciativa de este reto puede romper."
                  />
                  <TextAreaField
                    label="Dependencias"
                    value={form.dependencies}
                    onChange={value => onChange(prev => ({ ...prev, dependencies: value }))}
                    placeholder="Sistemas, equipos o decisiones de las que depende."
                  />
                  <TextAreaField
                    label="Decisión esperada al final"
                    value={form.expectedDecision}
                    onChange={value => onChange(prev => ({ ...prev, expectedDecision: value }))}
                    placeholder="Qué decisión futura necesita evidencia de este reto."
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Urgencia"
                  required
                  value={form.urgency}
                  onChange={value => onChange(prev => ({ ...prev, urgency: value as ChallengeActivationInputs['urgency'] }))}
                  options={URGENCY_OPTIONS}
                  error={errors.urgency}
                />
                <TextField
                  label="Horizonte"
                  required
                  value={form.horizon}
                  onChange={value => onChange(prev => ({ ...prev, horizon: value }))}
                  placeholder="Ej. 60 días, Q3 2026, trimestre"
                  helper="Define el marco temporal del reto."
                  error={errors.horizon}
                />
                <SelectField
                  label="Tiempo disponible"
                  value={form.timeAvailable}
                  onChange={value => onChange(prev => ({ ...prev, timeAvailable: value as ChallengeActivationInputs['timeAvailable'] }))}
                  options={TIME_OPTIONS}
                />
                <SelectField
                  label="Esfuerzo estimado"
                  value={form.estimatedEffort}
                  onChange={value => onChange(prev => ({ ...prev, estimatedEffort: value as ChallengeActivationInputs['estimatedEffort'] }))}
                  options={EFFORT_OPTIONS}
                />
                <SelectField
                  label="Claridad del reto"
                  value={form.challengeClarity}
                  onChange={value => onChange(prev => ({ ...prev, challengeClarity: value as ChallengeActivationInputs['challengeClarity'] }))}
                  options={CLARITY_OPTIONS}
                />
                <SelectField
                  label="Sensibilidad de información"
                  value={form.informationSensitivity}
                  onChange={value => onChange(prev => ({ ...prev, informationSensitivity: value as ChallengeActivationInputs['informationSensitivity'] }))}
                  options={SENSITIVITY_OPTIONS}
                />
                <SelectField
                  label="Capacidad interna"
                  value={form.internalCapacity}
                  onChange={value => onChange(prev => ({ ...prev, internalCapacity: value as ChallengeActivationInputs['internalCapacity'] }))}
                  options={CAPACITY_OPTIONS}
                />
                <SelectField
                  label="Necesidad técnica"
                  value={form.technicalNeed}
                  onChange={value => onChange(prev => ({ ...prev, technicalNeed: value as ChallengeActivationInputs['technicalNeed'] }))}
                  options={TECHNICAL_OPTIONS}
                />
                <SelectField
                  label="Dependencia"
                  value={form.dependency}
                  onChange={value => onChange(prev => ({ ...prev, dependency: value as ChallengeActivationInputs['dependency'] }))}
                  options={DEPENDENCY_OPTIONS}
                />
                <SelectField
                  label="Modalidad de activación"
                  value={form.activationMode}
                  onChange={value => onChange(prev => ({ ...prev, activationMode: value as ChallengeActivationMode }))}
                  options={ACTIVATION_MODE_OPTIONS.map(option => ({ value: option.value, label: option.label }))}
                />
                <TextField
                  label="Área o proceso involucrado"
                  value={form.area}
                  onChange={value => onChange(prev => ({ ...prev, area: value }))}
                  placeholder="Operaciones, Comercial, TI, Talento"
                />
                <TextAreaField
                  label="Notas internas"
                  value={form.notes}
                  onChange={value => onChange(prev => ({ ...prev, notes: value }))}
                  placeholder="Restricciones, contexto o recordatorios para el seguimiento."
                />
              </div>

              {Object.keys(errors).length > 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p style={{ fontWeight: 700 }}>Revisa los campos marcados</p>
                  <p className="mt-1">Faltan datos mínimos para dejar este reto listo de forma consistente.</p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="text-sm text-slate-500">
                  La creación no reemplaza el detalle de iniciativas ni decisiones. Solo organiza el reto para que quede accionable.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    style={{ fontWeight: 700 }}
                  >
                    Cancelar
                  </button>
                  {mode === 'create' ? (
                    <>
                      <button
                        type="button"
                        onClick={onSaveDraft}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                        style={{ fontWeight: 700 }}
                      >
                        Guardar como borrador
                      </button>
                      <button
                        type="button"
                        onClick={onCreate}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
                        style={{ fontWeight: 700 }}
                      >
                        Crear reto
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onSaveChanges}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
                      style={{ fontWeight: 700 }}
                    >
                      Guardar cambios
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6">
              <ChallengeAiGuideCard
                form={form}
                aiInsight={aiInsight}
                onImproveWithAi={onImproveWithAi}
                focus={focus}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChallengeAiGuideCard({
  form,
  aiInsight,
  onImproveWithAi,
  focus,
}: {
  form: ChallengeFormState;
  aiInsight: { good: string[]; missing: string[]; next: string } | null;
  onImproveWithAi: () => void;
  focus: DrawerFocus;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-violet-50 p-2 text-violet-700">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>GUÍA PARA DEFINIR UN BUEN RETO</p>
          <h3 className="mt-1 text-lg text-slate-950" style={{ fontWeight: 700 }}>Un reto debe ser claro, accionable y conectado al frente correcto</h3>
          <p className="mt-2 text-sm text-slate-600">
            Usa esta guía para comprobar que el reto tiene dirección suficiente antes de activarlo.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Checklist</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {[
            'El reto está conectado a un frente estratégico.',
            'Tiene una señal principal o KPI visible.',
            'Cuenta con challenge owner y sponsor identificables.',
            'Tiene un horizonte claro.',
            'Puede convertirse en una o más iniciativas.',
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-900" style={{ fontWeight: 700 }}>Evita estos errores</p>
        <ul className="mt-3 space-y-2 text-sm text-rose-900/90">
          {[
            'No uses retos demasiado amplios sin señal clara.',
            'No avances sin challenge owner visible.',
            'No actives sin KPI o sin horizonte.',
            'No uses la herramienta o el equipo como nombre del reto.',
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-rose-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onImproveWithAi}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white transition-colors hover:bg-violet-700"
        style={{ fontWeight: 700 }}
      >
        <Sparkles size={15} />
        Mejorar con IA
      </button>

      {aiInsight ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Recomendación de claridad</p>
          <InsightLine label="Qué está bien" items={aiInsight.good} tone="emerald" />
          <InsightLine label="Qué falta" items={aiInsight.missing} tone="amber" />
          <InsightLine label="Siguiente ajuste recomendado" items={[aiInsight.next]} tone="slate" />
        </div>
      ) : null}

      {focus !== 'general' ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p style={{ fontWeight: 700 }}>Atajo activo</p>
          <p className="mt-1">
            {focus === 'owner'
              ? 'Esta edición se abrió desde challenge owner.'
              : focus === 'sponsor'
                ? 'Esta edición se abrió desde sponsor.'
                : 'Esta edición se abrió desde el estado o la activación.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EmptyChallengesState({
  onCreate,
  onClear,
}: {
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <EmptyState
      className="mt-6"
      eyebrow="Vista sin retos"
      title="Empieza creando un reto asociado a un frente estratégico"
      description="Así podrás bajar una prioridad a trabajo accionable, revisar responsables y seguir iniciativas desde aquí."
      primaryAction={{ id: 'create-challenge', label: 'Crear nuevo reto' }}
      secondaryAction={{ id: 'clear-challenge-filters', label: 'Limpiar filtros' }}
      onAction={actionId => {
        if (actionId === 'create-challenge') onCreate();
        if (actionId === 'clear-challenge-filters') onClear();
      }}
    />
  );
}

function MenuAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
      style={{ fontWeight: 600 }}
    >
      <span>{children}</span>
      <ArrowRight size={14} className="text-slate-400" />
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${
          error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${
          error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'
        }`}
      />
      {helper ? <p className="mt-1.5 text-xs text-slate-500">{helper}</p> : null}
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${
          error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'
        }`}
      />
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function DetailBlock({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>{title}</p>
      <div className="mt-3 grid gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
            <p className="mt-1 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>Buscar</span>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>
    </label>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`} style={{ fontWeight: 700 }}>{label}</span>;
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'violet' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
  };
  return <span className={`rounded-full border px-3 py-1 text-xs ${tones[tone]}`} style={{ fontWeight: 700 }}>{children}</span>;
}

function statusTone(status: ChallengeStatus) {
  switch (status) {
    case 'draft':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    case 'listo_para_activar':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'activo_interno':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'publicado':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'recibiendo_iniciativas':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'con_iniciativas_activas':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'pendiente_de_decision':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'cerrado':
      return 'border-slate-300 bg-slate-200 text-slate-600';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-600';
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'Actualizado hoy';
  if (diffDays === 1) return 'Actualizado hace 1 día';
  return `Actualizado hace ${diffDays} días`;
}

function getChallengeSponsor(challenge: Challenge, front: StrategicFront | null) {
  return challenge.sponsorName?.trim() || front?.sponsor || 'Sin sponsor visible';
}

function mapChallengeToForm(challenge: Challenge, front: StrategicFront | null): ChallengeFormState {
  const activationInputs = challenge.activationInputs;
  return {
    name: challenge.name,
    strategicFrontId: challenge.strategicFrontId,
    challengeType: challenge.challengeType,
    whatWeWantToMove: challenge.whatWeWantToMove,
    objective: challenge.objective,
    whyNow: challenge.whyNow,
    successCriteria: challenge.successCriteria,
    knownFacts: challenge.knownFacts ?? '',
    openQuestions: challenge.openQuestions ?? '',
    constraints: challenge.constraints ?? '',
    dependencies: challenge.dependencies ?? '',
    expectedDecision: challenge.expectedDecision ?? '',
    challengeOwner: challenge.challengeOwner,
    sponsorName: challenge.sponsorName ?? front?.sponsor ?? '',
    sponsorEmail: challenge.sponsorEmail ?? '',
    challengeOwnerStatus: challenge.challengeOwnerStatus,
    sponsorStatus: challenge.sponsorStatus,
    activationMode: challenge.activationMode,
    status: challenge.status,
    urgency: activationInputs.urgency,
    timeAvailable: activationInputs.timeAvailable,
    estimatedEffort: activationInputs.estimatedEffort,
    challengeClarity: activationInputs.challengeClarity,
    informationSensitivity: activationInputs.informationSensitivity,
    internalCapacity: activationInputs.internalCapacity,
    technicalNeed: activationInputs.technicalNeed,
    dependency: activationInputs.dependency,
    area: challenge.area ?? front?.area ?? '',
    horizon: challenge.horizon ?? front?.horizon ?? '',
    notes: challenge.notes ?? '',
  };
}

function mapFormToCreateInput(form: ChallengeFormState, status: ChallengeStatus): CreateChallengeInput {
  return {
    name: form.name.trim(),
    strategicFrontId: form.strategicFrontId,
    challengeType: form.challengeType,
    whatWeWantToMove: form.whatWeWantToMove.trim(),
    objective: form.objective.trim(),
    whyNow: form.whyNow.trim(),
    successCriteria: form.successCriteria.trim(),
    knownFacts: form.knownFacts.trim(),
    openQuestions: form.openQuestions.trim(),
    constraints: form.constraints.trim(),
    dependencies: form.dependencies.trim(),
    expectedDecision: form.expectedDecision.trim(),
    challengeOwner: form.challengeOwner.trim(),
    sponsorName: form.sponsorName.trim() || undefined,
    sponsorEmail: form.sponsorEmail.trim() || undefined,
    horizon: form.horizon.trim() || undefined,
    area: form.area.trim() || undefined,
    notes: form.notes.trim() || undefined,
    challengeOwnerStatus: form.challengeOwnerStatus,
    sponsorStatus: form.sponsorStatus,
    activationInputs: {
      urgency: form.urgency,
      timeAvailable: form.timeAvailable,
      estimatedEffort: form.estimatedEffort,
      challengeClarity: form.challengeClarity,
      informationSensitivity: form.informationSensitivity,
      internalCapacity: form.internalCapacity,
      technicalNeed: form.technicalNeed,
      sponsorStatus: form.sponsorStatus,
      dependency: form.dependency,
    },
    activationMode: form.activationMode,
    status,
  };
}

function validateChallengeForm(form: ChallengeFormState, status: ChallengeStatus) {
  const errors: FormErrors = {};
  const requireActivationFields = status !== 'draft';

  if (!form.name.trim()) errors.name = 'Completa el nombre del reto.';
  if (!form.strategicFrontId) errors.strategicFrontId = 'Selecciona un frente estratégico.';
  if (requireActivationFields && !form.challengeType) errors.challengeType = 'Selecciona un tipo de reto.';
  if (requireActivationFields && !form.whatWeWantToMove.trim()) errors.whatWeWantToMove = 'Describe qué busca mover.';
  if (requireActivationFields && !form.objective.trim()) errors.objective = 'Completa el objetivo del reto.';
  if (requireActivationFields && !form.successCriteria.trim()) errors.successCriteria = 'Agrega una señal principal o KPI.';
  if (requireActivationFields && !form.challengeOwner.trim()) errors.challengeOwner = 'Necesitas un challenge owner visible.';
  if (requireActivationFields && !form.horizon.trim()) errors.horizon = 'Define un horizonte.';
  if (requireActivationFields && !form.urgency) errors.urgency = 'Selecciona urgencia.';
  if (requireActivationFields && !form.activationMode) errors.activationMode = 'Selecciona modalidad de activación.';

  return errors;
}

function buildFormInsight(form: ChallengeFormState) {
  const good: string[] = [];
  const missing: string[] = [];

  if (form.name.trim()) good.push('El reto ya tiene un nombre claro.');
  if (form.strategicFrontId) good.push('Está conectado a un frente estratégico.');
  if (form.challengeOwner.trim()) good.push('El challenge owner ya está identificado.');
  if (form.successCriteria.trim()) good.push('La señal principal ya está definida.');

  if (!form.challengeOwner.trim()) missing.push('Falta challenge owner visible.');
  if (!form.successCriteria.trim()) missing.push('Falta KPI o señal principal.');
  if (!form.horizon.trim()) missing.push('Falta horizonte temporal.');
  if (!form.urgency) missing.push('Falta urgencia.');

  const next = !form.challengeOwner.trim()
    ? 'Define el challenge owner antes de activar más trabajo.'
    : !form.successCriteria.trim()
      ? 'Convierte la señal principal en un KPI concreto.'
      : !form.horizon.trim()
        ? 'Agrega horizonte para que el reto tenga seguimiento.'
        : 'Revisa sponsor y modalidad de activación para ganar tracción.';

  return {
    good: good.length > 0 ? good : ['Aún no hay señales suficientes para validar el reto.'],
    missing: missing.length > 0 ? missing : ['No hay faltantes críticos visibles.'],
    next,
  };
}

function matchesTab(tab: TabKey, card: ReturnType<typeof getChallengeCards>[number], challenge: Challenge) {
  switch (tab) {
    case 'ready':
      return challenge.status === 'draft' || challenge.status === 'listo_para_activar';
    case 'active':
      return ['activo_interno', 'publicado', 'recibiendo_iniciativas', 'con_iniciativas_activas'].includes(challenge.status);
    case 'blocked':
      return card.blockedInitiativesCount > 0 || card.coverageStatus === 'sin_cobertura';
    case 'with_initiatives':
      return card.initiativesCount > 0;
    case 'decision':
      return card.pendingDecisionsCount > 0;
    default:
      return true;
  }
}

function InsightLine({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const toneStyles = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneStyles[tone]}`}>
      <p className="text-xs" style={{ fontWeight: 700 }}>{label}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map(item => (
          <li key={item} className="text-sm">
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildRecommendationCards(
  cards: ReturnType<typeof getChallengeCards>,
  challengeMap: Map<string, Challenge>,
  frontMap: Map<string, StrategicFront>,
  state: PortfolioLeadState,
) {
  return cards
    .map(card => {
      const challenge = challengeMap.get(card.id);
      const front = challenge ? frontMap.get(challenge.strategicFrontId) ?? null : null;
      if (!challenge) return null;
      const recommendation = getChallengeActivationRecommendation(state, challenge.id);
      const blockers = card.blockedInitiativesCount;
      const ownerPending = challenge.challengeOwnerStatus !== 'confirmado';
      const sponsorPending = challenge.sponsorStatus !== 'confirmado';
      const noCoverage = card.coverageStatus === 'sin_cobertura' || card.initiativesCount === 0;
      const pendingDecision = card.pendingDecisionsCount > 0;
      const modeMismatch = recommendation ? recommendation.recommendedMode !== challenge.activationMode : false;

      if (blockers > 0) {
        return {
          id: `blocker-${challenge.id}`,
          kind: 'Resolver bloqueo',
          challengeId: challenge.id,
          challengeName: challenge.name,
          frontName: front?.name ?? 'Sin frente visible',
          whyItMatters: `Hay ${blockers} iniciativa(s) bloqueada(s) y eso reduce la cobertura real del reto.`,
          action: 'Revisa la iniciativa bloqueada antes de sumar nuevos equipos.',
          ctaLabel: 'Ver iniciativas',
          actionKind: 'initiative' as const,
          score: 100,
        };
      }

      if (ownerPending) {
        return {
          id: `owner-${challenge.id}`,
          kind: 'Completar responsable',
          challengeId: challenge.id,
          challengeName: challenge.name,
          frontName: front?.name ?? 'Sin frente visible',
          whyItMatters: 'El reto no tiene challenge owner confirmado y eso frena su avance.',
          action: 'Confirma el responsible visible antes de abrir más trabajo.',
          ctaLabel: 'Cambiar owner',
          actionKind: 'owner' as const,
          score: 95,
        };
      }

      if (sponsorPending) {
        return {
          id: `sponsor-${challenge.id}`,
          kind: 'Alinear sponsor',
          challengeId: challenge.id,
          challengeName: challenge.name,
          frontName: front?.name ?? 'Sin frente visible',
          whyItMatters: 'El sponsor aún no está confirmado y eso puede complicar destrabe y continuidad.',
          action: 'Confirma sponsor antes de sumar más iniciativa al reto.',
          ctaLabel: 'Cambiar sponsor',
          actionKind: 'sponsor' as const,
          score: 90,
        };
      }

      if (noCoverage) {
        return {
          id: `coverage-${challenge.id}`,
          kind: 'Abrir cobertura',
          challengeId: challenge.id,
          challengeName: challenge.name,
          frontName: front?.name ?? 'Sin frente visible',
          whyItMatters: 'Todavía no hay suficiente trabajo asociado para leer avance real.',
          action: 'Define una modalidad de activación o suma la primera iniciativa.',
          ctaLabel: 'Editar activación',
          actionKind: 'edit' as const,
          score: 80,
        };
      }

      if (pendingDecision) {
        return {
          id: `decision-${challenge.id}`,
          kind: 'Pendiente de decisión',
          challengeId: challenge.id,
          challengeName: challenge.name,
          frontName: front?.name ?? 'Sin frente visible',
          whyItMatters: 'Hay iniciativas maduras esperando una definición ejecutiva.',
          action: 'Revisa la cola de decisión antes de abrir más trabajo.',
          ctaLabel: 'Ver iniciativas',
          actionKind: 'initiative' as const,
          score: 70,
        };
      }

      if (modeMismatch && recommendation) {
        return {
          id: `mode-${challenge.id}`,
          kind: 'Ajustar modalidad',
          challengeId: challenge.id,
          challengeName: challenge.name,
          frontName: front?.name ?? 'Sin frente visible',
          whyItMatters: recommendation.justification,
          action: recommendation.nextSteps[0] ?? 'Revisa la modalidad de activación.',
          ctaLabel: 'Editar activación',
          actionKind: 'edit' as const,
          score: 60,
        };
      }

      return {
        id: `track-${challenge.id}`,
        kind: 'Mantener seguimiento',
        challengeId: challenge.id,
        challengeName: challenge.name,
        frontName: front?.name ?? 'Sin frente visible',
        whyItMatters: 'El reto ya tiene cobertura visible y conviene sostener el seguimiento.',
        action: 'Revisa cobertura y mantiene la lectura operativa.',
        ctaLabel: 'Ver detalle',
        actionKind: 'edit' as const,
        score: 40,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right!.score - left!.score) as RecommendationCard[];
}

function buildSelectedRecommendationCard(
  challenge: Challenge | null,
  front: StrategicFront | null,
  card: ReturnType<typeof getChallengeCards>[number] | null,
) {
  if (!challenge || !card) return null;
  const state = {
    strategicFronts: front ? [front] : [],
    challenges: [challenge],
    initiatives: [],
    initiativeOverlaps: [],
    portfolioDecisions: [],
  } as PortfolioLeadState;
  const recommendation = getChallengeActivationRecommendation(state, challenge.id);
  return {
    id: `selected-${challenge.id}`,
    kind: recommendation?.recommendedModeLabel ?? 'Siguiente acción',
    challengeId: challenge.id,
    challengeName: challenge.name,
    frontName: front?.name ?? card.frontName,
    whyItMatters: recommendation?.justification ?? card.nextActionDescription,
    action: recommendation?.nextSteps[0] ?? card.nextActionDescription,
    ctaLabel: card.actionLabel,
    actionKind: 'edit' as const,
    score: 100,
  } satisfies RecommendationCard;
}

function selectedReadinessUrgency(readiness: ReturnType<typeof getChallengeActivationReadiness>, challenge: Challenge) {
  if (readiness.activationState === 'listo_para_activar') return challenge.activationInputs.urgency;
  if (challenge.status === 'pendiente_de_decision') return 'alta';
  return challenge.activationInputs.urgency;
}

function labelUrgency(value: ChallengeActivationInputs['urgency']) {
  return value === 'alta' ? 'Alta' : value === 'media' ? 'Media' : 'Baja';
}

function activationStateStatus(state: ReturnType<typeof getChallengeCards>[number]['activationState']): DomainStatus {
  switch (state) {
    case 'solo_definido':
      return 'draft';
    case 'listo_para_activar':
      return 'requires_review';
    case 'activo_interno':
    case 'publicado':
      return 'active';
    default:
      return 'info';
  }
}

function invitationStatusStatus(status: Challenge['selectedPeople'][number]['status']): DomainStatus {
  switch (status) {
    case 'pendiente':
      return 'unreviewed';
    case 'notificado':
      return 'requires_review';
    case 'confirmado':
      return 'confirmed';
    case 'declinado':
      return 'rejected';
    default:
      return 'info';
  }
}

function invitationStatusLabel(status: Challenge['selectedPeople'][number]['status']) {
  switch (status) {
    case 'pendiente':
      return 'Pendiente';
    case 'notificado':
      return 'Notificado';
    case 'confirmado':
      return 'Confirmado';
    case 'declinado':
      return 'Declinado';
    default:
      return status;
  }
}

function stakeholderStatusLabel(status: StakeholderStatus) {
  switch (status) {
    case 'definido':
      return 'Pendiente';
    case 'notificado':
      return 'Notificado';
    case 'confirmado':
      return 'Confirmado';
    default:
      return status;
  }
}

function summarizeInvitations(invitations: Challenge['selectedPeople']) {
  const confirmed = invitations.filter(item => item.status === 'confirmado').length;
  const pending = invitations.filter(item => item.status === 'pendiente' || item.status === 'notificado').length;
  const declined = invitations.filter(item => item.status === 'declinado').length;

  if (invitations.length === 0) {
    return { total: 0, label: 'Sin invitaciones' };
  }

  return {
    total: invitations.length,
    label: `${confirmed} confirmadas / ${pending} pendientes${declined > 0 ? ` / ${declined} declinadas` : ''}`,
  };
}
