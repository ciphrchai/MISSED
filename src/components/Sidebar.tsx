import React from 'react';
import { 
  LayoutDashboard, 
  FileUp, 
  CheckSquare, 
  GitCommit, 
  FolderKanban, 
  FileSearch, 
  Settings, 
  ShieldCheck, 
  Layers 
} from 'lucide-react';
import type { NavigationTab, ProjectContext } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  contexts: ProjectContext[];
  activeContextId: string | null;
  onSelectContext: (id: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  contexts,
  activeContextId,
  onSelectContext,
}) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'import', label: 'Import Chat', icon: <FileUp size={18} /> },
    { id: 'actions', label: 'My Actions', icon: <CheckSquare size={18} /> },
    { id: 'decisions', label: 'Decision Changes', icon: <GitCommit size={18} /> },
    { id: 'contexts', label: 'Project Contexts', icon: <FolderKanban size={18} /> },
    { id: 'evidence', label: 'Evidence Viewer', icon: <FileSearch size={18} /> },
    { id: 'settings', label: 'Settings & Privacy', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0">
      {/* Brand Wordmark */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-white/10">
            M
          </div>
          <div>
            <div className="font-semibold tracking-wider text-base text-slate-100 flex items-center gap-1.5">
              <span>MISSED</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700/60 font-medium">
                P1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">Context Recovery</p>
          </div>
        </div>
      </div>

      {/* Active Project Context Selector */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
          <Layers size={13} className="text-slate-400" />
          <span>Active Context</span>
        </label>
        <select
          aria-label="Active Project Context"
          value={activeContextId || ''}
          onChange={(e) => onSelectContext(e.target.value || null)}
          className="w-full bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-md px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
        >
          <option value="">All Contexts (Unfiltered)</option>
          {contexts.map((ctx) => (
            <option key={ctx.id} value={ctx.id}>
              {ctx.name}
            </option>
          ))}
        </select>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 px-3 py-1">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className={isActive ? 'text-indigo-400' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Local-first architecture tag */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span className="font-medium text-slate-300">Phase 1 Foundation</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Local client-only execution. No remote API transmissions in Phase 1.
        </p>
      </div>
    </aside>
  );
};
