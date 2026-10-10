import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText, Image, Film, Link2, Filter, Download, History, Plus, FolderOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusChip } from '../components/StatusChip';
import { EvidenceUploader } from '../components/EvidenceUploader';
import { BannerPorDefinir } from '../components/BannerPorDefinir';
import type { Evidence, EvidenceStatus, Project } from '../context/AppContext';
import * as evidenceService from '../services/evidenceService';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PDF: <FileText size={16} className="text-red-500" />,
  Imagen: <Image size={16} className="text-blue-500" />,
  Video: <Film size={16} className="text-purple-500" />,
  Link: <Link2 size={16} className="text-indigo-500" />,
  Otro: <FileText size={16} className="text-slate-400" />,
};

const EVIDENCE_STATUS_OPTIONS: EvidenceStatus[] = ['Subida', 'Verificada', 'Rechazada'];

type EvidenceRow = {
  project: Project;
  evidence: Evidence;
};

function normalizeEvidenceStatus(status: string): EvidenceStatus {
  if (status === 'VERIFIED' || status === 'Verificada') return 'Verificada';
  if (status === 'REJECTED' || status === 'Rechazada') return 'Rechazada';
  return 'Subida';
}

function normalizeEvidenceType(type: string): Evidence['type'] {
  if (type === 'IMAGE' || type.startsWith('image/')) return 'Imagen';
  if (type === 'VIDEO' || type.startsWith('video/')) return 'Video';
  if (type === 'PDF' || type === 'application/pdf') return 'PDF';
  if (type === 'LINK' || type === 'Link') return 'Link';
  return 'Otro';
}

function getEvidenceDate(evidence: Evidence & { createdAt?: string }) {
  return evidence.date ?? evidence.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

function getEvidenceOwner(project: Project, evidence: Evidence & { ownerId?: string }) {
  if (evidence.owner) return evidence.owner;
  const teamMember = project.team?.find(member => (member as { userId?: string }).userId === evidence.ownerId || member.id === evidence.ownerId || member.email === evidence.ownerId);
  return teamMember?.name ?? project.step0Data?.nombreParticipante ?? 'Responsable pendiente';
}

function normalizeEvidence(project: Project, evidence: Evidence): Evidence {
  return {
    ...evidence,
    type: normalizeEvidenceType(evidence.type),
    status: normalizeEvidenceStatus(evidence.status),
    owner: getEvidenceOwner(project, evidence),
    date: getEvidenceDate(evidence),
  };
}

export function EvidenciasPage() {
  const { projectId } = useParams();
  const { projects, updateProject, user } = useApp();
  const navigate = useNavigate();
  const project = projectId ? projects.find(p => p.id === projectId) : null;
  const isProjectView = !!projectId;

  const visibleProjects = useMemo(
    () => (isProjectView ? (project ? [project] : []) : projects.filter(item => item.evidence.length > 0)),
    [isProjectView, project, projects],
  );

  const uploadableProjects = useMemo(
    () => (isProjectView ? (project ? [project] : []) : projects),
    [isProjectView, project, projects],
  );

  const [filterProjectId, setFilterProjectId] = useState<string | 'all'>('all');
  const [filterStep, setFilterStep] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<EvidenceStatus | 'all'>('all');
  const [showUploader, setShowUploader] = useState(false);
  const [showAudit, setShowAudit] = useState<string | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState(project?.id ?? projects[0]?.id ?? '');

  useEffect(() => {
    if (project?.id) {
      setUploadProjectId(project.id);
      return;
    }
    if (!uploadProjectId && projects[0]?.id) setUploadProjectId(projects[0].id);
  }, [project?.id, projects, uploadProjectId]);

  if (isProjectView && !project) {
    return <div className="p-6"><p className="text-slate-500">Proyecto no encontrado.</p></div>;
  }

  const allRows: EvidenceRow[] = visibleProjects.flatMap(item =>
    item.evidence.map(evidence => ({
      project: item,
      evidence: normalizeEvidence(item, evidence),
    })),
  );

  const projectFilteredRows = allRows.filter(row => {
    if (filterProjectId !== 'all' && row.project.id !== filterProjectId) return false;
    return true;
  });

  const filtered = projectFilteredRows.filter(row => {
    if (filterStep !== 'all' && row.evidence.stepRef !== filterStep) return false;
    if (filterStatus !== 'all' && row.evidence.status !== filterStatus) return false;
    return true;
  });

  const [uploadError, setUploadError] = useState<string | null>(null);

  // La evidencia se registra en el servidor; antes sólo quedaba en este navegador y se perdía al recargar.
  const handleUpload = async (file: { name: string; type: string; size?: string; url?: string }) => {
    const targetProject = uploadableProjects.find(item => item.id === uploadProjectId);
    if (!targetProject) return;

    setUploadError(null);
    const type = normalizeEvidenceType(file.type);
    try {
      const created = await evidenceService.create(targetProject.id, { name: file.name, type, size: file.size, url: file.url, stepRef: 1 });
      const newEvidence: Evidence = {
        id: created.id,
        name: file.name,
        type,
        size: file.size,
        url: file.url,
        stepRef: 1,
        owner: user?.name ?? 'Participante',
        date: new Date().toISOString().split('T')[0],
        status: 'Subida',
      };
      updateProject(targetProject.id, { evidence: [...targetProject.evidence, newEvidence] });
    } catch (err) {
      setUploadError(err instanceof Error && err.message ? err.message : 'No pudimos guardar la evidencia.');
    }
  };

  const AUDIT_LOG: Record<string, { action: string; user: string; time: string }[]> = {
    e1: [
      { action: 'Verificada por mentor', user: 'Carlos Mendez', time: '17 feb 2025, 11:00' },
      { action: 'Subida', user: 'Ana Rodriguez', time: '15 feb 2025, 09:30' },
    ],
    e2: [{ action: 'Subida', user: 'Miguel Torres', time: '17 feb 2025, 15:45' }],
    e3: [
      { action: 'Verificada por mentor', user: 'Carlos Mendez', time: '19 feb 2025, 08:00' },
      { action: 'Subida', user: 'Ana Rodriguez', time: '18 feb 2025, 14:00' },
    ],
  };

  const title = isProjectView ? 'Repositorio de evidencias' : 'Evidencias de mis proyectos';
  const subtitle = isProjectView
    ? project?.name
    : 'Revisa en un solo lugar qué evidencia pertenece a cada proyecto.';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(isProjectView && project ? `/projects/${project.id}` : '/dashboard')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" aria-label="Volver">
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-slate-500">{subtitle}</p>
          <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>{title}</h1>
        </div>
        <button
          onClick={() => setShowUploader(!showUploader)}
          disabled={uploadableProjects.length === 0}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
          style={{ fontWeight: 500 }}
        >
          <Plus size={15} /> Subir evidencia
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: projectFilteredRows.length, color: 'text-slate-700' },
          { label: 'Verificadas', value: projectFilteredRows.filter(row => row.evidence.status === 'Verificada').length, color: 'text-emerald-600' },
          { label: 'Pendientes', value: projectFilteredRows.filter(row => row.evidence.status === 'Subida').length, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-2xl ${s.color}`} style={{ fontWeight: 700 }}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {showUploader && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Subir nueva evidencia</p>
              <p className="text-xs text-slate-500 mt-0.5">Elige el proyecto para que el archivo quede asociado al lugar correcto.</p>
            </div>
            {!isProjectView && (
              <select
                value={uploadProjectId}
                onChange={event => setUploadProjectId(event.target.value)}
                className="min-w-56 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {uploadableProjects.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            )}
          </div>
          <EvidenceUploader onUpload={handleUpload} />
          {uploadError && <p role="alert" className="mt-2 text-xs text-red-600">{uploadError}</p>}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Step relacionado</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>Step 1 - Claridad en el desafio</option>
                <option>Step 2 - Disenar solucion</option>
                <option>Step 3 - Probar en pequeno</option>
                <option>Step 4 - Contar una historia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1" style={{ fontWeight: 500 }}>Modulo opcional</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>Modulo A</option>
                <option>Modulo B</option>
                <option>Modulo C</option>
                <option>Modulo D</option>
                <option>Sintesis</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-slate-400" />
          <span className="text-xs text-slate-500">Filtrar por:</span>
        </div>
        {!isProjectView && (
          <>
            <button onClick={() => setFilterProjectId('all')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterProjectId === 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filterProjectId === 'all' ? 600 : 400 }}>
              Todos los proyectos
            </button>
            {visibleProjects.map(item => (
              <button key={item.id} onClick={() => setFilterProjectId(item.id)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterProjectId === item.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filterProjectId === item.id ? 600 : 400 }}>
                {item.name}
              </button>
            ))}
            <span className="text-slate-200">|</span>
          </>
        )}
        {(['all', 1, 2, 3, 4] as const).map(s => (
          <button key={s} onClick={() => setFilterStep(s)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterStep === s ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filterStep === s ? 600 : 400 }}>
            {s === 'all' ? 'Todos los steps' : `Step ${s}`}
          </button>
        ))}
        <span className="text-slate-200">|</span>
        {(['all', ...EVIDENCE_STATUS_OPTIONS] as const).map(st => (
          <button key={st} onClick={() => setFilterStatus(st)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterStatus === st ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`} style={{ fontWeight: filterStatus === st ? 600 : 400 }}>
            {st === 'all' ? 'Todos los estados' : st}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-slate-500 mb-2">{allRows.length === 0 ? 'Todavia no hay evidencias en tus proyectos.' : 'No hay evidencias con ese filtro.'}</p>
          <button onClick={() => setShowUploader(true)} className="text-indigo-600 text-sm" style={{ fontWeight: 500 }}>Subir primera evidencia</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ project: rowProject, evidence }) => (
            <div key={`${rowProject.id}-${evidence.id}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  {TYPE_ICONS[evidence.type] ?? TYPE_ICONS.Otro}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-800 truncate" style={{ fontWeight: 600 }}>{evidence.name}</p>
                    <StatusChip status={evidence.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                    {!isProjectView && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700" style={{ fontWeight: 600 }}>
                        <FolderOpen size={11} /> {rowProject.name}
                      </span>
                    )}
                    <span>Step {evidence.stepRef}{evidence.moduleRef ? ` - Modulo ${evidence.moduleRef}` : ''}</span>
                    {evidence.size && <span>{evidence.size}</span>}
                    <span>{evidence.owner}</span>
                    <span>{evidence.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setShowAudit(showAudit === evidence.id ? null : evidence.id)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Ver historial">
                    <History size={14} className="text-slate-400" />
                  </button>
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Descargar">
                    <Download size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {showAudit === evidence.id && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>HISTORIAL DE CAMBIOS</p>
                  <div className="space-y-2">
                    {(AUDIT_LOG[evidence.id] ?? [{ action: 'Subida', user: evidence.owner, time: evidence.date }]).map((log, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                        <span>{log.action}</span>
                        <span className="text-slate-400">- {log.user} - {log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <BannerPorDefinir
          title="Comportamiento de eliminacion de evidencias"
          question="Que pasa cuando se elimina una evidencia: se elimina permanentemente, se archiva o se marca como inactiva? Quien puede eliminar: solo el owner o tambien el mentor?"
          context="missing"
        />
      </div>

      <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
        <span style={{ fontWeight: 600 }}>Acceso restringido: </span>
        Solo los miembros activos de cada proyecto pueden ver y descargar sus evidencias. Si alguien sale del equipo, pierde acceso automaticamente.
      </div>
    </div>
  );
}
