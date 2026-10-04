import React from 'react';
import {
  ArrowRight,
  Flag,
  Rocket,
  Sparkles,
  Target,
  UploadCloud,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ReconstructionPanel } from '../../../features/portfolio-lead/components/cards/ReconstructionPanel';

type StartOptionTone = 'emerald' | 'amber' | 'violet' | 'sky';

type StartOption = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  badge: string;
  tone: StartOptionTone;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  muted?: boolean;
};

const optionToneClasses: Record<StartOptionTone, string> = {
  emerald: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50/80 text-amber-900',
  violet: 'border-violet-200 bg-violet-50/80 text-violet-900',
  sky: 'border-sky-200 bg-sky-50/80 text-sky-900',
};

const iconToneClasses: Record<StartOptionTone, string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  violet: 'text-violet-700',
  sky: 'text-sky-700',
};

export function PortfolioLeadStartExperience({
  importOpen,
  onImportOpenChange,
  onNavigate,
}: {
  importOpen: boolean;
  onImportOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}) {
  // Las opciones nombran el Job, no el objeto de dominio (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md
  // §1, §24–§25). El mecanismo de Starteria queda como etiqueta secundaria: con sesión iniciada sigue
  // siendo útil saber adónde lleva cada acción.
  const options: StartOption[] = [
    {
      id: 'front',
      title: 'Tengo un resultado de negocio que quiero mover',
      description: 'Aclara qué quiere conseguir el negocio, cómo se notaría (KPI, baseline, meta) y en qué horizonte.',
      actionLabel: 'Definir el resultado',
      badge: 'Frente estratégico',
      tone: 'emerald',
      icon: Target,
      onClick: () => onNavigate('/portfolio/frentes-estrategicos'),
    },
    {
      id: 'import',
      title: 'Ya hay mucho trabajo y necesito saber dónde estamos',
      description: 'Trae iniciativas, pilotos o documentos existentes para leer qué se puede sostener y qué falta para decidir.',
      actionLabel: 'Leer lo que ya existe',
      badge: 'Reconstrucción',
      tone: 'amber',
      icon: UploadCloud,
      onClick: () => onImportOpenChange(true),
    },
    {
      id: 'challenge',
      title: 'Tengo un problema u oportunidad concreta para activar equipos',
      description: 'Convierte una prioridad en un espacio de intervención con contexto, restricciones y una decisión esperada.',
      actionLabel: 'Definir el espacio de intervención',
      badge: 'Reto',
      tone: 'violet',
      icon: Flag,
      onClick: () => onNavigate('/portfolio/retos'),
    },
    {
      id: 'initiative',
      title: 'Tengo algo que quiero sacar adelante',
      description: 'Empieza una iniciativa propia sin inventar estructura corporativa: el contexto se arma en el camino.',
      actionLabel: 'Empezar una iniciativa',
      badge: 'Iniciativa',
      tone: 'sky',
      icon: Rocket,
      onClick: () => onNavigate('/portfolio/iniciativas'),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#fff4dc_0%,#ffffff_55%,#eaf2ff_100%)] p-6 shadow-sm md:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] tracking-[0.18em] text-slate-500">
            <Sparkles size={12} />
            PUNTO DE ENTRADA
          </div>
          <h1 className="mt-4 text-3xl text-slate-950 md:text-4xl" style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
            ¿Qué necesitas mover?
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-[15px]">
            Elige lo que más se parece a tu situación. Starteria propone la estructura después; no hace falta decidir de
            entrada si esto es un frente, un reto o una iniciativa.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {options.map(option => {
          const Icon = option.icon;
          return (
            <Card key={option.id} className={`border p-0 shadow-sm ${optionToneClasses[option.tone]}`}>
              <CardHeader className="gap-4 px-6 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 ring-1 ring-black/5 ${iconToneClasses[option.tone]}`}>
                    <Icon size={18} />
                  </div>
                  <Badge variant="outline" className="border-white/70 bg-white/85 text-slate-700">
                    {option.badge}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-950" style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {option.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm text-slate-600">
                    {option.description}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="px-6 pb-6">
                <Button
                  type="button"
                  variant={option.muted ? 'secondary' : 'outline'}
                  className="w-full justify-center rounded-2xl"
                  onClick={option.onClick}
                >
                  {option.actionLabel}
                  <ArrowRight size={14} />
                </Button>
                {option.muted ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Todavía no abre un flujo real. Solo prepara la entrada de importación.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Dialog open={importOpen} onOpenChange={onImportOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>¿Dónde estamos realmente?</DialogTitle>
            <DialogDescription>
              Describe un piloto o una iniciativa en curso y la evidencia que ya tienen. Starteria lee qué se puede
              sostener, qué se contradice y qué falta para decidir, sin reiniciar el trabajo desde cero.
            </DialogDescription>
          </DialogHeader>
          <ReconstructionPanel />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onImportOpenChange(false)} className="rounded-2xl">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
