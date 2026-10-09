import React, { useState } from 'react';
import { 
  FileText, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Users, 
  Clock, 
  Save, 
  Shield, 
  AlertTriangle,
  FolderOpen,
  Sparkles,
  Loader2
} from 'lucide-react';
import type { ConversationParseResult, StoredConversation, AnalysisProgress, AIFinding } from '../types';
import { parseConversationText, computeStringHash } from '../utils/parser';
import { saveConversation, findDuplicateConversation, deleteConversation } from '../utils/indexedDb';
import { runLocalAIAnalysis } from '../utils/localModelService';

interface ImportViewProps {
  parseResult: ConversationParseResult | null;
  onParsed: (result: ConversationParseResult, rawText: string) => void;
  currentUserIdentity: string;
  onChangeUserIdentity: (identity: string) => void;
  storedConversations: StoredConversation[];
  activeConversationId: string | null;
  onSelectConversation: (convo: StoredConversation) => void;
  onRefreshConversations: () => void;
  onFindingsExtracted: (conversationId: string, findings: AIFinding[]) => void;
}

const SAMPLE_LOG = `[2026-10-09 10:15] Sarah: Hey team, we need to finalize the Hackathon deliverable before Friday 5 PM.
[2026-10-09 10:16] Alex: Agreed. I will prepare the Phase 1 UI and local parser foundation today.
[2026-10-09 10:18] David: Note that the API endpoint changed from /v1/summarize to /v2/context-recovery.
[2026-10-09 10:20] Sarah: Alex, make sure to add evidence verification links for each finding.
[2026-10-09 10:22] Alex: Will do. Privacy-first architecture is locked in.`;

const SAMPLE_WHATSAPP_LOG = `12/31/23, 10:00 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
12/31/23, 10:05 - Alice: Team, deadline moved from 14:00 to 18:00 UTC!
12/31/23, 10:06 - Bob: Understood. Here is the updated architectural diagram:
12/31/23, 10:06 - Bob: <Media omitted>
12/31/23, 10:07 - Charlie: Confirming receipt in Tokyo: ありがとう! 🚀
Also please make sure we update the API endpoints.
12/31/23, 10:09 - Alice: @Bob please submit the release ticket before 17:30.
12/31/23, 10:10 - Bob: I will submit the release ticket by 17:00.
12/31/23, 10:12 - David: Blocker alert: The staging database is timing out on /v2/context-recovery.`;

export const ImportView: React.FC<ImportViewProps> = ({
  parseResult,
  onParsed,
  currentUserIdentity,
  onChangeUserIdentity,
  storedConversations,
  activeConversationId,
  onSelectConversation,
  onRefreshConversations,
  onFindingsExtracted,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Analysis state
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleRunParse = () => {
    setDuplicateWarning(null);
    setSaveSuccessMessage(null);
    setAnalysisError(null);
    const result = parseConversationText(inputText);
    onParsed(result, inputText);
  };

  const handleLoadSample = (sample: string) => {
    setDuplicateWarning(null);
    setSaveSuccessMessage(null);
    setAnalysisError(null);
    setInputText(sample);
    const result = parseConversationText(sample);
    onParsed(result, sample);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setDuplicateWarning(null);
    setSaveSuccessMessage(null);
    setAnalysisError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFileError('File exceeds 5MB limit. Please upload conversation excerpts.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
      const result = parseConversationText(content);
      onParsed(result, content);
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please ensure it is a valid UTF-8 text file.');
    };
    reader.readAsText(file);
  };

  const handleConfirmAndSave = async () => {
    if (!parseResult || !parseResult.success) return;

    setIsSaving(true);
    setDuplicateWarning(null);
    setSaveSuccessMessage(null);

    try {
      const fileHash = computeStringHash(inputText.slice(0, 1000) + parseResult.totalMessages);

      const existing = await findDuplicateConversation(fileHash);
      if (existing) {
        setDuplicateWarning(`A conversation with identical content was already imported on ${new Date(existing.importedAt).toLocaleDateString()}. Re-saving will update its record.`);
      }

      const title = `${parseResult.sourcePlatform.toUpperCase()} Chat (${parseResult.totalMessages} msgs) - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const newConvo: StoredConversation = {
        id: parseResult.conversationId,
        title,
        sourcePlatform: parseResult.sourcePlatform,
        importedAt: new Date().toISOString(),
        messageCount: parseResult.totalMessages,
        senders: parseResult.senders,
        dateRange: parseResult.dateRange,
        fileHash,
        importBatchId: parseResult.importBatchId,
        messages: parseResult.messages,
      };

      await saveConversation(newConvo);
      setSaveSuccessMessage(`Successfully saved "${title}" to local IndexedDB.`);
      onRefreshConversations();
      onSelectConversation(newConvo);
    } catch (err) {
      setFileError(`Failed to save locally: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunAIAnalysis = async () => {
    if (!parseResult || !parseResult.success || parseResult.messages.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const userAliases = [currentUserIdentity].filter(Boolean);
      const findings = await runLocalAIAnalysis(
        parseResult.messages,
        parseResult.conversationId,
        userAliases,
        (progress) => setAnalysisProgress(progress)
      );

      // Save findings to active conversation in IndexedDB
      const convoId = parseResult.conversationId;
      onFindingsExtracted(convoId, findings);

      // If stored, update the stored conversation record
      const existing = storedConversations.find((c) => c.id === convoId);
      if (existing) {
        const updated: StoredConversation = {
          ...existing,
          findings,
          lastAnalyzedAt: new Date().toISOString(),
        };
        await saveConversation(updated);
        onRefreshConversations();
      }
    } catch (err) {
      setAnalysisError(`Local AI analysis encountered an error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this stored conversation from local storage?')) {
      await deleteConversation(id);
      onRefreshConversations();
    }
  };

  const isValidInput = inputText.trim().length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <FileText size={20} className="text-indigo-400" />
          <span>Real Chat Ingestion & AI Intelligence</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Import authentic chat transcripts and run on-device local AI inference to extract tasks, decisions, deadlines, and blockers with 100% privacy.
        </p>
      </div>

      {/* Previously Imported Conversations Bar */}
      {storedConversations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <FolderOpen size={15} className="text-indigo-400" />
              Stored Local Conversations ({storedConversations.length})
            </span>
            <span className="text-[11px] text-slate-400">IndexedDB Local Storage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {storedConversations.map((convo) => {
              const isSelected = activeConversationId === convo.id;
              const findingsCount = convo.findings?.length || 0;
              return (
                <div
                  key={convo.id}
                  onClick={() => onSelectConversation(convo)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/70 text-slate-100 ring-1 ring-indigo-500/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate text-[11px] text-slate-200">
                        {convo.title}
                      </span>
                      <button
                        onClick={(e) => handleDeleteConversation(convo.id, e)}
                        title="Delete conversation"
                        className="text-slate-400 hover:text-rose-400 p-0.5 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{convo.messageCount} msgs · {convo.senders.length} senders</span>
                      {findingsCount > 0 && (
                        <span className="text-emerald-400 font-medium">
                          {findingsCount} findings
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="uppercase font-mono">{convo.sourcePlatform}</span>
                    <span>{new Date(convo.importedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid: Config & Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Textarea & File Upload */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Raw Conversation Input
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_WHATSAPP_LOG)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded"
                >
                  Load WhatsApp Sample
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_LOG)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-2 py-1 rounded"
                >
                  Load Bracket Sample
                </button>
                {inputText && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('');
                      setFileError(null);
                      setDuplicateWarning(null);
                      setSaveSuccessMessage(null);
                      setAnalysisProgress(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Paste conversation logs here...\nSupported formats:\n1. WhatsApp text exports: 12/31/23, 10:05 - Alice: Hello\n2. Standard bracket transcripts: [2026-10-09 10:15] Alice: Hello\n3. JSON message arrays: [{"sender": "Alice", "content": "Hi", "timestamp": "..."}]`}
              rows={10}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-y"
            />

            {/* File Dropzone / Upload button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <label className="cursor-pointer flex items-center gap-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-750 px-3 py-2 rounded-lg border border-slate-700 transition-colors">
                <Upload size={14} />
                <span>Upload WhatsApp .txt or JSON export</span>
                <input
                  type="file"
                  accept=".txt,.log,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-slate-400">
                Max size: 5MB (.txt, .log, .json)
              </span>
            </div>

            {fileError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Run Local Ingestion & Parser
              </div>
              <div className="text-[11px] text-slate-400">
                Normalizes messages into the platform-independent Common Data Model.
              </div>
            </div>

            <button
              onClick={handleRunParse}
              disabled={!isValidInput}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                isValidInput
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
                  : 'bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              Parse Messages
            </button>
          </div>
        </div>

        {/* Right Col: Personalization & Local AI Engine */}
        <div className="space-y-4">
          {/* Identity for Personalization */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Users size={15} className="text-indigo-400" />
              <span>Your Identity</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Define your sender handle or name to personalize task ownership and catch-up highlights.
            </p>
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">
                Display / Sender Name
              </label>
              <input
                type="text"
                value={currentUserIdentity}
                onChange={(e) => onChangeUserIdentity(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Genuine Local AI Pipeline Action */}
          <div className="bg-slate-900 border border-indigo-900/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <Sparkles size={15} className="text-indigo-400" />
                <span>Local AI Intelligence Engine</span>
              </div>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                On-Device
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Extracts announcements, tasks, deadlines, decisions, requests, commitments, and blockers using on-device inference with traceable citations.
            </p>

            <button
              onClick={handleRunAIAnalysis}
              disabled={!parseResult || !parseResult.success || isAnalyzing}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 shadow ${
                parseResult && parseResult.success && !isAnalyzing
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-800/80 text-slate-400 cursor-not-allowed border border-slate-700/60'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Analyzing Locally...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Analyze with Local AI</span>
                </>
              )}
            </button>

            {/* Analysis Progress Indicator */}
            {analysisProgress && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">{analysisProgress.message}</span>
                  <span className="font-mono text-indigo-300">{analysisProgress.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${analysisProgress.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {analysisError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded text-rose-300 text-[11px] flex items-center gap-1.5">
                <AlertCircle size={13} className="shrink-0" />
                <span>{analysisError}</span>
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Shield size={14} />
              <span>Zero-Telemetry Guarantee</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every message parsed, stored, and analyzed stays entirely within your device's browser memory and IndexedDB.
            </p>
          </div>
        </div>
      </div>

      {/* Parser Output, Warnings & Confirmation Section */}
      {parseResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              {parseResult.success ? (
                <CheckCircle2 size={18} className="text-emerald-400" />
              ) : (
                <AlertCircle size={18} className="text-rose-400" />
              )}
              <h2 className="text-sm font-semibold text-slate-200">
                {parseResult.success ? 'Parsing Preview & Schema Normalization' : 'Parsing Diagnostics'}
              </h2>
            </div>

            {/* Confirm & Save Button */}
            {parseResult.success && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmAndSave}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow"
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Saving...' : 'Confirm & Store Locally'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Success Notification */}
          {saveSuccessMessage && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Duplicate Notice */}
          {duplicateWarning && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-lg text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {/* Errors or Warnings */}
          {parseResult.errors.length > 0 && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} /> Parsing Issues Detected
              </div>
              {parseResult.errors.map((err, i) => (
                <div key={i} className="pl-5 text-rose-200">{err}</div>
              ))}
            </div>
          )}

          {parseResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} /> Parsing Notices & Ambiguity Reports
              </div>
              {parseResult.warnings.map((warn, i) => (
                <div key={i} className="pl-5 text-amber-200">{warn}</div>
              ))}
            </div>
          )}

          {/* Schema normalized preview */}
          {parseResult.success && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>
                  Normalized Stream ({parseResult.messages.length} messages) · Platform: <strong className="text-slate-200 uppercase">{parseResult.sourcePlatform}</strong>
                </span>
                <span>Senders: {parseResult.senders.join(', ')}</span>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 border border-slate-800 rounded-lg p-3 bg-slate-950/60 divide-y divide-slate-800/50">
                {parseResult.messages.map((msg) => {
                  const isUser = currentUserIdentity && msg.sender.toLowerCase().trim() === currentUserIdentity.toLowerCase().trim();
                  return (
                    <div key={msg.id} className="pt-2 first:pt-0 text-xs">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold flex items-center gap-1.5 ${isUser ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {msg.sender}
                            {isUser && (
                              <span className="text-[9px] px-1 bg-indigo-950 border border-indigo-800 text-indigo-300 rounded">
                                YOU
                              </span>
                            )}
                          </span>
                          {msg.messageType !== 'chat' && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {msg.messageType}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono flex items-center gap-1">
                          <Clock size={10} /> {msg.originalTimestamp}
                          {msg.parsedTimestamp && (
                            <span className="text-[10px] text-emerald-500/80" title={`Parsed ISO: ${msg.parsedTimestamp}`}>
                              ✓
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {msg.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
