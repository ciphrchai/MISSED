import type { ProjectContext, UserPreferences } from '../types';

const STORAGE_KEYS = {
  PROJECT_CONTEXTS: 'missed_project_contexts_v1',
  USER_PREFERENCES: 'missed_user_preferences_v1',
  CACHED_CONVERSATION: 'missed_cached_conversation_raw_v1',
};

export const DEFAULT_PROJECT_CONTEXTS: ProjectContext[] = [
  {
    id: 'ctx-1',
    name: 'Hackathon Submission',
    description: 'Track final deliverable requirements, timeline constraints, and scoring rules',
    keywords: ['submission', 'deadline', 'demo', 'evaluation', 'presentation'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctx-2',
    name: 'API & Backend Integration',
    description: 'Monitors breaking schema updates, authentication changes, and endpoints',
    keywords: ['api', 'endpoint', 'token', 'auth', 'database', 'schema'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctx-3',
    name: 'Project Atlas',
    description: 'Sprint coordination, blocker alerts, and assigned PR reviews',
    keywords: ['atlas', 'blocker', 'review', 'merge', 'qa', 'release'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  activeContextId: 'ctx-1',
  currentUserIdentity: 'Alex',
  theme: 'dark',
  localDataRetentionDays: 30,
};

export function loadProjectContexts(): ProjectContext[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECT_CONTEXTS);
    if (!raw) {
      saveProjectContexts(DEFAULT_PROJECT_CONTEXTS);
      return DEFAULT_PROJECT_CONTEXTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROJECT_CONTEXTS;
  } catch (err) {
    console.error('Failed to load project contexts from localStorage:', err);
    return DEFAULT_PROJECT_CONTEXTS;
  }
}

export function saveProjectContexts(contexts: ProjectContext[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROJECT_CONTEXTS, JSON.stringify(contexts));
  } catch (err) {
    console.error('Failed to save project contexts to localStorage:', err);
  }
}

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (!raw) {
      saveUserPreferences(DEFAULT_PREFERENCES);
      return DEFAULT_PREFERENCES;
    }
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to load preferences from localStorage:', err);
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
  } catch (err) {
    console.error('Failed to save preferences to localStorage:', err);
  }
}

export function clearAllLocalMISSEDData(): void {
  localStorage.removeItem(STORAGE_KEYS.PROJECT_CONTEXTS);
  localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
  localStorage.removeItem(STORAGE_KEYS.CACHED_CONVERSATION);
}
