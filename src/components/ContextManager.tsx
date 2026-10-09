import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Tag, 
  AlertCircle 
} from 'lucide-react';
import type { ProjectContext } from '../types';

interface ContextManagerProps {
  contexts: ProjectContext[];
  activeContextId: string | null;
  onSelectContext: (id: string | null) => void;
  onSaveContexts: (contexts: ProjectContext[]) => void;
}

export const ContextManager: React.FC<ContextManagerProps> = ({
  contexts,
  activeContextId,
  onSelectContext,
  onSaveContexts,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const startCreate = () => {
    setName('');
    setDescription('');
    setKeywordsInput('');
    setValidationError(null);
    setEditingId(null);
    setIsCreating(true);
  };

  const startEdit = (ctx: ProjectContext) => {
    setIsCreating(false);
    setEditingId(ctx.id);
    setName(ctx.name);
    setDescription(ctx.description);
    setKeywordsInput(ctx.keywords.join(', '));
    setValidationError(null);
  };

  const cancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setValidationError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setValidationError('Context name is required.');
      return;
    }

    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      setValidationError('Please specify at least one keyword for this context.');
      return;
    }

    if (isCreating) {
      const newCtx: ProjectContext = {
        id: `ctx-${Date.now()}`,
        name: cleanName,
        description: description.trim(),
        keywords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [...contexts, newCtx];
      onSaveContexts(updated);
      onSelectContext(newCtx.id);
      setIsCreating(false);
    } else if (editingId) {
      const updated = contexts.map((ctx) => {
        if (ctx.id === editingId) {
          return {
            ...ctx,
            name: cleanName,
            description: description.trim(),
            keywords,
            updatedAt: new Date().toISOString(),
          };
        }
        return ctx;
      });
      onSaveContexts(updated);
      setEditingId(null);
    }
    setValidationError(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this project context?')) {
      const updated = contexts.filter((c) => c.id !== id);
      onSaveContexts(updated);
      if (activeContextId === id) {
        onSelectContext(updated.length > 0 ? updated[0].id : null);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <FolderKanban size={20} className="text-indigo-400" />
            <span>Project & Team Contexts</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure project boundaries and keywords. These rules persist locally and guide future AI context recovery.
          </p>
        </div>

        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors shadow-sm self-start"
          >
            <Plus size={14} />
            <span>New Context</span>
          </button>
        )}
      </div>

      {/* Form (Create / Edit) */}
      {(isCreating || editingId) && (
        <form
          onSubmit={handleSave}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200">
              {isCreating ? 'Create New Project Context' : 'Edit Project Context'}
            </h2>
            <button
              type="button"
              onClick={cancelForm}
              className="text-slate-400 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>

          {validationError && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Context Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Project Atlas or Team X"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Keywords (Comma-separated) *
              </label>
              <input
                type="text"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="submission, deadline, api, deployment"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What scope, milestone, or team duties are tracked here?"
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={cancelForm}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{isCreating ? 'Create Context' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Context List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contexts.map((ctx) => {
          const isActive = activeContextId === ctx.id;
          return (
            <div
              key={ctx.id}
              className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all ${
                isActive
                  ? 'border-indigo-500/70 ring-1 ring-indigo-500/30 shadow-md'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-200">{ctx.name}</h2>
                    {isActive && (
                      <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono px-1.5 py-0.5 rounded">
                        Active Scope
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(ctx)}
                      title="Edit Context"
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(ctx.id)}
                      title="Delete Context"
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                  {ctx.description || 'No description provided.'}
                </p>

                {/* Keywords tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {ctx.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded"
                    >
                      <Tag size={10} className="text-indigo-400" />
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  {ctx.keywords.length} keywords configured
                </span>
                {!isActive ? (
                  <button
                    onClick={() => onSelectContext(ctx.id)}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    Set as Active Scope
                  </button>
                ) : (
                  <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                    <Check size={12} /> Currently Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {contexts.length === 0 && (
        <div className="border border-dashed border-slate-800 bg-slate-900/30 rounded-xl p-8 text-center">
          <p className="text-xs text-slate-400 mb-3">No project contexts defined yet.</p>
          <button
            onClick={startCreate}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg"
          >
            Create Your First Context
          </button>
        </div>
      )}
    </div>
  );
};
