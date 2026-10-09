import React, { useState } from 'react';
import { 
  FileSearch, 
  Search, 
  MessageSquare, 
  Clock
} from 'lucide-react';
import type { ProjectContext, ConversationParseResult, ChatMessage, StoredConversation } from '../types';

interface EvidenceViewerProps {
  parseResult: ConversationParseResult | null;
  activeContext: ProjectContext | null;
  activeConversation: StoredConversation | null;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  parseResult,
  activeContext,
  activeConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSender, setSelectedSender] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const messages: ChatMessage[] = activeConversation?.messages || parseResult?.messages || [];
  const sendersList = activeConversation?.senders || parseResult?.senders || [];

  // Filter messages by active context keywords if applicable and search query
  const filteredMessages = messages.filter((msg) => {
    // 1. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = msg.content.toLowerCase().includes(q) || msg.sender.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    // 2. Sender filter
    if (selectedSender !== 'all' && msg.sender !== selectedSender) {
      return false;
    }

    // 3. Message type filter
    if (selectedType !== 'all' && msg.messageType !== selectedType) {
      return false;
    }

    return true;
  });

  // Calculate matching keyword counts
  const getMatchedKeywords = (content: string): string[] => {
    if (!activeContext || activeContext.keywords.length === 0) return [];
    const lower = content.toLowerCase();
    return activeContext.keywords.filter((kw) => lower.includes(kw.toLowerCase()));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <FileSearch size={20} className="text-indigo-400" />
            <span>Verifiable Evidence Viewer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every finding links back to verbatim original messages with timestamp, sender, and line indices.
          </p>
        </div>

        {messages.length > 0 && (
          <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
            {filteredMessages.length} / {messages.length} messages in scope
          </div>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <MessageSquare size={22} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">
            No conversation transcript loaded
          </h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            Please import a conversation from the Import Chat tab to view raw message logs, line citations, and keyword evidence trails.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          {/* Active conversation info */}
          {activeConversation && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">{activeConversation.title}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-800">
                  {activeConversation.sourcePlatform}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Batch: {activeConversation.importBatchId}
              </span>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search verbatim text..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Sender dropdown */}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400">Sender:</label>
                <select
                  aria-label="Filter Sender"
                  value={selectedSender}
                  onChange={(e) => setSelectedSender(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All ({sendersList.length})</option>
                  {sendersList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message Type filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400">Type:</label>
                <select
                  aria-label="Filter Message Type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="chat">Standard Chat</option>
                  <option value="system">System / Admin</option>
                  <option value="media">Media Placeholder</option>
                </select>
              </div>
            </div>
          </div>

          {/* Messages Table / List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredMessages.map((msg) => {
              const matchedKw = getMatchedKeywords(msg.content);
              return (
                <div
                  key={msg.id}
                  className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{msg.sender}</span>
                      <span className="text-[10px] text-slate-400 font-mono px-1 rounded bg-slate-900 border border-slate-800">
                        {msg.rawLineIndex ? `Line ${msg.rawLineIndex}` : msg.id}
                      </span>
                      {msg.messageType !== 'chat' && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {msg.messageType}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                      <Clock size={11} />
                      <span>{msg.originalTimestamp}</span>
                      {msg.parsedTimestamp && (
                        <span className="text-[10px] text-emerald-500/80" title={`Parsed ISO: ${msg.parsedTimestamp}`}>
                          [ISO]
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {msg.content}
                  </p>

                  {matchedKw.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-900 flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Context keyword hits:</span>
                      {matchedKw.map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.2 rounded font-mono"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredMessages.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                No original messages match the selected filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
