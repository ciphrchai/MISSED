import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  Database, 
  Lock, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import type { UserPreferences } from '../types';
import { clearAllLocalMISSEDData } from '../utils/storage';
import { clearAllConversations } from '../utils/indexedDb';

interface SettingsViewProps {
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onResetAllData: () => void;
  storedConversationsCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onUpdatePreferences,
  onResetAllData,
  storedConversationsCount,
}) => {
  const [clearedMessage, setClearedMessage] = useState<string | null>(null);

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all stored conversations from IndexedDB and reset project contexts?')) {
      await clearAllConversations();
      clearAllLocalMISSEDData();
      onResetAllData();
      setClearedMessage('All local conversations in IndexedDB and stored preferences have been completely purged.');
      setTimeout(() => setClearedMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck size={20} className="text-indigo-400" />
          <span>Settings & Privacy Architecture</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review MISSED local-first guarantees, preference controls, and client-side data management.
        </p>
      </div>

      {clearedMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/60 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{clearedMessage}</span>
        </div>
      )}

      {/* Local-First Architecture Guarantee */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Lock size={16} className="text-emerald-400" />
          <span>Local-First Architecture & Storage Invariants</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800/60 space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Implemented in Phase 1 & 2
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
              <li>100% Client-side React & TypeScript runtime.</li>
              <li>Real WhatsApp (.txt) and transcript parsing in browser memory.</li>
              <li>Conversations persisted locally in browser <strong>IndexedDB</strong>.</li>
              <li>Deduplication & full deletion controls without remote traces.</li>
              <li>Zero telemetry, analytics, or unencrypted external network requests.</li>
            </ul>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800/60 space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Future Phase Roadmap (Planned)
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
              <li>Local WebGPU/ONNX inference engine or Ollama integration.</li>
              <li>Differential contradiction reasoning for decision shifts.</li>
              <li>Telegram (.json) & Microsoft Teams direct ingest adapters.</li>
              <li>Desktop browser extension companion build.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* User Preferences */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Database size={16} className="text-indigo-400" />
          <span>Local Preferences & Storage Metrics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">
              Primary User Identity Handle
            </label>
            <input
              type="text"
              value={preferences.currentUserIdentity}
              onChange={(e) =>
                onUpdatePreferences({ ...preferences, currentUserIdentity: e.target.value })
              }
              placeholder="e.g. Alex"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Used to personalize direct task assignments and catch-up highlights.
            </span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">
              Stored Conversation Records
            </label>
            <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs">
              {storedConversationsCount} conversation(s) in IndexedDB
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Large message histories are saved to IndexedDB to avoid localStorage quota limits.
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone: Data Clearing */}
      <div className="bg-slate-900 border border-rose-950/60 rounded-xl p-5 space-y-3">
        <div className="text-sm font-semibold text-rose-300 flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>Data Storage Controls</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Resetting will purge all conversation records from IndexedDB and reset project contexts and preferences in your browser.
        </p>

        <div className="pt-2">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 size={14} />
            <span>Purge All Ingested Chats & Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
