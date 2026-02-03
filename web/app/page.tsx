'use client';

import { useState, useEffect } from 'react';

const DEFAULT_CORE_HOST =
  typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || `http://${DEFAULT_CORE_HOST}:3001`;
const POLL_INTERVAL_MS = 3000;

type SystemState = {
  status: 'idle' | 'processing' | 'alert';
  lastEvent: VeridisEvent | null;
  updatedAt: string;
};

type VeridisEvent = {
  type: string;
  source: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  payload?: unknown;
  timestamp: string;
};

function buildSummary(state: SystemState): string {
  if (state.lastEvent) {
    const ev = state.lastEvent;
    if (ev.level === 'critical') {
      return `Alerta crítica: ${ev.message}`;
    }
    if (ev.level === 'warning') {
      return `Atención requerida: ${ev.message}`;
    }
    return `Info: ${ev.message}`;
  }
  if (state.status === 'processing') {
    return 'Sistema procesando. Actividad en progreso.';
  }
  if (!state.lastEvent) {
    return 'Sistema en reposo. Sin actividad reciente.';
  }
  const ev = state.lastEvent;
  const type = 'type' in ev ? String(ev.type) : 'evento';
  const source = 'source' in ev ? String(ev.source) : 'desconocido';
  return `Sistema en reposo. Último evento: ${type} de ${source}.`;
}

function buildSuggestedActions(state: SystemState): string[] {
  if (state.status === 'alert') {
    return ['Revisar alertas', 'Ver detalles del evento'];
  }
  if (state.status === 'processing') {
    return ['Esperar finalización', 'Revisar flujo de eventos'];
  }
  return ['Ver estado del sistema', 'Ver eventos recientes'];
}

function getLevelStatus(level?: VeridisEvent['level']): SystemState['status'] {
  if (level === 'critical') return 'alert';
  if (level === 'warning') return 'processing';
  return 'idle';
}

const TEST_EVENT = {
  type: 'system.test',
  message: 'Primer evento VERIDIS',
  source: 'manual',
  level: 'info' as const,
  timestamp: new Date().toISOString(),
};

export default function Home() {
  const [state, setState] = useState<SystemState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function emitTestEvent() {
    setSending(true);
    try {
      const res = await fetch(`${CORE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_EVENT),
      });
      if (res.ok) {
        const json = await res.json();
        setState(json);
        setError(null);
      }
    } catch {
      setError('Core unreachable');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch(`${CORE_URL}/state`);
        if (res.ok) {
          const json = await res.json();
          setState(json);
          setError(null);
        } else {
          setError(`Core returned ${res.status}`);
        }
      } catch {
        setError('Core unreachable');
        setState(null);
      }
    }

    fetchState();
    const id = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const statusColor = {
    idle: 'text-zinc-400',
    processing: 'text-amber-500',
    alert: 'text-red-500',
  };

  const levelStatus = getLevelStatus(state?.lastEvent?.level);
  const summary = state ? buildSummary(state) : null;
  const suggestedActions = state ? buildSuggestedActions(state) : [];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 font-mono text-sm p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-zinc-100 text-lg tracking-tight">VERIDIS</h1>
          <p className="text-zinc-600 text-xs mt-0.5">Asistente digital · 642 Studio</p>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-sm ${
                error ? 'bg-red-600' : 'bg-zinc-500'
              }`}
            />
            <span className="text-xs text-zinc-500">
              {error ?? (state ? 'Conectado' : 'Conectando...')}
            </span>
          </div>
        </header>

        <section className="border border-zinc-800 rounded p-4">
          <h2 className="text-zinc-500 text-xs uppercase tracking-wider mb-2">
            Estado
          </h2>
          <p className={state ? statusColor[levelStatus] : 'text-zinc-600'}>
            {state?.status ?? '—'}
          </p>
          <button
            type="button"
            onClick={emitTestEvent}
            disabled={sending || !!error}
            className="mt-3 px-3 py-1.5 text-xs border border-zinc-600 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Enviando…' : 'Emitir evento test'}
          </button>
        </section>

        <section className="border border-zinc-800 rounded p-4 min-h-[120px]">
          <h2 className="text-zinc-500 text-xs uppercase tracking-wider mb-2">
            Asistente
          </h2>
          <div className="text-zinc-400 text-sm leading-relaxed">
            {summary ?? (error ? '—' : 'Cargando...')}
          </div>
          {suggestedActions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-zinc-600 text-xs mb-1">Sugerido:</p>
              <ul className="text-zinc-500 text-xs space-y-0.5">
                {suggestedActions.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="border border-zinc-800 rounded p-4">
          <h2 className="text-zinc-500 text-xs uppercase tracking-wider mb-2">
            Registro de eventos
          </h2>
          <ul className="space-y-1 text-xs">
            {state?.lastEvent ? (
              <li className="flex gap-3 text-zinc-500 py-0.5 border-b border-zinc-900/50">
                <span className="text-zinc-600 shrink-0">
                  {new Date(state.updatedAt).toLocaleTimeString()}
                </span>
                <span className="text-zinc-400">
                  {'type' in state.lastEvent ? String(state.lastEvent.type) : 'evento'}
                </span>
                <span className="text-zinc-600">
                  {'source' in state.lastEvent ? String(state.lastEvent.source) : '—'}
                </span>
              </li>
            ) : (
              <li className="text-zinc-600 py-2">Sin eventos</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
