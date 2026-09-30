import React, { useMemo } from 'react';
import { Bot, FilePlus2, Flag, GitPullRequestArrow, Lightbulb, RotateCcw, X } from 'lucide-react';
import type { CopilotClient } from '../api/copilot-client';
import type { PortfolioCopilotSessionDto } from '../domain/copilot.types';
import { useCopilotConversation } from '../hooks/useCopilotConversation';
import { ActionPlanCard } from './ActionPlanCard';
import { CopilotComposer } from './CopilotComposer';
import { CopilotConversation } from './CopilotConversation';
import { ExecutionResultCard } from './ExecutionResultCard';
import { ExecutionStatusCard } from './ExecutionStatusCard';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../app/components/ui/sheet';
import { Button } from '../../../app/components/ui/button';

type IntentOption = {
  intent: PortfolioCopilotSessionDto['intent'];
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  prompt: string;
};

const INTENT_OPTIONS: IntentOption[] = [
  {
    intent: 'create_strategic_front',
    title: 'Crear un frente estrategico',
    description: 'Convierte una prioridad del negocio en un objetivo medible.',
    icon: Flag,
    prompt: 'Quiero crear un frente estrategico.',
  },
  {
    intent: 'create_challenge',
    title: 'Crear un reto',
    description: 'Aterriza un frente en un problema, oportunidad o exploracion accionable.',
    icon: GitPullRequestArrow,
    prompt: 'Quiero crear un reto.',
  },
  {
    intent: 'create_initiative',
    title: 'Crear una iniciativa',
    description: 'Estructura una respuesta concreta para abordar un reto.',
    icon: Lightbulb,
    prompt: 'Quiero crear una iniciativa.',
  },
];

export function PortfolioCopilotLauncher({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick} className="gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800">
      <Bot size={16} />
      Crear con Copilot
    </Button>
  );
}

export function PortfolioCopilotDrawer({
  open,
  onOpenChange,
  client,
  onPortfolioRefresh,
  setupMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: CopilotClient;
  onPortfolioRefresh?: () => Promise<void> | void;
  setupMode?: boolean;
}) {
  const copilot = useCopilotConversation({ client, onPortfolioRefresh });
  const busy = copilot.isLoading || copilot.isSending || copilot.isMutating;
  const session = useMemo(() => getPortfolioSession(copilot.assessment?.detectedEntities), [copilot.assessment]);
  const actionLabel = getActionLabel(session?.intent);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-full gap-0 overflow-hidden bg-slate-50 p-0 sm:max-w-[86vw] lg:max-w-[820px]"
        aria-label="Portfolio Copilot"
      >
        <SheetHeader className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <p className="text-xs uppercase text-slate-500" style={{ fontWeight: 700 }}>Portfolio Copilot</p>
              <SheetTitle className="mt-1 text-xl text-slate-950">{actionLabel}</SheetTitle>
              <SheetDescription>
                Prepara una propuesta para revisar antes de modificar el portafolio.
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => window.sessionStorage.removeItem('starteria.portfolioCopilot.conversationId')}>
                <RotateCcw size={14} />
                Reiniciar
              </Button>
              <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => onOpenChange(false)} aria-label="Cerrar Copilot">
                <X size={16} />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden lg:grid-cols-[1fr_300px] lg:grid-rows-1">
          <main className="min-h-0 overflow-y-auto p-5">
            {!session && copilot.messages.length === 0 && setupMode ? (
              <section aria-label="Orientación inicial de Copilot" className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-slate-500" style={{ fontWeight: 700 }}>Primeros pasos</p>
                  <h2 className="mt-1 text-2xl text-slate-950" style={{ fontWeight: 800 }}>Cuéntame qué quieres conseguir y te ayudo a ordenarlo.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">También puedes contarme qué información tienes hoy. Startería te ayudará a entenderla antes de introducir estructura.</p>
                </div>
                <CopilotComposer disabled={busy} onSend={copilot.sendMessage} placeholder="Cuéntame qué quieres conseguir..." />
                {copilot.isSending && <p role="status" className="text-sm text-slate-500">Entendiendo tu situación...</p>}
                {copilot.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{copilot.error}</p>}
              </section>
            ) : !session && copilot.messages.length === 0 ? (
              <PortfolioCopilotIntentSelector disabled={busy} onSelect={(option) => copilot.sendMessage(option.prompt)} />
            ) : (
              <div className="space-y-4">
                <CopilotConversation messages={copilot.messages} />
                <CopilotComposer disabled={busy} onSend={copilot.sendMessage} />
                {copilot.isSending && <p role="status" className="text-sm text-slate-500">Interpretando solicitud...</p>}
                {copilot.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{copilot.error}</p>}
              </div>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto border-t border-slate-200 bg-white p-5 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <PortfolioCopilotProgress session={session} />
              <PortfolioCopilotContextSummary session={session} />
              <PortfolioCopilotProposalReview
                plan={copilot.actionPlan}
                disabled={busy}
                activeExecution={copilot.activeExecution}
                onSaveAction={copilot.updateAction}
                onApproveAction={copilot.approveAction}
                onRejectAction={copilot.rejectAction}
                onExecuteAction={copilot.executeAction}
              />
              <ExecutionStatusCard execution={copilot.activeExecution} />
              <ExecutionResultCard
                action={copilot.primaryAction}
                execution={copilot.activeExecution}
                refreshWarning={copilot.pendingRefreshWarning}
              />
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PortfolioCopilotIntentSelector({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (option: IntentOption) => void;
}) {
  return (
    <section aria-label="Seleccion de intencion">
      <h2 className="text-2xl text-slate-950" style={{ fontWeight: 800 }}>Que quieres estructurar?</h2>
      <div className="mt-5 grid gap-3">
        {INTENT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.intent}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option)}
              className="flex min-h-24 items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <Icon size={18} />
              </span>
              <span>
                <span className="block text-base text-slate-950" style={{ fontWeight: 750 }}>{option.title}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function PortfolioCopilotProgress({ session }: { session: PortfolioCopilotSessionDto | null }) {
  const total = session ? session.askedFieldKeys.length + session.missingRequiredFields.length : 0;
  const done = session ? Math.max(0, total - session.missingRequiredFields.length) : 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Progreso Copilot">
      <p className="text-xs uppercase text-slate-500" style={{ fontWeight: 700 }}>Progreso</p>
      <p className="mt-1 text-lg text-slate-950" style={{ fontWeight: 800 }}>
        {session ? `${done} de ${Math.max(total, done)} datos clave` : 'Sesion nueva'}
      </p>
      {session?.missingRequiredFields.length ? (
        <p className="mt-2 text-sm text-slate-600">Falta definir {formatFieldList(session.missingRequiredFields)}.</p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Selecciona que quieres crear para iniciar.</p>
      )}
    </section>
  );
}

export function PortfolioCopilotContextSummary({ session }: { session: PortfolioCopilotSessionDto | null }) {
  const fields = Object.entries(session?.collectedFields ?? {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  if (fields.length === 0) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Lo que ya entendi">
      <p className="text-xs uppercase text-slate-500" style={{ fontWeight: 700 }}>Lo que ya entendi</p>
      <dl className="mt-3 space-y-3">
        {fields.map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs text-slate-500">{fieldLabel(key)}</dt>
            <dd className="text-sm text-slate-900" style={{ fontWeight: 650 }}>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PortfolioCopilotProposalReview(props: React.ComponentProps<typeof ActionPlanCard>) {
  if (!props.plan) return null;
  return <ActionPlanCard {...props} />;
}

function getPortfolioSession(entities?: Record<string, unknown>): PortfolioCopilotSessionDto | null {
  const session = entities?.portfolioCopilotSession;
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  return session as PortfolioCopilotSessionDto;
}

function getActionLabel(intent?: PortfolioCopilotSessionDto['intent']) {
  if (intent === 'create_strategic_front') return 'Creando frente estrategico';
  if (intent === 'create_challenge') return 'Creando reto';
  if (intent === 'create_initiative') return 'Creando iniciativa';
  return 'Que quieres estructurar?';
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    name: 'Nombre',
    objective: 'Objetivo',
    mainKpi: 'KPI principal',
    baseline: 'Baseline',
    target: 'Meta',
    horizon: 'Horizonte',
    areaOrBusinessUnit: 'Area o unidad',
    priority: 'Prioridad',
    sponsor: 'Sponsor',
  };
  return labels[field] ?? field;
}

function formatFieldList(fields: string[]) {
  return fields.map(fieldLabel).join(', ');
}
