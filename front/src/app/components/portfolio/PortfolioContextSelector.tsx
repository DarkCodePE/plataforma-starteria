import React, { useState } from 'react';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { getPortfolioContext, selectPortfolioContext, type PortfolioContextView } from '../../services/portfolioService';

type Props = { context?: PortfolioContextView; required?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; onSelected: () => Promise<void> | void };

export function PortfolioContextSelector({ context, required = false, open: controlledOpen, onOpenChange, onSelected }: Props) {
  const [openState, setOpenState] = useState(false);
  const [view, setView] = useState(context);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectionError, setSelectionError] = useState<'unauthorized' | 'technical' | null>(null);
  const open = controlledOpen ?? openState;
  const current = context?.current ?? view?.current;
  const options = view?.options ?? context?.options ?? [];
  const setOpen = (next: boolean) => { setOpenState(next); onOpenChange?.(next); };

  const openSelector = async () => {
    setOpen(true); setLoading(true); setLoadError(false); setSelectionError(null);
    try { setView(await getPortfolioContext()); } catch { setLoadError(true); } finally { setLoading(false); }
  };

  const choose = async (organizationId: string) => {
    setLoading(true); setSelectionError(null);
    try { await selectPortfolioContext(organizationId); setOpen(false); await onSelected(); }
    catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setSelectionError(status === 403 ? 'unauthorized' : 'technical');
      if (status === 403) { try { setView(await getPortfolioContext()); } catch { /* keep the current server view */ } }
    } finally { setLoading(false); }
  };

  const canSwitch = options.length > 1 || required || view?.status === 'not_authorized';
  if (!canSwitch && current) return <span className="inline-flex items-center rounded-ds-sm border border-border-default bg-background-subtle px-3 py-2 text-sm font-medium text-text-primary" aria-label={`Espacio actual: ${current.name}`}>{current.name}</span>;

  return <>
    <Button type="button" variant={required ? 'primary' : 'outline'} onClick={() => void openSelector()} aria-haspopup="dialog">
      {required ? 'Seleccionar espacio' : (current?.name ?? 'Cambiar espacio')}{!required ? <ChevronDown aria-hidden="true" /> : null}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Selecciona tu espacio</DialogTitle><DialogDescription>Tienes acceso a más de un portafolio. Elige cuál quieres consultar.</DialogDescription></DialogHeader>
        {loading && !options.length ? <p className="text-sm text-text-secondary">Cargando espacios…</p> : null}
        {loadError ? <div className="space-y-3 text-sm text-text-secondary"><p>No pudimos cargar tus espacios.</p><Button type="button" variant="secondary" onClick={() => void openSelector()}><RefreshCw aria-hidden="true" />Reintentar</Button></div> : null}
        {selectionError === 'unauthorized' ? <p role="alert" className="text-sm text-text-secondary">Ya no tienes acceso a este espacio.</p> : null}
        {selectionError === 'technical' ? <p role="alert" className="text-sm text-text-secondary">No pudimos cambiar de espacio. Inténtalo nuevamente.</p> : null}
        <div role="listbox" aria-label="Espacios Portfolio" className="space-y-2">
          {options.map(option => <button key={option.organizationId} type="button" role="option" aria-selected={option.organizationId === current?.organizationId} disabled={loading} onClick={() => void choose(option.organizationId)} className="flex w-full items-center justify-between rounded-ds-sm border border-border-default px-4 py-3 text-left text-sm text-text-primary hover:bg-background-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"><span>{option.name}</span>{option.organizationId === current?.organizationId ? <Check aria-hidden="true" className="size-4" /> : null}</button>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
