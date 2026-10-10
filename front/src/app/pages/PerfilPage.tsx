import React, { useState } from 'react';
import { User, Star, TrendingUp, Copy, Download, ChevronRight, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { isSameTeamMember, useApp } from '../context/AppContext';
import { ProgressBar } from '../components/ProgressBar';
import { StatusChip } from '../components/StatusChip';

const SKILLS_DATA = [
  { skill: 'Design Thinking', level: 4, max: 5, verified: true, badge: 'Verificado por mentor' },
  { skill: 'Facilitación', level: 3, max: 5, verified: true, badge: 'Verificado por mentor' },
  { skill: 'Investigación UX', level: 4, max: 5, verified: false, badge: 'En proceso' },
  { skill: 'Análisis de datos', level: 2, max: 5, verified: false, badge: 'En proceso' },
  { skill: 'Storytelling', level: 3, max: 5, verified: false, badge: 'En proceso' },
];

const CONTRIBUTIONS = [
  { date: '19 feb', action: 'Módulo B completado', project: 'Onboarding Digital', type: 'módulo' },
  { date: '18 feb', action: 'Evidencia subida: Dashboard métricas', project: 'Onboarding Digital', type: 'evidencia' },
  { date: '15 feb', action: 'Módulo A completado', project: 'Onboarding Digital', type: 'módulo' },
  { date: '10 feb', action: 'Step 1 aprobado por mentor', project: 'Portal de Reportes', type: 'aprobación' },
  { date: '8 feb', action: 'Sesión con mentor Carlos Méndez', project: 'Portal de Reportes', type: 'sesión' },
];

const CV_TEMPLATE = `## Experiencia en Innovación — Startería (Cohorte 2025-A)

**Proyecto: Onboarding Digital**
Diseñé y lideré un proyecto de innovación para reducir el tiempo de onboarding de empleados de 18 días a 5 días en TechCorp.

Logros:
• Identifiqué el quiebre principal en el proceso de alta de sistemas TI
• Diseñé un formulario unificado de solicitud de accesos con SLA de 24 horas
• Validé la hipótesis con piloto real: -89% en tiempo de alta, NPS 82 en empleados nuevos

Skills demostradas: Design Thinking · Facilitación · Investigación UX · Análisis de datos

Mentoría: Carlos Méndez (Estrategia e Innovación)`;

export function PerfilPage() {
  const { user, projects } = useApp();
  const [showCV, setShowCV] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState('Trabajo en transformación digital y procesos operativos. Me especializo en conectar problemas complejos con soluciones accionables.');
  const [copied, setCopied] = useState(false);

  const myProjects = user ? projects.filter(p => p.team.some(m => isSameTeamMember(m, user))) : [];
  const completedSteps = myProjects.reduce((acc, p) => acc + p.steps.filter(s => s.status === 'Aprobado').length, 0);
  const totalEvidence = myProjects.reduce((acc, p) => acc + p.evidence.filter(e => e.owner === user?.name).length, 0);

  const handleCopyCV = () => {
    navigator.clipboard?.writeText(CV_TEMPLATE).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check for contribution imbalance
  const hasImbalance = myProjects.some(p => {
    const ownerContribs = 8;
    const otherContribs = 2;
    return p.team.length > 1 && (ownerContribs / (ownerContribs + otherContribs)) > 0.7;
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl text-slate-900 mb-6" style={{ fontWeight: 700 }}>Mi perfil</h1>

      {/* Profile card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-xl text-indigo-700" style={{ fontWeight: 700 }}>
            {user?.initials}
          </div>
          <div className="flex-1">
            <h2 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>{user?.name}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full" style={{ fontWeight: 500 }}>
                {user?.role === 'owner' ? 'Participante' : user?.role === 'mentor' ? 'Mentor' : user?.role === 'admin' ? 'Administrador' : 'Sponsor'}
              </span>
              {user?.cohort && <span className="text-xs text-slate-400">{user.cohort}</span>}
            </div>
          </div>
          <button onClick={() => setEditingBio(!editingBio)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <Edit3 size={16} className="text-slate-400" />
          </button>
        </div>

        {editingBio ? (
          <div className="mt-4">
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <button onClick={() => setEditingBio(false)} className="mt-2 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>Guardar bio</button>
          </div>
        ) : (
          <p className="text-sm text-slate-600 mt-3">{bio}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Proyectos', value: myProjects.length, color: 'text-indigo-600' },
            { label: 'Steps aprobados', value: completedSteps, color: 'text-emerald-600' },
            { label: 'Evidencias', value: totalEvidence, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className={`text-xl ${s.color}`} style={{ fontWeight: 700 }}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Skills scoreboard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Skills del programa</h3>
          <span className="text-xs text-slate-400">{SKILLS_DATA.filter(s => s.verified).length} verificadas de {SKILLS_DATA.length}</span>
        </div>
        <div className="space-y-4">
          {SKILLS_DATA.map(skill => (
            <div key={skill.skill}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700" style={{ fontWeight: 500 }}>{skill.skill}</span>
                  {skill.verified && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Verificada
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: skill.max }).map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-sm ${i < skill.level ? 'bg-indigo-500' : 'bg-slate-100'}`} />
                  ))}
                </div>
              </div>
              <ProgressBar value={(skill.level / skill.max) * 100} showLabel={false} size="sm" color={skill.verified ? 'indigo' : 'auto'} />
            </div>
          ))}
        </div>
      </div>

      {/* Contribution balance */}
      {hasImbalance && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-5">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-amber-800" style={{ fontWeight: 600 }}>Desbalance de aportes detectado</p>
            <p className="text-xs text-amber-600 mt-0.5">En el proyecto "Onboarding Digital", el 78% de las contribuciones son tuyas. Recuerda involucrar a todo el equipo para un aprendizaje compartido.</p>
          </div>
        </div>
      )}

      {/* Contributions log */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <h3 className="text-slate-900 mb-4" style={{ fontWeight: 600 }}>Mis contribuciones verificables</h3>
        <div className="space-y-3">
          {CONTRIBUTIONS.map((c, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                c.type === 'aprobación' ? 'bg-emerald-100' :
                c.type === 'sesión' ? 'bg-violet-100' :
                c.type === 'evidencia' ? 'bg-blue-100' :
                'bg-indigo-100'
              }`}>
                {c.type === 'aprobación' ? <CheckCircle2 size={12} className="text-emerald-600" /> :
                 c.type === 'sesión' ? <Star size={12} className="text-violet-600" /> :
                 <TrendingUp size={12} className="text-indigo-600" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-700">{c.action}</p>
                <p className="text-xs text-slate-400">{c.project} · {c.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <h3 className="text-slate-900 mb-4" style={{ fontWeight: 600 }}>Mis proyectos</h3>
        <div className="space-y-3">
          {myProjects.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <p className="text-sm text-slate-800" style={{ fontWeight: 500 }}>{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusChip status={p.status} size="sm" />
                  <span className="text-xs text-slate-400">Step {p.currentStep} de 4</span>
                </div>
              </div>
              <ProgressBar value={p.steps.find(s => s.number === p.currentStep)?.progress ?? 0} showLabel={false} size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Export CV */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-900" style={{ fontWeight: 600 }}>Exportar para CV / LinkedIn</h3>
          <button onClick={() => setShowCV(!showCV)} className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 500 }}>
            {showCV ? 'Ocultar' : 'Previsualizar'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Texto editable con tus proyectos, skills verificadas y logros del programa. Listo para pegar en LinkedIn o tu CV.</p>

        {showCV && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">{CV_TEMPLATE}</pre>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleCopyCV} className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
            <Copy size={13} /> {copied ? '¡Copiado!' : 'Copiar texto'}
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-sm transition-colors" style={{ fontWeight: 500 }}>
            <Download size={13} /> Descargar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
