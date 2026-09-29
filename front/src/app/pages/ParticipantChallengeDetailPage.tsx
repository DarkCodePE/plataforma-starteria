import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { buildLegacyChallengeProjectPath } from '../routes/legacy-route-boundary';
import { ArrowLeft, FolderOpen, Layers3, Lightbulb, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { usePortfolioLead } from '../portfolio/PortfolioLeadContext';
import { activationLabel, challengeStatusLabel, challengeTypeLabel } from '../portfolio/portfolioLeadCopy';

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-800" style={{ fontWeight: 600 }}>{value}</p>
    </div>
  );
}

export function ParticipantChallengeDetailPage() {
  const { challengeId } = useParams();
  const { user } = useApp();
  const { challenges, strategicFronts, initiatives } = usePortfolioLead();
  const navigate = useNavigate();

  const participantEmail = user?.email?.toLowerCase() ?? '';
  const participantName = user?.name?.toLowerCase() ?? '';
  const challenge = challenges.find(item => item.id === challengeId) ?? null;
  const front = challenge ? strategicFronts.find(item => item.id === challenge.strategicFrontId) ?? null : null;
  const relatedInitiatives = challenge ? initiatives.filter(item => item.challengeId === challenge.id) : [];
  const isInvited = !!challenge?.selectedPeople.some(person => person.value.toLowerCase() === participantEmail);
  const isAssignedToSquad = !!challenge?.assignedSquad.some(member => member.value.toLowerCase() === participantName);
  const canAccessChallenge = !!challenge && challenge.visibleToParticipants && (
    challenge.activationMode === 'convocatoria_abierta'
      || isInvited
      || isAssignedToSquad
  );

  if (user?.role !== 'owner') {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900" style={{ fontWeight: 700 }}>Vista disponible solo para Participante</p>
          <p className="mt-1 text-sm text-amber-700">
            Este detalle existe para revisar retos desde la bandeja del perfil Participante, sin abrir un workspace ni afectar otros roles.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm text-white transition-colors hover:bg-amber-700"
            style={{ fontWeight: 600 }}
          >
            Volver a Mis proyectos
          </button>
        </div>
      </div>
    );
  }

  if (!challenge || !canAccessChallenge) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={15} /> Volver a Mis proyectos
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <FolderOpen size={22} />
          </div>
          <h1 className="mt-4 text-lg text-slate-900" style={{ fontWeight: 700 }}>No pudimos abrir este reto</h1>
          <p className="mt-2 text-sm text-slate-500">
            Este reto no esta disponible para tu bandeja actual o todavia no fue publicado para participantes.
          </p>
        </div>
      </div>
    );
  }

  const initiativeCount = challenge.initiativeCount || relatedInitiatives.length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={15} /> Volver a Mis proyectos
      </button>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{challengeStatusLabel(challenge.status)}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{activationLabel(challenge.activationMode)}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{challengeTypeLabel(challenge.challengeType)}</span>
            </div>
            <h1 className="mt-4 text-2xl text-slate-950" style={{ fontWeight: 700 }}>{challenge.name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {front?.name ?? 'Sin frente'} · Revisa primero el contexto del reto antes de decidir si luego quieres abrir una iniciativa.
            </p>
          </div>

          <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Iniciativas asociadas</p>
            <p className="mt-2 flex items-center gap-2 text-2xl text-slate-900" style={{ fontWeight: 700 }}>
              <Layers3 size={20} className="text-slate-500" />
              {initiativeCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {initiativeCount === 0
                ? 'Todavia no hay iniciativas visibles asociadas a este reto.'
                : `Ya hay ${initiativeCount} iniciativa${initiativeCount !== 1 ? 's' : ''} vinculada${initiativeCount !== 1 ? 's' : ''}.`}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sky-700" />
            <div>
              <p className="text-sm text-sky-900" style={{ fontWeight: 700 }}>Abrir este reto no te suma automaticamente</p>
              <p className="mt-1 text-sm text-sky-800">
                Esta vista es solo de lectura. Entrar aqui no acepta participacion, no crea proyecto y no registra una postulacion por tu cuenta.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Frente" value={front?.name ?? 'Sin frente'} />
          <InfoCard label="Tipo de reto" value={challengeTypeLabel(challenge.challengeType)} />
          <InfoCard label="Modalidad" value={activationLabel(challenge.activationMode)} />
          <InfoCard label="Estado visible" value={challengeStatusLabel(challenge.status)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-slate-700" />
              <h2 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>De que trata este reto</h2>
            </div>
            <p className="mt-3 text-sm text-slate-700">{challenge.objective}</p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Que se quiere mover</p>
                <p className="mt-1 text-sm text-slate-700">{challenge.whatWeWantToMove}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Por que importa ahora</p>
                <p className="mt-1 text-sm text-slate-700">{challenge.whyNow}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>Criterio de avance esperado</p>
                <p className="mt-1 text-sm text-slate-700">{challenge.successCriteria}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Como leer esta vista</p>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p>Que esta bien: el reto ya esta visible para que entiendas su foco y su modalidad.</p>
                <p>Que falta: todavia no se registra ninguna decision tuya solo por haberlo abierto.</p>
                <p>Siguiente accion recomendada: revisa si este reto realmente conecta con el problema que quieres trabajar antes de crear una iniciativa.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Tu acceso actual</p>
              <p className="mt-2 text-sm text-slate-600">
                {challenge.activationMode === 'convocatoria_abierta'
                  ? 'Este reto esta abierto para participantes habilitados del programa.'
                  : isInvited
                    ? 'Este reto llego a tu bandeja porque fuiste invitado directamente.'
                    : isAssignedToSquad
                      ? 'Este reto llego a tu bandeja porque formas parte del squad asociado.'
                      : 'Tienes acceso de lectura a este reto dentro de tu bandeja actual.'}
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Iniciativa dentro de este reto</p>
              <p className="mt-2 text-sm text-slate-600">
                Si este reto si conecta con lo que quieres mover, crea la iniciativa desde aqui para que Step 0 herede su contexto.
              </p>
              <button
                // KEEP_COMPAT: participant Challenge -> Project flow; not Handoff.
                onClick={() => navigate(buildLegacyChallengeProjectPath(challenge.id))}
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700"
                style={{ fontWeight: 600 }}
              >
                Crear iniciativa dentro del reto
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Proyecto independiente</p>
              <p className="mt-2 text-sm text-slate-600">
                Si este reto no encaja con lo que quieres mover, puedes seguir creando un proyecto propio fuera de cualquier reto.
              </p>
              <button
                onClick={() => navigate('/projects/new')}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-800"
                style={{ fontWeight: 600 }}
              >
                Crear proyecto independiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
