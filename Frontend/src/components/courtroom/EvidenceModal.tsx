import React from 'react';
import { X, ShieldAlert, CheckCircle2, Clock, Database, Layers } from 'lucide-react';
import { CourtroomArgument } from '../../types';

interface EvidenceModalProps {
  argument: CourtroomArgument | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ argument, onClose }) => {
  if (!argument) return null;

  const isProsecution = argument.role === 'PROSECUTION';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-ghost-bg border border-ghost-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ghost-border bg-ghost-card/70">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isProsecution
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {isProsecution ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isProsecution ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {argument.role} COUNSEL EVIDENCE
                </span>
                <span className="text-xs text-ghost-textMuted">• {argument.updated_ago}</span>
              </div>
              <h3 className="text-base font-medium text-ghost-textPrimary mt-0.5">{argument.claim}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Why it Matters Impact */}
          <div className="p-4 rounded-lg bg-ghost-card/50 border border-ghost-border/60">
            <h4 className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider mb-1">
              Impact on Thesis
            </h4>
            <p className="text-sm text-ghost-textPrimary leading-relaxed">{argument.why_it_matters}</p>
          </div>

          {/* Granular Evidence Items */}
          <div>
            <h4 className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider mb-3">
              Verifiable Market Evidence ({argument.evidence_items.length})
            </h4>

            <div className="space-y-3">
              {argument.evidence_items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-4 rounded-lg bg-ghost-card border border-ghost-border/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-ghost-textPrimary">{item.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                          {item.strength} evidence
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-ghost-textMuted">
                        <Layers className="w-3.5 h-3.5 text-ghost-cyan" />
                        <span>{item.hierarchy}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs px-2.5 py-1 rounded font-medium ${
                          item.direction === 'Supporting'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.direction}
                      </span>
                    </div>
                  </div>

                  {/* Observation text */}
                  <p className="text-sm text-slate-200 bg-black/20 p-2.5 rounded border border-ghost-border/40">
                    {item.observation}
                  </p>

                  {/* Benchmark condition & values */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {item.threshold_or_condition && (
                      <div className="p-2 rounded bg-ghost-bg/60 border border-ghost-border/40">
                        <span className="text-ghost-textMuted block mb-0.5">Evaluated Benchmark:</span>
                        <span className="font-mono text-ghost-cyan font-medium">{item.threshold_or_condition}</span>
                      </div>
                    )}

                    {item.value && (
                      <div className="p-2 rounded bg-ghost-bg/60 border border-ghost-border/40">
                        <span className="text-ghost-textMuted block mb-0.5">Telemetry Values:</span>
                        <span className="font-mono text-ghost-textPrimary font-medium truncate block">
                          {typeof item.value === 'object'
                            ? Object.entries(item.value)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')
                            : String(item.value)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Source & Freshness Metadata */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-ghost-border/40 text-xs text-ghost-textMuted gap-2">
                    <div className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-ghost-cyan" />
                      <span>Source: <strong className="text-slate-200">{item.source}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Observed: {new Date(item.event_time).toLocaleTimeString()} UTC</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-ghost-border bg-ghost-card/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-ghost-card text-ghost-textPrimary hover:bg-ghost-border transition-colors"
          >
            Close Telemetry
          </button>
        </div>
      </div>
    </div>
  );
};
