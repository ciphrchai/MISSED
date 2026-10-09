import { 
  CheckSquare, 
  User, 
  Calendar, 
  ArrowRight, 
  Filter, 
  Clock, 
  Sparkles,
  Tag
} from 'lucide-react';
import type { ProjectContext, ConversationParseResult, AIFinding } from '../types';

interface ActionsViewProps {
  activeContext: ProjectContext | null;
  parseResult: ConversationParseResult | null;
  currentUserIdentity: string;
  findings: AIFinding[];
  onNavigateToImport: () => void;
}

export const ActionsView: React.FC<ActionsViewProps> = ({
  activeContext,
  parseResult,
  currentUserIdentity,
  findings,
  onNavigateToImport,
}) => {
  // Filter for tasks, assignments, commitments, and requests
  const actionFindings = findings.filter(
    (f) => f.category === 'task_assignment' || f.category === 'commitment' || f.category === 'request'
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <CheckSquare size={20} className="text-indigo-400" />
            <span>My Actions & Obligations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tracks tasks, assignments, deadlines, owners, priorities, and verified completion states extracted from conversations.
          </p>
        </div>

        {/* Identity & Scope pill */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <User size={12} className="text-indigo-400" />
            Target: <strong>{currentUserIdentity || 'Unset'}</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <Filter size={12} className="text-slate-400" />
            Scope: {activeContext ? activeContext.name : 'All'}
          </span>
        </div>
      </div>

      {actionFindings.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-400" />
              Extracted Action Items ({actionFindings.length})
            </span>
            <span>Deterministic Priority & Evidence Linked</span>
          </div>

          <div className="space-y-3">
            {actionFindings.map((finding) => {
              const priority = finding.priority || 'medium';
              const status = finding.status || 'pending';

              const priorityBadge = {
                urgent: 'bg-rose-950/50 text-rose-300 border-rose-800/60',
                high: 'bg-amber-950/50 text-amber-300 border-amber-800/60',
                medium: 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60',
                low: 'bg-slate-800 text-slate-300 border-slate-700',
              }[priority];

              const statusBadge = {
                completed: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
                in_progress: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60',
                blocked: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
                pending: 'bg-slate-800 text-slate-400 border-slate-700',
                cancelled: 'bg-slate-900 text-slate-400 border-slate-800 line-through',
                superseded: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
                uncertain: 'bg-slate-800 text-slate-400 border-slate-700',
              }[status];

              return (
                <div 
                  key={finding.id}
                  className={`p-4 rounded-lg border transition-all ${
                    finding.isUserResponsible
                      ? 'bg-indigo-950/20 border-indigo-500/50 ring-1 ring-indigo-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-200 text-sm">
                        {finding.title}
                      </span>
                      {finding.isUserResponsible && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/60 text-indigo-300">
                          Assigned to You
                        </span>
                      )}
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${priorityBadge}`}>
                        {priority}
                      </span>
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${statusBadge}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {finding.responsiblePerson && (
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-indigo-400" />
                          {finding.responsiblePerson}
                        </span>
                      )}
                      {finding.deadline && (
                        <span className="flex items-center gap-1 text-amber-400 font-mono">
                          <Calendar size={12} />
                          {finding.deadline}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {finding.description}
                  </p>

                  {/* Priority Reasons */}
                  {finding.priorityReasons && finding.priorityReasons.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Tag size={10} /> Priority signals:
                      </span>
                      {finding.priorityReasons.map((r, rIdx) => (
                        <span key={rIdx} className="text-[10px] text-slate-300 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Supporting Evidence Quote */}
                  {finding.evidenceQuotes.length > 0 && (
                    <div className="p-2.5 bg-slate-950/80 rounded border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
                        <Clock size={11} /> Supporting Message Quote:
                      </div>
                      {finding.evidenceQuotes.map((quote, qIdx) => (
                        <div key={qIdx} className="italic text-slate-300 font-sans border-l-2 border-indigo-500/60 pl-2">
                          "{quote}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
            <span className="font-semibold text-slate-300">Action Grid Layout</span>
            <span>Columns: Task · Owner · Deadline · Priority · Status · Evidence</span>
          </div>

          <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <CheckSquare size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              No actions extracted yet
            </h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
              Click <strong>"Analyze with Local AI"</strong> on your imported conversation to extract real obligations with verifiable citations and dynamic task states.
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
