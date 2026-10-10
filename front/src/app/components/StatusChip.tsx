import React from 'react';

type StatusType =
  | 'Draft'
  | 'En progreso'
  | 'En revisión IA'
  | 'Iteración'
  | 'Sesión experto pendiente'
  | 'Paso aprobado'
  | 'Finalizado'
  | 'No iniciado'
  | 'Enviado'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Aprobado'
  | 'Bloqueado'
  | 'Completado'
  | 'En ejecución'
  | 'Cerrado'
  | 'Revisar cambios'
  | 'Subida'
  | 'Verificada'
  | 'Rechazada'
  | 'Pendiente'
  | 'Pendiente de convocatoria'
  | 'Revisión solicitada'
  | 'Sesión agendada'
  | 'Comentario enviado'
  | 'Activo'
  | 'Bajo'
  | 'Medio'
  | 'Alto';

const CONFIG: Record<string, { bg: string; text: string; dot: string; label?: string }> = {
  'Draft':                    { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'En progreso':              { bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  'En revisión IA':           { bg: 'bg-violet-50',text: 'text-violet-700',dot: 'bg-violet-500' },
  'Iteración':                { bg: 'bg-orange-50',text: 'text-orange-700',dot: 'bg-orange-500' },
  'Sesión experto pendiente': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Paso aprobado':            { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Step aprobado':            { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Finalizado':               { bg: 'bg-emerald-100',text: 'text-emerald-800',dot: 'bg-emerald-600' },
  'No iniciado':              { bg: 'bg-slate-100', text: 'text-slate-500',  dot: 'bg-slate-300' },
  'Enviado':                  { bg: 'bg-blue-50',   text: 'text-blue-600',  dot: 'bg-blue-400' },
  'Feedback IA':              { bg: 'bg-violet-50', text: 'text-violet-700',dot: 'bg-violet-500' },
  'Ajustado':                 { bg: 'bg-orange-50', text: 'text-orange-700',dot: 'bg-orange-500' },
  'Aprobado':                 { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Bloqueado':                { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500' },
  'Completado':               { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'En ejecución':             { bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500' },
  'Cerrado':                  { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
  'Cerrada':                  { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
  'Lista para decisión':      { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Bloqueada':                { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500' },
  'Revisar cambios':          { bg: 'bg-orange-50', text: 'text-orange-700',dot: 'bg-orange-500' },
  'Subida':                   { bg: 'bg-sky-50',    text: 'text-sky-700',   dot: 'bg-sky-500' },
  'Verificada':               { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Rechazada':                { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500' },
  'Pendiente':                { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
  'Pendiente de convocatoria': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  'Revisión solicitada':      { bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500' },
  'Sesión agendada':          { bg: 'bg-violet-50', text: 'text-violet-700',dot: 'bg-violet-500' },
  'Comentario enviado':      { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Activo':                   { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Bajo':                     { bg: 'bg-emerald-50',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  'Medio':                    { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-500' },
  'Alto':                     { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500' },
};

interface StatusChipProps {
  status: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function StatusChip({ status, size = 'md', showDot = true }: StatusChipProps) {
  const cfg = CONFIG[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-full ${sizeClass} ${cfg.bg} ${cfg.text}`} style={{ fontWeight: 500 }}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />}
      {status}
    </span>
  );
}
