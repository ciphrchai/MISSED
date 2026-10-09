import { 
  GitCommit, 
  CalendarX, 
  ArrowRight,
  Calendar,
  Sparkles,
  Clock,
  ArrowRightLeft,
  CheckCircle2
} from 'lucide-react';
import type { ProjectContext, ConversationParseResult, AIFinding, EventChange } from '../types';

interface DecisionsViewProps {
  activeContext: ProjectContext | null;
  parseResult: ConversationParseResult | null;
  findings: AIFinding[];
  changes?: EventChange[];
  onNavigateToImport: () => void;
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({
  activeContext,
  parseResult,
  findings,
  changes = [],
  onNavigateToImport,
}) => {
  // Filter for decisions, deadlines, announcements, and blockers
  const timelineFindings = findings.filter(
    (f) => f.category === 'decision' || f.category === 'deadline' || f.category === 'blocker' || f.category === 'announcement'
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <GitCommit size={20} className="text-indigo-400" />
            <span>Decisions, Deadlines & Timeline Reversals</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Detects superseded architecture choices, postponed deadlines, and confirmed decision shifts.
          </p>
        </div>

        <div className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-slate-300">
          Scope: <strong className="text-indigo-400">{activeContext ? activeContext.name : 'All Contexts'}</strong>
        </div>
      </div>

      {/* Detected Changes Banner */}
      {changes.length > 0 && (
        <div className="bg-slate-900 border border-amber-800/60 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <ArrowRightLeft size={16} />
              <span>Confirmed Timeline & Decision Changes ({changes.length})</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Chronological Event Comparison</span>
          </div>

          <div className="space-y-2.5">
            {changes.map((change) => (
              <div 
                key={change.id}
                className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300 capitalize">
                    {change.changeType.replace('_', ' ')}
                  </span>
                  <span className="font-mono flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={12} /> Confirmed Change
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="line-through text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {change.originalState}
                  </span>
                  <ArrowRight size={13} className="text-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                    {change.updatedState}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-1">
                  {change.explanation} ({change.earlierTimestamp} → {change.laterTimestamp})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Findings List */}
      {timelineFindings.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              Timeline & Decision Sequence ({timelineFindings.length})
            </span>
            <span>Verifiable Citations Linked</span>
          </div>

          <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6 py-2">
            {timelineFindings.map((finding) => {
              const isDeadline = finding.category === 'deadline';
              const isBlocker = finding.category === 'blocker';
              const hasChanged = finding.changeHistory && finding.changeHistory.length > 0;

              return (
                <div key={finding.id} className="relative group">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border-2 ${
                    isDeadline 
                      ? 'bg-amber-500 border-slate-900' 
                      : isBlocker 
                      ? 'bg-rose-500 border-slate-900' 
                      : 'bg-indigo-500 border-slate-900'
                  }`} />

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 hover:border-slate-700 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-200 text-sm">
                          {finding.title}
                        </span>
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                          isDeadline
                            ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                            : isBlocker
                            ? 'bg-rose-950/40 text-rose-300 border-rose-800/50'
                            : 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50'
                        }`}>
                          {finding.category}
                        </span>
                        {hasChanged && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 border border-amber-700 text-amber-300 flex items-center gap-1">
                            <ArrowRightLeft size={10} /> Shifted
                          </span>
                        )}
                      </div>

                      {finding.deadline && (
                        <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {finding.deadline}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                      {finding.description}
                    </p>

                    {finding.evidenceQuotes.length > 0 && (
                      <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                        <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
                          <Clock size={11} /> Supporting Citation:
                        </div>
                        {finding.evidenceQuotes.map((quote, qIdx) => (
                          <div key={qIdx} className="italic text-slate-300 font-sans border-l-2 border-amber-500/60 pl-2">
                            "{quote}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
            <span className="font-semibold text-slate-300">Differential Decision Timeline</span>
            <span>Ordering: Chronological Sequence</span>
          </div>

          <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <CalendarX size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              No decisions or deadlines extracted yet
            </h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
              Click <strong>"Analyze with Local AI"</strong> on your imported conversation to extract real decisions, timeline reversals, and deadlines.
            </p>

            {!parseResult || !parseResult.success ? (
              <button
                onClick={onNavigateToImport}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <span>Import Conversation First</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={onNavigateToImport}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                <Sparkles size={13} />
                <span>Go to Import & Run Local AI</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
