import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../../../app/components/ui/button';
import { Textarea } from '../../../app/components/ui/textarea';

export function CopilotComposer({
  disabled,
  onSend,
  placeholder = 'Crea un frente llamado Eficiencia operativa...',
}: {
  disabled: boolean;
  onSend: (content: string) => Promise<void> | void;
  placeholder?: string;
}) {
  const [content, setContent] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setLocalError('Escribe una solicitud antes de enviarla.');
      return;
    }
    setLocalError(null);
    await onSend(trimmed);
    setContent('');
  };

  return (
    <div>
      <label htmlFor="portfolio-copilot-composer" className="sr-only">
        Mensaje para Portfolio Copilot
      </label>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <Textarea
          id="portfolio-copilot-composer"
          value={content}
          disabled={disabled}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          className="min-h-24 flex-1 rounded-2xl border-slate-200 bg-white"
          aria-invalid={!!localError}
          aria-describedby={localError ? 'portfolio-copilot-composer-error' : undefined}
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={disabled}
          className="h-12 rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800"
        >
          <Send className="size-4" />
          Enviar
        </Button>
      </div>
      {localError && (
        <p id="portfolio-copilot-composer-error" role="alert" className="mt-2 text-sm text-rose-600">
          {localError}
        </p>
      )}
    </div>
  );
}

