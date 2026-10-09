import { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  NavigationTab, 
  ProjectContext, 
  UserPreferences, 
  ConversationParseResult, 
  StoredConversation, 
  AIFinding 
} from './types';
import { 
  loadProjectContexts, 
  saveProjectContexts, 
  loadUserPreferences, 
  saveUserPreferences, 
  DEFAULT_PROJECT_CONTEXTS, 
  DEFAULT_PREFERENCES 
} from './utils/storage';
import { getAllConversations } from './utils/indexedDb';
import { 
  reconcileContextRecovery, 
  filterFindingsByProjectContext 
} from './utils/contextRecoveryEngine';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ImportView } from './components/ImportView';
import { ActionsView } from './components/ActionsView';
import { DecisionsView } from './components/DecisionsView';
import { ContextManager } from './components/ContextManager';
import { EvidenceViewer } from './components/EvidenceViewer';
import { SettingsView } from './components/SettingsView';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [contexts, setContexts] = useState<ProjectContext[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [parseResult, setParseResult] = useState<ConversationParseResult | null>(null);
  const [storedConversations, setStoredConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Active findings state (per-conversation findings map)
  const [sessionFindings, setSessionFindings] = useState<Record<string, AIFinding[]>>({});

  // Load conversations from IndexedDB
  const refreshStoredConversations = useCallback(async () => {
    const list = await getAllConversations();
    setStoredConversations(list);
    if (list.length > 0 && !activeConversationId) {
      setActiveConversationId(list[0].id);
    }
  }, [activeConversationId]);

  // Initial load
  useEffect(() => {
    const loadedContexts = loadProjectContexts();
    const loadedPrefs = loadUserPreferences();
    setContexts(loadedContexts);
    setPreferences(loadedPrefs);
    refreshStoredConversations();
  }, [refreshStoredConversations]);

  // Save contexts
  const handleSaveContexts = (newContexts: ProjectContext[]) => {
    setContexts(newContexts);
    saveProjectContexts(newContexts);
  };

  // Update preferences
  const handleUpdatePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    saveUserPreferences(newPrefs);
  };

  // Change active context
  const handleSelectContext = (contextId: string | null) => {
    const updatedPrefs = { ...preferences, activeContextId: contextId };
    setPreferences(updatedPrefs);
    saveUserPreferences(updatedPrefs);
  };

  // Select an active stored conversation
  const handleSelectConversation = (convo: StoredConversation) => {
    setActiveConversationId(convo.id);
  };

  // Handler for findings extracted by AI engine
  const handleFindingsExtracted = (conversationId: string, findings: AIFinding[]) => {
    setSessionFindings((prev) => ({
      ...prev,
      [conversationId]: findings,
    }));
  };

  // Reset all
  const handleResetAllData = () => {
    setContexts(DEFAULT_PROJECT_CONTEXTS);
    setPreferences(DEFAULT_PREFERENCES);
    setParseResult(null);
    setStoredConversations([]);
    setActiveConversationId(null);
    setSessionFindings({});
  };

  // On conversation parse
  const handleParsed = (result: ConversationParseResult, _rawText: string) => {
    setParseResult(result);
  };

  const activeContext = contexts.find((c) => c.id === preferences.activeContextId) || null;
  const activeConversation = storedConversations.find((c) => c.id === activeConversationId) || (storedConversations.length > 0 ? storedConversations[0] : null);

  const currentMessages = activeConversation?.messages || parseResult?.messages || [];
  const currentConvoId = activeConversation?.id || parseResult?.conversationId || '';
  const rawFindings = sessionFindings[currentConvoId] || activeConversation?.findings || [];

  // Run Phase 4 Context Recovery: task state tracking, event comparison & deterministic prioritization
  const { reconciledFindings, detectedChanges } = useMemo(() => {
    if (rawFindings.length === 0 || currentMessages.length === 0) {
      return { reconciledFindings: rawFindings, detectedChanges: [] };
    }
    const { findings: reconciled, changes } = reconcileContextRecovery(rawFindings, currentMessages);
    return { reconciledFindings: reconciled, detectedChanges: changes };
  }, [rawFindings, currentMessages]);

  // Apply active project context keyword filtering
  const contextualFindings = useMemo(() => {
    return filterFindingsByProjectContext(reconciledFindings, activeContext);
  }, [reconciledFindings, activeContext]);

  return (
    <div className="flex h-screen w-screen bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        contexts={contexts}
        activeContextId={preferences.activeContextId}
        onSelectContext={handleSelectContext}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0b0f19]">
        {currentTab === 'dashboard' && (
          <Dashboard
            onNavigate={setCurrentTab}
            contexts={contexts}
            activeContext={activeContext}
            parseResult={parseResult}
            activeConversation={activeConversation}
            storedConversationsCount={storedConversations.length}
            findings={contextualFindings}
          />
        )}

        {currentTab === 'import' && (
          <ImportView
            parseResult={parseResult}
            onParsed={handleParsed}
            currentUserIdentity={preferences.currentUserIdentity}
            onChangeUserIdentity={(identity) =>
              handleUpdatePreferences({ ...preferences, currentUserIdentity: identity })
            }
            storedConversations={storedConversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onRefreshConversations={refreshStoredConversations}
            onFindingsExtracted={handleFindingsExtracted}
          />
        )}

        {currentTab === 'actions' && (
          <ActionsView
            activeContext={activeContext}
            parseResult={parseResult}
            currentUserIdentity={preferences.currentUserIdentity}
            findings={contextualFindings}
            onNavigateToImport={() => setCurrentTab('import')}
          />
        )}

        {currentTab === 'decisions' && (
          <DecisionsView
            activeContext={activeContext}
            parseResult={parseResult}
            findings={contextualFindings}
            changes={detectedChanges}
            onNavigateToImport={() => setCurrentTab('import')}
          />
        )}

        {currentTab === 'contexts' && (
          <ContextManager
            contexts={contexts}
            activeContextId={preferences.activeContextId}
            onSelectContext={handleSelectContext}
            onSaveContexts={handleSaveContexts}
          />
        )}

        {currentTab === 'evidence' && (
          <EvidenceViewer
            parseResult={parseResult}
            activeContext={activeContext}
            activeConversation={activeConversation}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onResetAllData={handleResetAllData}
            storedConversationsCount={storedConversations.length}
          />
        )}
      </main>
    </div>
  );
}

export default App;
