import React from 'react';
import { 
  FileUp, 
  ArrowRight, 
  Layers, 
  ShieldCheck, 
  CheckCircle2,
  MessageSquareQuote,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import type { NavigationTab, ProjectContext, ConversationParseResult, StoredConversation, AIFinding } from '../types';

interface DashboardProps {
  onNavigate: (tab: NavigationTab) => void;
  contexts: ProjectContext[];
  activeContext: ProjectContext | null;
  parseResult: ConversationParseResult | null;
  activeConversation: StoredConversation | null;
  storedConversationsCount: number;
  findings: AIFinding[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  contexts: _contexts,
  activeContext,
  parseResult,
  activeConversation,
  storedConversationsCount,
  findings,
}) => {
  const currentMessages = activeConversation?.messages || parseResult?.messages || [];
  const totalMsgs = activeConversation?.messageCount || parseResult?.totalMessages || 0;
  const senders = activeConversation?.senders || parseResult?.senders || [];
  const platform = activeConversation?.sourcePlatform || parseResult?.sourcePlatform || 'generic_text';
  const hasLoadedData = currentMessages.length > 0;

  const actionFindings = findings.filter(
    (f) => f.category === 'task_assignment' || f.category === 'commitment' || f.category === 'request'
  );
  const decisionFindings = findings.filter(
    (f) => f.category === 'decision' || f.category === 'deadline' || f.category === 'blocker' || f.category === 'announcement'
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Banner / Welcome */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
              Personalized Context Recovery
            </span>
            <span className="text-xs text-slate-400">· Phase 3 Local AI Intelligence</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
            Welcome to MISSED
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Extract obligations, shifting decisions, and deadlines using genuine on-device local AI. All processing runs entirely on your device with zero cloud transmissions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('import')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <FileUp size={16} />
            <span>Import & Analyze Chat</span>
          </button>
        </div>
      </div>

      {/* Active Context Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <div className="text-slate-400">Current Scope & Keywords</div>
            <div className="text-slate-200 font-medium">
              {activeContext ? activeContext.name : 'All Project Contexts (Default Scope)'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeContext ? (
            activeContext.keywords.slice(0, 4).map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px] border border-slate-700/60">
                #{kw}
              </span>
            ))
          ) : (
            <span className="text-slate-400 italic">No keyword filters applied</span>
          )}
          <button
            onClick={() => onNavigate('contexts')}
            className="text-indigo-400 hover:text-indigo-300 ml-2 font-medium flex items-center gap-1"
          >
            Manage Contexts <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Ingested Conversation Status */}
      {hasLoadedData ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                {activeConversation ? activeConversation.title : 'Active Normalized Conversation Session'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                {platform}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {totalMsgs} messages
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block mb-1">Participants Detected</span>
              <span className="text-slate-200 font-medium text-sm">
                {senders.length} senders
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {senders.join(', ')}
              </p>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block mb-1">AI Extracted Findings</span>
              <span className="text-slate-200 font-medium text-sm flex items-center gap-1.5">
                <Sparkles size={13} className="text-indigo-400" />
                {findings.length} Evidence-Backed Findings
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {actionFindings.length} actions · {decisionFindings.length} decisions/deadlines
              </p>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60 flex flex-col justify-between">
              <span className="text-slate-400 block mb-1">Storage & Evidence</span>
              <button
                onClick={() => onNavigate('evidence')}
                className="text-indigo-400 hover:text-indigo-300 font-medium text-xs flex items-center gap-1 text-left"
              >
                <span>Inspect Citations in Evidence Viewer</span>
                <ExternalLink size={12} />
              </button>
              <p className="text-[11px] text-slate-400 mt-1">
                {storedConversationsCount} conversation(s) safe in IndexedDB.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-800 bg-slate-900/30 rounded-xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
            <MessageSquareQuote size={24} />
          </div>
          <h3 className="text-base font-medium text-slate-200 mb-1">
            No active conversation loaded
          </h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
            Import real WhatsApp chat exports (.txt) or standard logs to extract tasks, deadlines, and decisions using client-side AI.
          </p>
          <button
            onClick={() => onNavigate('import')}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-medium transition-colors border border-slate-700"
          >
            <FileUp size={14} />
            <span>Open Conversation Importer</span>
          </button>
        </div>
      )}

      {/* Catch-up Insights Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: My Obligations & Action Items */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Personal Obligations & Actions
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {actionFindings.length} extracted
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Direct requests, commitments, and assigned deliverables extracted by local AI.
            </p>

            {actionFindings.length > 0 ? (
              <div className="space-y-2">
                {actionFindings.slice(0, 3).map((f) => (
                  <div key={f.id} className="p-2.5 bg-slate-950/80 rounded border border-slate-800/60 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200 truncate">{f.title}</span>
                      {f.isUserResponsible && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] truncate">{f.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
                <p className="text-xs text-slate-400">
                  {hasLoadedData 
                    ? 'No action items extracted yet. Run "Analyze with Local AI" on the Import tab.' 
                    : 'Import a conversation to run local AI action item extraction.'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
            <button
              onClick={() => onNavigate('actions')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              Inspect Actions ({actionFindings.length}) <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Section 2: Changing Decisions & Timelines */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Decisions & Timelines
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {decisionFindings.length} alerts
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Agreed architecture decisions, concrete deadlines, and reported blockers.
            </p>

            {decisionFindings.length > 0 ? (
              <div className="space-y-2">
                {decisionFindings.slice(0, 3).map((f) => (
                  <div key={f.id} className="p-2.5 bg-slate-950/80 rounded border border-slate-800/60 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200 truncate">{f.title}</span>
                      <span className="text-[9px] uppercase px-1 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                        {f.category}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] truncate">{f.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
                <p className="text-xs text-slate-400">
                  {hasLoadedData 
                    ? 'No decisions extracted yet. Run "Analyze with Local AI" on the Import tab.' 
                    : 'Import a conversation to surface decisions and deadlines.'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
            <button
              onClick={() => onNavigate('decisions')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              Inspect Timeline Layout ({decisionFindings.length}) <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Product Architecture & Guidelines Adherence */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <ShieldCheck size={14} className="text-indigo-400" />
          Hackathon Compliance & Privacy Guarantees
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-300 font-medium block mb-1">Zero Cloud Transmission</span>
            All AI inference executes locally on-device. Zero tokens or chat lines transmitted externally.
          </div>
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-300 font-medium block mb-1">Bounded Context Processing</span>
            Conversations are chunked into bounded token windows to prevent browser memory exhaustion.
          </div>
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-300 font-medium block mb-1">Traceable Evidence Citations</span>
            Every extracted finding retains original quoted text and verifiable supporting message IDs.
          </div>
        </div>
      </div>
    </div>
  );
};
