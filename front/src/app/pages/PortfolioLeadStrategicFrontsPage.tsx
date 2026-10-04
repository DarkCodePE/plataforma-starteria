import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  Eye,
  MoreVertical,
  PencilLine,
  Plus,
  PauseCircle,
  PlayCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePortfolioLead,
  evaluateStrategicFrontQuality,
  reviewStrategicFrontQuality,
} from '../../features/portfolio-lead';
import type {
  CreateStrategicFrontInput,
  StrategicFront,
  StrategicFrontQualityEvaluation,
  StrategicFrontQualityReview,
  StrategicFrontPriority,
  StrategicFrontStatus,
} from '../../features/portfolio-lead';
import {
  ContextSummary,
  EmptyState,
  InlineInsight,
  PageHeader,
} from '../components/design-system/patterns';
import { Button } from '../components/ui/button';
import { PortfolioLeadBreadcrumbs } from '../components/portfolio/PortfolioLeadPageElements';

type DrawerMode = 'create' | 'edit' | 'view' | null;
type DrawerIntent = 'general' | 'sponsor' | 'status';

type StrategicFrontFormState = {
  name: string;
  strategicObjective: string;
  whyNow: string;
  sponsor: string;
  sponsorEmail: string;
  mainKpi: string;
  baseline: string;
  target: string;
  threshold: string;
  area: string;
  horizon: string;
  endDate: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
  notes: string;
};

type FrontFormErrors = Partial<Record<keyof StrategicFrontFormState, string>>;
type ActiveFrontField = keyof StrategicFrontFormState | null;

const STATUS_FILTER_OPTIONS: Array<{ value: StrategicFrontStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
  { value: 'tracking', label: 'En seguimiento' },
  { value: 'paused', label: 'En pausa' },
  { value: 'closed', label: 'Cerrado' },
];

const PRIORITY_FILTER_OPTIONS: Array<{ value: StrategicFrontPriority | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'Baja', label: 'Baja' },
  { value: 'Media', label: 'Media' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Critica', label: 'Crítica' },
];

const CREATE_STATUS_OPTIONS: Array<{ value: StrategicFrontStatus; label: string }> = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
];

const EDIT_STATUS_OPTIONS: Array<{ value: StrategicFrontStatus; label: string }> = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
  { value: 'tracking', label: 'En seguimiento' },
  { value: 'paused', label: 'En pausa' },
  { value: 'closed', label: 'Cerrado' },
];

const PRIORITY_OPTIONS: Array<{ value: StrategicFrontPriority; label: string }> = [
  { value: 'Baja', label: 'Baja' },
  { value: 'Media', label: 'Media' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Critica', label: 'Crítica' },
];

const STATUS_META: Partial<Record<StrategicFrontStatus, { label: string; tone: string }>> = {
  draft: { label: 'Borrador', tone: 'border-slate-200 bg-slate-100 text-slate-700' },
  active: { label: 'Activo', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  tracking: { label: 'En seguimiento', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  paused: { label: 'En pausa', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  closed: { label: 'Cerrado', tone: 'border-slate-300 bg-slate-200 text-slate-600' },
};

const PRIORITY_META: Record<StrategicFrontPriority, { label: string; tone: string }> = {
  Baja: { label: 'Baja', tone: 'border-slate-200 bg-slate-50 text-slate-600' },
  Media: { label: 'Media', tone: 'border-amber-200 bg-amber-50 text-amber-800' },
  Alta: { label: 'Alta', tone: 'border-orange-200 bg-orange-50 text-orange-700' },
  Critica: { label: 'Crítica', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
};

const EMPTY_FORM: StrategicFrontFormState = {
  name: '',
  strategicObjective: '',
  whyNow: '',
  sponsor: '',
  sponsorEmail: '',
  mainKpi: '',
  baseline: '',
  target: '',
  threshold: '',
  area: '',
  horizon: '',
  endDate: '',
  priority: 'Alta',
  status: 'draft',
  notes: '',
};

export function PortfolioLeadStrategicFrontsPage() {
  const { strategicFronts, createStrategicFront, updateStrategicFront, updateStrategicFrontStatus } = usePortfolioLead();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StrategicFrontStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<StrategicFrontPriority | 'all'>('all');
  const [showArchived, setShowArchived] = useState(true);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [drawerIntent, setDrawerIntent] = useState<DrawerIntent>('general');
  const [activeFrontId, setActiveFrontId] = useState<string | null>(null);
  const [form, setForm] = useState<StrategicFrontFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FrontFormErrors>({});
  const [activeField, setActiveField] = useState<ActiveFrontField>(null);
  const [qualityReview, setQualityReview] = useState<StrategicFrontQualityReview | null>(null);
  const [pendingCreateStatus, setPendingCreateStatus] = useState<StrategicFrontStatus | null>(null);

  const activeFront = useMemo(
    () => strategicFronts.find(front => front.id === activeFrontId) ?? null,
    [activeFrontId, strategicFronts],
  );

  const qualityEvaluation = useMemo(
    () => evaluateStrategicFrontQuality(mapFormToQualityInput(form)),
    [form],
  );

  const filteredFronts = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim());

    return [...strategicFronts]
      .filter(front => (showArchived ? true : front.status !== 'closed'))
      .filter(front => {
        if (statusFilter !== 'all' && front.status !== statusFilter) return false;
        if (priorityFilter !== 'all' && front.priority !== priorityFilter) return false;
        if (!normalizedSearch) return true;

        const haystack = normalizeText([
          front.name,
          front.strategicObjective,
          front.whyNow,
          front.sponsor,
          front.sponsorEmail ?? '',
          front.mainKpi,
          front.area ?? '',
          front.horizon,
          front.threshold ?? '',
        ].join(' '));

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const statusWeight = getStatusWeight(a.status) - getStatusWeight(b.status);
        if (statusWeight !== 0) return statusWeight;
        return compareDateDesc(a.lastUpdatedAt ?? a.createdAt, b.lastUpdatedAt ?? b.createdAt);
      });
  }, [priorityFilter, search, showArchived, statusFilter, strategicFronts]);

  const hasFronts = strategicFronts.length > 0;
  const hasFilteredFronts = filteredFronts.length > 0;

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setDrawerIntent('general');
    setActiveFrontId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setActiveField(null);
    setQualityReview(null);
    setPendingCreateStatus(null);
  };

  const openEditDrawer = (front: StrategicFront, intent: DrawerIntent = 'general') => {
    setDrawerMode('edit');
    setDrawerIntent(intent);
    setActiveFrontId(front.id);
    setForm(mapFrontToForm(front));
    setErrors({});
    setActiveField(null);
    setQualityReview(null);
    setPendingCreateStatus(null);
  };

  const openViewDrawer = (front: StrategicFront) => {
    setDrawerMode('view');
    setDrawerIntent('general');
    setActiveFrontId(front.id);
    setErrors({});
    setActiveField(null);
    setQualityReview(null);
    setPendingCreateStatus(null);
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setDrawerIntent('general');
    setActiveFrontId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setActiveField(null);
    setQualityReview(null);
    setPendingCreateStatus(null);
  };

  const handleCreate = (status: StrategicFrontStatus, { force = false }: { force?: boolean } = {}) => {
    const nextErrors = validateFrontForm(form, { allowDraft: status === 'draft' });
    setErrors(nextErrors);

    if (status !== 'draft' && !force && qualityEvaluation.qualityStatus !== 'green') {
      setPendingCreateStatus(status);
      setQualityReview(reviewStrategicFrontQuality(mapFormToQualityInput(form)));
      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      if (status !== 'draft') setPendingCreateStatus(status);
      return;
    }

    const created = createStrategicFront(mapFormToCreateInput(form, status));
    toast.success('Frente estratégico creado.');
    setActiveFrontId(created.id);
    closeDrawer();
  };

  const handleUpdate = () => {
    if (!activeFront) return;

    const nextErrors = validateFrontForm(form, { allowDraft: form.status === 'draft' });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    updateStrategicFront(activeFront.id, mapFormToCreateInput(form, form.status));
    toast.success('Frente estratégico actualizado.');
    closeDrawer();
  };

  const handleQuickStatusChange = (front: StrategicFront, nextStatus: StrategicFrontStatus, message: string) => {
    updateStrategicFrontStatus(front.id, nextStatus);
    toast.success(message);
  };

  const handleImproveWithAi = () => {
    setQualityReview(reviewStrategicFrontQuality(mapFormToQualityInput(form)));
  };

  const handleFormChange: React.Dispatch<React.SetStateAction<StrategicFrontFormState>> = updater => {
    setForm(prev => typeof updater === 'function' ? updater(prev) : updater);
    setPendingCreateStatus(null);
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <PortfolioLeadBreadcrumbs
        items={[
          { label: 'Portfolio Lead', path: '/portfolio/inicio' },
          { label: 'Frentes estratégicos' },
        ]}
      />

      <PageHeader
        eyebrow="Frentes estrategicos"
        title="Frentes estrategicos"
        description="¿Qué resultado quiere mover realmente el negocio? Cada frente separa lo que queremos conseguir de lo que estamos haciendo."
        metadata={[
          { label: 'Frentes visibles', value: strategicFronts.length },
          { label: 'Filtrados', value: filteredFronts.length },
        ]}
        primaryAction={{
          id: 'create-front',
          label: 'Crear frente estrategico',
          ariaLabel: 'Crear frente estrategico',
        }}
        onAction={actionId => {
          if (actionId === 'create-front') openCreateDrawer();
        }}
      />

      <StrategicFrontsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(prev => !prev)}
      />

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="max-w-3xl">
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>TUS FRENTES ESTRATÉGICOS</p>
          <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>Gestiona el estado, responsables, KPI y horizonte de cada frente</h2>
          <p className="mt-2 text-sm text-slate-600">
            Aquí creas frentes estratégicos, revisas los ya existentes y actualizas sponsor, KPI, umbral, prioridad y horizonte sin salir de la gestión central.
          </p>
        </div>

        {!hasFronts ? (
          <div className="mt-6">
            <EmptyStrategicFrontsState onCreate={openCreateDrawer} />
          </div>
        ) : !hasFilteredFronts ? (
          <div className="mt-6">
            <EmptyResultsState onClear={() => {
              setSearch('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setShowArchived(true);
            }} />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredFronts.map(front => (
              <StrategicFrontCard
                key={front.id}
                front={front}
                onView={openViewDrawer}
                onEdit={openEditDrawer}
                onQuickStatusChange={handleQuickStatusChange}
              />
            ))}
          </div>
        )}
      </section>

      {drawerMode === 'create' || drawerMode === 'edit' ? (
        <StrategicFrontFormDrawer
          mode={drawerMode}
          intent={drawerIntent}
          form={form}
          errors={errors}
          qualityEvaluation={qualityEvaluation}
          qualityReview={qualityReview}
          activeField={activeField}
          pendingCreateStatus={pendingCreateStatus}
          onClose={closeDrawer}
          onChange={handleFormChange}
          onFieldFocus={setActiveField}
          onCreateDraft={() => handleCreate('draft')}
          onCreateActive={() => handleCreate('active')}
          onConfirmCreate={() => pendingCreateStatus ? handleCreate(pendingCreateStatus, { force: true }) : undefined}
          onCancelCreateReview={() => setPendingCreateStatus(null)}
          onUpdate={handleUpdate}
          onImproveWithAi={handleImproveWithAi}
        />
      ) : null}

      {drawerMode === 'view' && activeFront ? (
        <StrategicFrontDetailDrawer
          front={activeFront}
          onClose={closeDrawer}
          onEdit={() => openEditDrawer(activeFront)}
          onPause={() => handleQuickStatusChange(activeFront, 'paused', 'Frente pausado.')}
          onReactivate={() => handleQuickStatusChange(activeFront, 'active', 'Frente reactivado.')}
          onCloseFront={() => handleQuickStatusChange(activeFront, 'closed', 'Frente archivado como cerrado.')}
        />
      ) : null}
    </div>
  );
}

function StrategicFrontsHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f7f3e7_0%,#ffffff_68%,#eef4ff_100%)] p-6 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>FRENTES ESTRATÉGICOS</p>
          <h1 className="mt-2 text-3xl text-slate-950 md:text-4xl" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
            Frentes estratégicos
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            ¿Qué resultado quiere mover realmente el negocio? Cada frente separa lo que queremos conseguir de lo que
            estamos haciendo, con su señal, su baseline, su meta y su horizonte.
          </p>
        </div>

        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white transition-colors hover:bg-slate-800"
          style={{ fontWeight: 700 }}
        >
          <Plus size={16} />
          Crear frente estratégico
        </button>
      </div>
    </div>
  );
}

function StrategicFrontsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  showArchived,
  onToggleArchived,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StrategicFrontStatus | 'all';
  onStatusFilterChange: (value: StrategicFrontStatus | 'all') => void;
  priorityFilter: StrategicFrontPriority | 'all';
  onPriorityFilterChange: (value: StrategicFrontPriority | 'all') => void;
  showArchived: boolean;
  onToggleArchived: () => void;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
        <SearchField
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por nombre, sponsor o KPI"
        />
        <SelectField
          label="Estado"
          value={statusFilter}
          onChange={value => onStatusFilterChange(value as StrategicFrontStatus | 'all')}
          options={STATUS_FILTER_OPTIONS}
        />
        <SelectField
          label="Prioridad"
          value={priorityFilter}
          onChange={value => onPriorityFilterChange(value as StrategicFrontPriority | 'all')}
          options={PRIORITY_FILTER_OPTIONS}
        />
        <div className="flex items-end">
          <button
            onClick={onToggleArchived}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            style={{ fontWeight: 700 }}
          >
            <Archive size={15} className="mr-2" />
            {showArchived ? 'Ocultar archivados' : 'Ver archivados'}
          </button>
        </div>
      </div>
    </section>
  );
}

function StrategicFrontCard({
  front,
  onView,
  onEdit,
  onQuickStatusChange,
}: {
  front: StrategicFront;
  onView: (front: StrategicFront) => void;
  onEdit: (front: StrategicFront, intent?: DrawerIntent) => void;
  onQuickStatusChange: (front: StrategicFront, nextStatus: StrategicFrontStatus, message: string) => void;
}) {
  const timeLabel = getTimeLabel(front);
  const lastActivityLabel = formatRelativeLabel(front.lastUpdatedAt ?? front.createdAt);

  return (
    <article className="rounded-ds-lg border border-border-default bg-surface-default p-5 shadow-elevation-none md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              Frente estratégico
            </span>
            <StatusBadge status={front.status} />
            <PriorityBadge priority={front.priority} />
            {front.area ? (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                {front.area}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Nombre del frente</p>
              <h3 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>
                {front.name}
              </h3>
            </div>
            <span className="text-xs text-slate-500 md:pt-1" style={{ fontWeight: 700 }}>
              {timeLabel}
            </span>
          </div>

          <p className="mt-3 max-w-4xl text-sm text-slate-600 md:text-base">{front.strategicObjective}</p>

          <ContextSummary
            className="mt-5"
            density="compact"
            title="Contexto del frente"
            items={[
              { label: 'Descripcion', value: front.whyNow || 'No hay lectura adicional registrada.' },
              { label: 'Senal principal', value: front.mainKpi },
              {
                label: 'Estado de avance',
                value: getFrontProgressLabel(front),
                metadata: getFrontProgressHelper(front),
              },
              { label: 'Sponsor', value: front.sponsor || 'Sin sponsor' },
              { label: 'Horizonte', value: front.horizon },
              { label: 'Area', value: front.area || 'Sin area visible' },
            ]}
          />

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FrontStat label="Retos asociados" value={`${front.challengeCount}`} />
            <FrontStat label="Iniciativas asociadas" value={`${front.initiativeCount}`} />
            <FrontStat label="Última actualización" value={lastActivityLabel} />
          </div>

          <InlineInsight
            className="mt-4"
            title={front.status === 'paused' || front.status === 'draft'
              ? 'Starteria: puntos por abordar'
              : 'Starteria: seguimiento sugerido'}
            rationale={buildFrontChecklist(front)}
          >
            {buildFrontChecklist(front)[0] ?? 'Mantener seguimiento del frente.'}
          </InlineInsight>
        </div>

        <div className="flex flex-col gap-3 xl:w-64">
          <Button
            type="button"
            onClick={() => onView(front)}
            className="w-full"
          >
            <Eye size={15} />
            Ver
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onEdit(front)}
            className="w-full"
          >
            <PencilLine size={15} />
            Editar
          </Button>

          <details className="group relative">
            <summary className="list-none">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                style={{ fontWeight: 700 }}
              >
                <MoreVertical size={15} />
                Más acciones
              </button>
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <MenuAction onClick={() => onEdit(front, 'sponsor')}>Cambiar sponsor</MenuAction>
              <MenuAction onClick={() => onEdit(front, 'status')}>Cambiar estado</MenuAction>
              {front.status === 'paused' ? (
                <MenuAction onClick={() => onQuickStatusChange(front, 'active', 'Frente reactivado.')}>Reactivar frente</MenuAction>
              ) : front.status !== 'closed' ? (
                <MenuAction onClick={() => onQuickStatusChange(front, 'paused', 'Frente pausado.')}>Pausar frente</MenuAction>
              ) : null}
              {front.status !== 'closed' ? (
                <MenuAction onClick={() => onQuickStatusChange(front, 'closed', 'Frente archivado como cerrado.')}>Archivar</MenuAction>
              ) : null}
              {front.status !== 'closed' ? (
                <MenuAction onClick={() => onQuickStatusChange(front, 'closed', 'Frente cerrado.')}>Cerrar</MenuAction>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function StrategicFrontFormDrawer({
  mode,
  intent,
  form,
  errors,
  qualityEvaluation,
  qualityReview,
  activeField,
  pendingCreateStatus,
  onClose,
  onChange,
  onFieldFocus,
  onCreateDraft,
  onCreateActive,
  onConfirmCreate,
  onCancelCreateReview,
  onUpdate,
  onImproveWithAi,
}: {
  mode: Exclude<DrawerMode, 'view' | null>;
  intent: DrawerIntent;
  form: StrategicFrontFormState;
  errors: FrontFormErrors;
  qualityEvaluation: StrategicFrontQualityEvaluation;
  qualityReview: StrategicFrontQualityReview | null;
  activeField: ActiveFrontField;
  pendingCreateStatus: StrategicFrontStatus | null;
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<StrategicFrontFormState>>;
  onFieldFocus: (field: ActiveFrontField) => void;
  onCreateDraft: () => void;
  onCreateActive: () => void;
  onConfirmCreate: () => void;
  onCancelCreateReview: () => void;
  onUpdate: () => void;
  onImproveWithAi: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 md:p-6">
      <div className="ml-auto flex h-full w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex h-full w-full flex-col overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>
                  {mode === 'edit' ? 'EDITAR FRENTE ESTRATÉGICO' : 'CREAR FRENTE ESTRATÉGICO'}
                </p>
                <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>
                  {mode === 'edit' ? 'Editar frente estratégico' : 'Crear frente estratégico'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  ¿Qué resultado quiere mover el negocio? Descríbelo como un resultado, no como una actividad o una
                  tecnología; los retos llegan después, cuando separar ayude a gobernar mejor.
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

            {intent !== 'general' ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {intent === 'sponsor'
                  ? 'Atajo abierto: revisa sponsor, email y estado del frente.'
                  : 'Atajo abierto: revisa el estado del frente antes de guardar.'}
              </div>
            ) : null}
          </div>

          <div className="grid flex-1 gap-0 xl:grid-cols-[1.45fr_0.9fr]">
            <div className="border-r border-slate-200 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  label="Nombre del frente"
                  required
                  value={form.name}
                  onChange={value => onChange(prev => ({ ...prev, name: value }))}
                  onFocus={() => onFieldFocus('name')}
                  placeholder="Ej. Excelencia operativa"
                  helper="Debe representar una prioridad del negocio, no una solución específica."
                  error={errors.name}
                />
                <FormField
                  label="Área o unidad involucrada"
                  required
                  value={form.area}
                  onChange={value => onChange(prev => ({ ...prev, area: value }))}
                  onFocus={() => onFieldFocus('area')}
                  placeholder="Operaciones, Comercial, Talento, TI"
                  helper="¿Quién tendrá mayor responsabilidad sobre este frente?"
                  error={errors.area}
                />
                <FormField
                  label="KPI principal o señal de éxito"
                  required
                  value={form.mainKpi}
                  onChange={value => onChange(prev => ({ ...prev, mainKpi: value }))}
                  onFocus={() => onFieldFocus('mainKpi')}
                  placeholder="Ej. Tiempo promedio de cierre"
                  helper="Indica cómo sabrás que el frente está avanzando."
                  error={errors.mainKpi}
                />
                <FormField
                  label="Meta esperada"
                  value={form.target}
                  onChange={value => onChange(prev => ({ ...prev, target: value }))}
                  onFocus={() => onFieldFocus('target')}
                  placeholder="Ej. Reducir a 15 días"
                  helper="Puedes dejarla pendiente si todavia no tienes el dato. Conviene completarla antes de activar retos."
                  error={errors.target}
                />
                <FormField
                  label="Baseline actual"
                  value={form.baseline}
                  onChange={value => onChange(prev => ({ ...prev, baseline: value }))}
                  onFocus={() => onFieldFocus('baseline')}
                  helper="Si no tienes el dato exacto, puedes dejarlo pendiente y completarlo antes de activar retos."
                  placeholder="Ej. 21 días"
                />
                <FormField
                  label="Umbral mínimo de avance"
                  value={form.threshold}
                  onChange={value => onChange(prev => ({ ...prev, threshold: value }))}
                  onFocus={() => onFieldFocus('threshold')}
                  placeholder="Ej. Reducir al menos 20%"
                  helper="Opcional, pero útil para saber cuándo el frente realmente avanza."
                />
                <FormField
                  label="Sponsor"
                  value={form.sponsor}
                  onChange={value => onChange(prev => ({ ...prev, sponsor: value }))}
                  onFocus={() => onFieldFocus('sponsor')}
                  helper="Puedes guardar sin sponsor. Antes de activar retos conviene definir quien puede respaldar o destrabar este frente."
                  placeholder="Nombre del sponsor o líder ejecutivo"
                />
                <FormField
                  label="Email del sponsor"
                  value={form.sponsorEmail}
                  onChange={value => onChange(prev => ({ ...prev, sponsorEmail: value }))}
                  onFocus={() => onFieldFocus('sponsorEmail')}
                  placeholder="sponsor@empresa.com"
                />
                <FormField
                  label="Horizonte"
                  required
                  value={form.horizon}
                  onChange={value => onChange(prev => ({ ...prev, horizon: value }))}
                  onFocus={() => onFieldFocus('horizon')}
                  placeholder="Ej. Trimestre, semestre o 90 días"
                  helper="Puedes usar 30 días, 60 días, 90 días, trimestre, semestre o año."
                  error={errors.horizon}
                />
                <FormField
                  label="Fecha estimada de término"
                  type="date"
                  value={form.endDate}
                  onChange={value => onChange(prev => ({ ...prev, endDate: value }))}
                  onFocus={() => onFieldFocus('endDate')}
                />
                <SelectField
                  label="Prioridad"
                  required
                  value={form.priority}
                  onChange={value => onChange(prev => ({ ...prev, priority: value as StrategicFrontPriority }))}
                  onFocus={() => onFieldFocus('priority')}
                  options={PRIORITY_OPTIONS}
                  error={errors.priority}
                />
                <SelectField
                  label={mode === 'create' ? 'Estado inicial' : 'Estado'}
                  required
                  value={form.status}
                  onChange={value => onChange(prev => ({ ...prev, status: value as StrategicFrontStatus }))}
                  onFocus={() => onFieldFocus('status')}
                  options={mode === 'create' ? CREATE_STATUS_OPTIONS : EDIT_STATUS_OPTIONS}
                  error={errors.status}
                />
              </div>

              <div className="mt-5 grid gap-5">
                <TextAreaField
                  label="Objetivo estratégico"
                  required
                  value={form.strategicObjective}
                  onChange={value => onChange(prev => ({ ...prev, strategicObjective: value }))}
                  onFocus={() => onFieldFocus('strategicObjective')}
                  placeholder="Ej. Reducir reprocesos en cierres de atención para mejorar eficiencia operativa."
                  helper="Explica qué quieres mover y por qué importa para el negocio."
                  error={errors.strategicObjective}
                />
                <TextAreaField
                  label="Lectura actual del frente"
                  value={form.whyNow}
                  onChange={value => onChange(prev => ({ ...prev, whyNow: value }))}
                  onFocus={() => onFieldFocus('whyNow')}
                  placeholder="Opcional. Qué está pasando ahora y por qué conviene abrir este frente."
                />
                <TextAreaField
                  label="Notas internas"
                  value={form.notes}
                  onChange={value => onChange(prev => ({ ...prev, notes: value }))}
                  onFocus={() => onFieldFocus('notes')}
                  placeholder="Notas de seguimiento, contexto o decisiones que quieras dejar registradas."
                />
              </div>

              {Object.keys(errors).length > 0 ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p style={{ fontWeight: 700 }}>Siguiente paso recomendado</p>
                  <p className="mt-1">El frente todavía necesita completar algunos datos mínimos para quedar listo.</p>
                </div>
              ) : null}

              {pendingCreateStatus ? (
                <StrategicFrontCreateReview
                  evaluation={qualityEvaluation}
                  onCancel={onCancelCreateReview}
                  onConfirm={onConfirmCreate}
                />
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="max-w-xl text-sm text-slate-500">
                  Un frente no reemplaza la gestión de retos ni iniciativas. Solo ordena la prioridad que quieres mover.
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
                        onClick={onCreateDraft}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                        style={{ fontWeight: 700 }}
                      >
                        Guardar como borrador
                      </button>
                      <button
                        type="button"
                        onClick={onCreateActive}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
                        style={{ fontWeight: 700 }}
                      >
                        Crear frente
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onUpdate}
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
              <StrategicFrontAiGuideCard
                form={form}
                qualityEvaluation={qualityEvaluation}
                qualityReview={qualityReview}
                activeField={activeField}
                onImproveWithAi={onImproveWithAi}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategicFrontDetailDrawer({
  front,
  onClose,
  onEdit,
  onPause,
  onReactivate,
  onCloseFront,
}: {
  front: StrategicFront;
  onClose: () => void;
  onEdit: () => void;
  onPause: () => void;
  onReactivate: () => void;
  onCloseFront: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 md:p-6">
      <div className="ml-auto flex h-full w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex h-full w-full flex-col overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>DETALLE BREVES DEL FRENTE</p>
                <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{front.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{front.strategicObjective}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={front.status} />
              <PriorityBadge priority={front.priority} />
              {front.area ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  {front.area}
                </span>
              ) : null}
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Descripción del frente</p>
              <p className="mt-2 text-sm text-slate-700">{front.whyNow || 'No hay lectura adicional registrada.'}</p>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Señal principal" value={front.mainKpi} />
                <InfoCard label="Meta esperada" value={front.target} />
                <InfoCard label="Baseline" value={front.baseline || 'No definido'} />
                <InfoCard label="Umbral" value={front.threshold || 'No definido'} />
                <InfoCard label="Horizonte" value={front.horizon} />
                <InfoCard label="Fecha estimada de término" value={front.endDate ? formatDisplayDate(front.endDate) : 'No definida'} />
                <InfoCard label="Sponsor" value={front.sponsor || 'Sin sponsor'} />
                <InfoCard label="Email sponsor" value={front.sponsorEmail || 'No definido'} />
                <InfoCard label="Retos asociados" value={`${front.challengeCount}`} />
                <InfoCard label="Iniciativas asociadas" value={`${front.initiativeCount}`} />
                <InfoCard label="Creado" value={formatRelativeLabel(front.createdAt)} />
                <InfoCard label="Última actualización" value={formatRelativeLabel(front.lastUpdatedAt ?? front.createdAt)} />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Acciones rápidas</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={onEdit}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
                  style={{ fontWeight: 700 }}
                >
                  Editar frente
                </button>
                {front.status === 'paused' ? (
                  <button
                    onClick={onReactivate}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    style={{ fontWeight: 700 }}
                  >
                    Reactivar frente
                  </button>
                ) : front.status !== 'closed' ? (
                  <button
                    onClick={onPause}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    style={{ fontWeight: 700 }}
                  >
                    Pausar frente
                  </button>
                ) : null}
                {front.status !== 'closed' ? (
                  <button
                    onClick={onCloseFront}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    style={{ fontWeight: 700 }}
                  >
                    Cerrar frente
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategicFrontAiGuideCard({
  form,
  qualityEvaluation,
  qualityReview,
  activeField,
  onImproveWithAi,
}: {
  form: StrategicFrontFormState;
  qualityEvaluation: StrategicFrontQualityEvaluation;
  qualityReview: StrategicFrontQualityReview | null;
  activeField: ActiveFrontField;
  onImproveWithAi: () => void;
}) {
  void form;
  const [showAllCriteria, setShowAllCriteria] = useState(false);
  const statusMeta = QUALITY_STATUS_META[qualityEvaluation.qualityStatus];
  const contextualHelp = getFieldContextualHelp(activeField);
  const clearItems = qualityEvaluation.criteria.filter(item => item.status === 'complete').slice(0, 3);
  const strengtheningItems = qualityEvaluation.criteria
    .filter(item => item.status !== 'complete')
    .slice(0, 5);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-violet-50 p-2 text-violet-700">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>CALIDAD DEL FRENTE</p>
          <h3 className="mt-1 text-lg text-slate-950" style={{ fontWeight: 700 }}>Calidad del frente</h3>
          <p className="mt-2 text-sm text-slate-600">
            Captura primero la prioridad. Starteria te ayuda a fortalecerla paso a paso.
          </p>
        </div>
      </div>

      <div className={`mt-5 rounded-2xl border p-4 ${statusMeta.tone}`}>
        <p className="text-xs" style={{ fontWeight: 700 }}>{statusMeta.label}</p>
        <p className="mt-2 text-sm">{qualityEvaluation.diagnosis}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
        <p className="text-xs" style={{ fontWeight: 700 }}>Siguiente mejor accion</p>
        <p className="mt-2 text-sm" style={{ fontWeight: 700 }}>{qualityEvaluation.nextBestAction.title}</p>
        <p className="mt-1 text-sm">{qualityEvaluation.nextBestAction.description}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        <p className="text-xs" style={{ fontWeight: 700 }}>Lo que ya esta claro</p>
        {clearItems.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {clearItems.map(item => (
              <li key={item.id} className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm">Completa los primeros campos para que Starteria detecte senales de claridad.</p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
        <p className="text-xs text-slate-600" style={{ fontWeight: 700 }}>Para fortalecer antes de activar retos</p>
        <p className="mt-2 text-xs text-slate-500">
          No necesitas completarlo todo para guardar un borrador. Estos elementos ayudan cuando quieras activar retos.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {strengtheningItems.length > 0 ? strengtheningItems.map(item => (
            <li key={item.id} className="flex items-start gap-2">
              <Circle size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{item.label}</span>
            </li>
          )) : (
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>La base esta lista para preparar retos accionables.</span>
            </li>
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setShowAllCriteria(prev => !prev)}
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
        style={{ fontWeight: 700 }}
      >
        {showAllCriteria ? 'Ocultar criterios completos' : 'Ver criterios completos'}
      </button>

      {showAllCriteria ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Criterios completos</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {qualityEvaluation.criteria.map(item => (
              <li key={item.id} className="flex items-start gap-2">
                <CriterionIcon status={item.status} />
                <span>
                  <span style={{ fontWeight: 700 }}>{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.feedback}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contextualHelp ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="text-xs" style={{ fontWeight: 700 }}>Ayuda para este campo</p>
          <p className="mt-2">{contextualHelp.text}</p>
          {contextualHelp.goodExample ? (
            <p className="mt-3"><span style={{ fontWeight: 700 }}>Ejemplo bueno:</span> {contextualHelp.goodExample}</p>
          ) : null}
          {contextualHelp.weakExample ? (
            <p className="mt-1"><span style={{ fontWeight: 700 }}>Ejemplo debil:</span> {contextualHelp.weakExample}</p>
          ) : null}
          {contextualHelp.examples?.length ? (
            <ul className="mt-3 space-y-1">
              {contextualHelp.examples.map(example => <li key={example}>- {example}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        onClick={onImproveWithAi}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white transition-colors hover:bg-violet-700"
        style={{ fontWeight: 700 }}
      >
        <Sparkles size={15} />
        Ayudarme a formularlo mejor
      </button>

      {qualityReview ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Revision de calidad</p>
          <p className="mt-2 text-sm text-slate-700">{qualityReview.diagnosis}</p>

          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <InsightLine label="Que esta bien" items={qualityReview.strengths} tone="emerald" />
            <InsightLine label="Puntos a cuidar" items={qualityReview.risks.length ? qualityReview.risks : ['No hay puntos criticos visibles.']} tone="amber" />
            <InsightLine label="Para fortalecer" items={qualityReview.missingElements.length ? qualityReview.missingElements : ['No hay elementos prioritarios por fortalecer.']} tone="slate" />
            {qualityReview.suggestedRewrite ? (
              <InsightLine label="Version sugerida" items={[qualityReview.suggestedRewrite]} tone="slate" />
            ) : null}
            {qualityReview.canGenerateChallenges && qualityReview.suggestedChallenges.length > 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="text-xs" style={{ fontWeight: 700 }}>Retos sugeridos editables</p>
                <div className="mt-3 space-y-2">
                  {qualityReview.suggestedChallenges.map(challenge => (
                    <textarea
                      key={challenge}
                      defaultValue={challenge}
                      rows={2}
                      className="w-full resize-none rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {qualityReview.confidenceNote}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StrategicFrontAiGuideCardLegacy({
  form,
  aiInsight,
  onImproveWithAi,
}: {
  form: StrategicFrontFormState;
  aiInsight: { goodPoints: string[]; missingPoints: string[]; nextStep: string } | null;
  onImproveWithAi: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-violet-50 p-2 text-violet-700">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>GUÍA PARA DEFINIR UN BUEN FRENTE</p>
          <h3 className="mt-1 text-lg text-slate-950" style={{ fontWeight: 700 }}>Un frente estratégico debe expresar una prioridad clara, medible y accionable</h3>
          <p className="mt-2 text-sm text-slate-600">
            Usa esta guía para revisar si el frente representa una prioridad del negocio y no una solución puntual.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Checklist</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {[
            'Representa una prioridad, no una solución.',
            'Tiene una señal clara de avance.',
            'Está conectado a un sponsor o área responsable.',
            'Tiene un horizonte realista.',
            'Puede convertirse en uno o varios retos accionables.',
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
            'No uses nombres demasiado amplios como Transformación digital.',
            'No definas el frente como una herramienta: app, dashboard o chatbot.',
            'No avances sin KPI o señal mínima.',
            'No actives un frente si nadie puede respaldarlo.',
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-rose-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onImproveWithAi}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm text-white transition-colors hover:bg-violet-700"
        style={{ fontWeight: 700 }}
      >
        <Sparkles size={15} />
        Ayudarme a formularlo mejor
      </button>

      {aiInsight ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500" style={{ fontWeight: 700 }}>Recomendación de claridad</p>

          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <InsightLine label="Qué está bien" items={aiInsight.goodPoints} tone="emerald" />
            <InsightLine label="Qué falta" items={aiInsight.missingPoints} tone="amber" />
            <InsightLine label="Siguiente ajuste recomendado" items={[aiInsight.nextStep]} tone="slate" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const QUALITY_STATUS_META = {
  red: {
    label: 'Primer borrador',
    tone: 'border-sky-200 bg-sky-50 text-sky-950',
  },
  yellow: {
    label: 'Borrador con buena base',
    tone: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  green: {
    label: 'Listo para activar retos',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
} satisfies Record<StrategicFrontQualityReview['qualityStatus'], { label: string; tone: string }>;

function CriterionIcon({ status }: { status: StrategicFrontQualityEvaluation['criteria'][number]['status'] }) {
  if (status === 'complete') return <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />;
  if (status === 'needs_improvement') return <Circle size={16} className="mt-0.5 shrink-0 text-amber-500" />;
  return <Circle size={16} className="mt-0.5 shrink-0 text-slate-400" />;
}

function StrategicFrontCreateReview({
  evaluation,
  onCancel,
  onConfirm,
}: {
  evaluation: StrategicFrontQualityEvaluation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p style={{ fontWeight: 700 }}>Revision suave antes de crear</p>
          <p className="mt-1">{evaluation.diagnosis}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          ['Foco del frente', evaluation.warnings.some(item => item.includes('foco') || item.includes('herramienta')) ? 'Puedes fortalecerlo' : 'Se entiende'],
          ['Nombre como prioridad', evaluation.warnings.some(item => item.includes('herramienta')) ? 'Conviene reformular' : 'Se lee bien'],
          ['KPI o senal', evaluation.missingCriticalFields.includes('KPI principal o senal de avance') ? 'Pendiente por definir' : 'Definido'],
          ['Area responsable', evaluation.missingCriticalFields.includes('Area o unidad involucrada') ? 'Pendiente por definir' : 'Definida'],
          ['Sponsor o respaldo', evaluation.missingRecommendedFields.includes('Sponsor') ? 'Conviene aclararlo luego' : 'Definido'],
          ['Retos accionables', evaluation.canGenerateChallenges ? 'Ya puede orientar retos' : 'Puede madurar un poco mas'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-amber-200 bg-white/70 p-3">
            <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>{label}</p>
            <p className="mt-1 text-sm">{value}</p>
          </div>
        ))}
      </div>
      {(evaluation.missingCriticalFields.length > 0 || evaluation.missingRecommendedFields.length > 0) ? (
        <p className="mt-3 text-xs">
          Para fortalecer antes de activar retos: {[...evaluation.missingCriticalFields, ...evaluation.missingRecommendedFields].slice(0, 5).join(', ')}.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-sm text-amber-950 transition-colors hover:bg-amber-100"
          style={{ fontWeight: 700 }}
        >
          Volver a editar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-2xl bg-amber-700 px-4 py-2 text-sm text-white transition-colors hover:bg-amber-800"
          style={{ fontWeight: 700 }}
        >
          Crear y seguir fortaleciendo
        </button>
      </div>
    </div>
  );
}

function getFieldContextualHelp(field: ActiveFrontField) {
  const help: Partial<Record<keyof StrategicFrontFormState, {
    text: string;
    goodExample?: string;
    weakExample?: string;
    examples?: string[];
  }>> = {
    name: {
      text: 'Un buen nombre expresa prioridad, no herramienta.',
      goodExample: 'Mejorar activacion de nuevos clientes B2B.',
      weakExample: 'Crear app de onboarding.',
    },
    mainKpi: {
      text: 'El KPI debe indicar como sabras que el frente avanza. No necesita estar perfecto ahora, pero si debe apuntar a una senal observable.',
      examples: ['Tiempo promedio de activacion', 'Tasa de conversion', 'Reclamos por demora', 'Uso semanal', 'Costo operativo', 'Cumplimiento de SLA'],
    },
    target: {
      text: 'La meta debe conversar con el KPI. Si tu KPI es tiempo, tu meta debe expresar reduccion o mejora de tiempo.',
      goodExample: 'Reducir tiempo de activacion de 21 a 15 dias.',
    },
    baseline: {
      text: 'Si no conoces el baseline exacto, puedes dejarlo como estimado o pendiente de medir, pero no lo inventes.',
    },
    sponsor: {
      text: 'El sponsor no ejecuta el frente todos los dias. Es quien puede respaldarlo, priorizarlo o destrabar decisiones.',
    },
    horizon: {
      text: 'El horizonte no es una fecha de cierre definitiva. Es el momento en que revisaras si el frente muestra avance.',
    },
    strategicObjective: {
      text: 'Describe el resultado de negocio que quieres mover. Evita empezar por la solucion; enfocate en el cambio que esperas lograr.',
    },
  };

  return field ? help[field] ?? null : null;
}

function EmptyStrategicFrontsState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      eyebrow="Portfolio en arranque"
      title="Empieza creando una prioridad estratégica del negocio"
      description="Después podrás convertirla en retos accionables y darle seguimiento desde Starteria."
      primaryAction={{ id: 'create-front', label: 'Crear primer frente estratégico' }}
      onAction={actionId => {
        if (actionId === 'create-front') onCreate();
      }}
    >
      <p>
        Ejemplo: reducir reprocesos operativos, aumentar adopción digital o abrir un nuevo segmento.
      </p>
    </EmptyState>
  );
}

function EmptyResultsState({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      title="No hay frentes con esos filtros"
      description="Ajusta la búsqueda o limpia los filtros para volver a ver el listado completo."
      primaryAction={{ id: 'clear-front-filters', label: 'Limpiar filtros' }}
      onAction={actionId => {
        if (actionId === 'clear-front-filters') onClear();
      }}
    />
  );
}

function MenuAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
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

function StatusBadge({ status }: { status: StrategicFrontStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${meta.tone}`} style={{ fontWeight: 700 }}>
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: StrategicFrontPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${meta.tone}`} style={{ fontWeight: 700 }}>
      Prioridad {meta.label}
    </span>
  );
}

function FrontInfoBox({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

function FrontStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>{label}</p>
      <p className="mt-2 text-sm text-slate-900" style={{ fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  onFocus,
  options,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  error?: string;
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
        onFocus={onFocus}
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

function FormField({
  label,
  value,
  onChange,
  onFocus,
  placeholder,
  helper,
  error,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  type?: 'text' | 'date';
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-700" style={{ fontWeight: 600 }}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        onFocus={onFocus}
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
  onFocus,
  placeholder,
  helper,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
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
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={4}
        className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 ${
          error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50'
        }`}
      />
      {helper ? <p className="mt-1.5 text-xs text-slate-500">{helper}</p> : null}
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </label>
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
            â€¢ {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function mapFrontToForm(front: StrategicFront): StrategicFrontFormState {
  return {
    name: front.name,
    strategicObjective: front.strategicObjective,
    whyNow: front.whyNow,
    sponsor: front.sponsor,
    sponsorEmail: front.sponsorEmail ?? '',
    mainKpi: front.mainKpi,
    baseline: front.baseline,
    target: front.target,
    threshold: front.threshold ?? '',
    area: front.area ?? '',
    horizon: front.horizon,
    endDate: front.endDate ?? '',
    priority: front.priority,
    status: front.status,
    notes: front.notes ?? '',
  };
}

function mapFormToCreateInput(form: StrategicFrontFormState, status: StrategicFrontStatus): CreateStrategicFrontInput {
  return {
    name: form.name.trim(),
    strategicObjective: form.strategicObjective.trim(),
    whyNow: form.whyNow.trim() || form.strategicObjective.trim(),
    sponsorEmail: form.sponsorEmail.trim() || undefined,
    mainKpi: form.mainKpi.trim(),
    baseline: form.baseline.trim(),
    target: form.target.trim(),
    threshold: form.threshold.trim() || undefined,
    horizon: form.horizon.trim(),
    endDate: form.endDate.trim() || undefined,
    area: form.area.trim() || undefined,
    sponsor: form.sponsor.trim(),
    priority: form.priority,
    status,
    notes: form.notes.trim() || undefined,
  };
}

function mapFormToQualityInput(form: StrategicFrontFormState) {
  return {
    name: form.name,
    strategicObjective: form.strategicObjective,
    sponsor: form.sponsor,
    sponsorEmail: form.sponsorEmail,
    mainKpi: form.mainKpi,
    baseline: form.baseline,
    target: form.target,
    threshold: form.threshold,
    area: form.area,
    horizon: form.horizon,
    endDate: form.endDate,
    priority: form.priority,
    status: form.status,
    whyNow: form.whyNow,
    notes: form.notes,
  };
}

function validateFrontForm(
  form: StrategicFrontFormState,
  { allowDraft }: { allowDraft: boolean },
): FrontFormErrors {
  const errors: FrontFormErrors = {};

  if (!form.name.trim()) errors.name = 'Define un nombre para el frente.';
  if (allowDraft) return errors;
  if (!form.strategicObjective.trim()) errors.strategicObjective = 'Describe la prioridad estratégica que quieres mover.';
  if (!form.mainKpi.trim()) errors.mainKpi = 'Agrega un KPI o señal principal.';
  if (!form.horizon.trim()) errors.horizon = 'Indica un horizonte.';
  if (!form.area.trim()) errors.area = 'Indica el área o unidad involucrada.';
  if (!form.priority.trim()) errors.priority = 'Selecciona una prioridad.';

  if (!allowDraft && !form.mainKpi.trim()) {
    errors.mainKpi = errors.mainKpi ?? 'No puedes activarlo sin un KPI principal.';
  }

  return errors;
}

function buildClarityInsight(form: StrategicFrontFormState): { goodPoints: string[]; missingPoints: string[]; nextStep: string } {
  const goodPoints: string[] = [];
  const missingPoints: string[] = [];

  if (form.name.trim()) goodPoints.push('El frente ya tiene un nombre claro.');
  if (form.strategicObjective.trim()) goodPoints.push('El objetivo estratégico está descrito.');
  if (form.area.trim()) goodPoints.push('El frente ya está conectado a un área responsable.');
  if (form.priority.trim()) goodPoints.push('La prioridad del frente ya está definida.');

  if (!form.mainKpi.trim()) missingPoints.push('Falta definir el KPI principal.');
  if (!form.target.trim()) missingPoints.push('Falta una meta esperada verificable.');
  if (!form.sponsor.trim()) missingPoints.push('Falta sponsor responsable visible.');
  if (!form.horizon.trim()) missingPoints.push('Falta horizonte temporal.');
  if (!form.threshold.trim()) missingPoints.push('Conviene agregar un umbral mínimo de avance.');

  const nextStep = !form.mainKpi.trim() || !form.target.trim()
    ? 'Convierte la meta en un indicador concreto antes de activar el frente.'
    : !form.sponsor.trim()
      ? 'Define sponsor responsable antes de mover este frente a activo.'
      : !form.threshold.trim()
        ? 'Agrega un umbral mínimo para saber cuándo el frente realmente avanza.'
        : 'Refina baseline y notas internas para que el seguimiento sea más fácil de sostener.';

  return {
    goodPoints: goodPoints.length > 0 ? goodPoints : ['Aún no hay señales suficientes para validar claridad.'],
    missingPoints: missingPoints.length > 0 ? missingPoints : ['No hay faltantes críticos visibles.'],
    nextStep,
  };
}

function buildFrontChecklist(front: StrategicFront) {
  if (front.status === 'active' || front.status === 'tracking') {
    const checklist = [
      'Mantener seguimiento de las iniciativas asociadas.',
      'Revisar profundidad de cobertura del frente.',
      front.sponsor ? 'Confirmar la próxima revisión con sponsor.' : 'Definir sponsor visible para dar continuidad.',
    ];
    return checklist;
  }

  if (front.status === 'paused') {
    return [
      'Revisar qué bloquea la reactivación.',
      'Confirmar si el sponsor sigue disponible.',
      'Definir el siguiente paso antes de volver a activarlo.',
    ];
  }

  if (front.status === 'closed') {
    return [
      'Conservar la trazabilidad de lo ya resuelto.',
      'Dejar claro qué decisión cerró este frente.',
      'Usar este frente como referencia para nuevas prioridades.',
    ];
  }

  return [
    'Completar sponsor o responsable visible.',
    'Definir retos que conviertan el frente en trabajo accionable.',
    'Confirmar qué métrica dirá si este frente avanza.',
  ];
}

function getFrontProgressLabel(front: StrategicFront) {
  if (front.status === 'closed') return 'Frente cerrado';
  if (front.status === 'paused') return 'En pausa';
  if (front.status === 'draft') return 'En definición';
  if (front.status === 'tracking') return 'En seguimiento';
  return 'En curso';
}

function getFrontProgressHelper(front: StrategicFront) {
  if (front.status === 'draft') return 'Todavía necesita definición y activación.';
  if (front.status === 'paused') return 'La ejecución está detenida temporalmente.';
  if (front.status === 'tracking') return 'Ya tiene seguimiento, pero aún requiere control cercano.';
  if (front.status === 'closed') return 'El frente quedó cerrado y solo conserva trazabilidad.';
  return 'Calculado según retos asociados e iniciativas en curso.';
}

function getTimeLabel(front: StrategicFront) {
  const source = front.lastUpdatedAt ?? front.createdAt;
  const relative = formatRelativeLabel(source);
  return front.lastUpdatedAt && front.lastUpdatedAt !== front.createdAt
    ? `Actualizado ${relative}`
    : `Creado ${relative}`;
}

function formatRelativeLabel(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  const diffMs = Date.now() - date.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

function formatDisplayDate(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compareDateDesc(left: string, right: string) {
  const leftDate = parseDate(left)?.getTime() ?? 0;
  const rightDate = parseDate(right)?.getTime() ?? 0;
  return rightDate - leftDate;
}

function getStatusWeight(status: StrategicFrontStatus) {
  const order: Partial<Record<StrategicFrontStatus, number>> = {
    active: 0,
    tracking: 1,
    draft: 2,
    paused: 3,
    closed: 4,
  };
  return order[status] ?? 2;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
