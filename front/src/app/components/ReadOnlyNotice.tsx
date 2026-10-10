import React from 'react';
import { Eye } from 'lucide-react';

/**
 * Aviso de sólo lectura en las páginas de la iniciativa. Lo pinta quien no puede escribir
 * (Viewer, Sponsor, Portfolio Lead que revisa): los controles de edición se ocultan y esto
 * explica por qué, en vez de dejar que el backend responda 403.
 */
export function ReadOnlyNotice({ reason, className = '' }: { reason: string | null; className?: string }) {
  if (!reason) return null;
  return (
    <div
      role="note"
      aria-label="Sólo lectura"
      className={`flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 ${className}`}
    >
      <Eye size={15} className="mt-0.5 shrink-0 text-slate-500" />
      <span>{reason}</span>
    </div>
  );
}
