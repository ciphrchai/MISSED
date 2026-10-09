import { describe, it, expect } from 'vitest';
import { 
  calculateFindingPriority, 
  trackTaskStatus, 
  detectEventChanges, 
  filterFindingsByProjectContext, 
  reconcileContextRecovery 
} from './contextRecoveryEngine';
import type { NormalizedMessage, AIFinding, ProjectContext } from '../types';

describe('Phase 4: Context Recovery & Prioritization Engine', () => {
  const mockMessages: NormalizedMessage[] = [
    {
      id: 'msg-1',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Alice',
      originalTimestamp: '10:00 AM',
      parsedTimestamp: null,
      content: 'Initial decision: We will use PostgreSQL for data storage.',
      messageType: 'chat',
      rawLineIndex: 1,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-2',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Alice',
      originalTimestamp: '10:05 AM',
      parsedTimestamp: null,
      content: '@Bob please implement the authentication endpoint before 17:00 Friday.',
      messageType: 'chat',
      rawLineIndex: 2,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-3',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Alice',
      originalTimestamp: '10:10 AM',
      parsedTimestamp: null,
      content: 'Deadline update: Deadline changed from 17:00 Friday to 19:00 Friday.',
      messageType: 'chat',
      rawLineIndex: 3,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-4',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Charlie',
      originalTimestamp: '10:15 AM',
      parsedTimestamp: null,
      content: 'Architecture shift: We switched from PostgreSQL to IndexedDB instead of SQL.',
      messageType: 'chat',
      rawLineIndex: 4,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-5',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Bob',
      originalTimestamp: '10:20 AM',
      parsedTimestamp: null,
      content: 'Authentication endpoint completed and merged into main.',
      messageType: 'chat',
      rawLineIndex: 5,
      importBatchId: 'b-1',
    },
  ];

  const mockFindings: AIFinding[] = [
    {
      id: 'f-1',
      conversationId: 'convo-1',
      category: 'decision',
      title: 'PostgreSQL for data storage',
      description: 'Initial decision: We will use PostgreSQL for data storage.',
      responsiblePerson: null,
      isUserResponsible: false,
      deadline: null,
      supportingMessageIds: ['msg-1'],
      evidenceQuotes: ['We will use PostgreSQL for data storage.'],
      confidence: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'f-2',
      conversationId: 'convo-1',
      category: 'task_assignment',
      title: 'Implement authentication endpoint',
      description: '@Bob please implement the authentication endpoint before 17:00 Friday.',
      responsiblePerson: 'Bob',
      isUserResponsible: true, // Bob is the current user
      deadline: '17:00 Friday',
      supportingMessageIds: ['msg-2'],
      evidenceQuotes: ['@Bob please implement the authentication endpoint before 17:00 Friday.'],
      confidence: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'f-3',
      conversationId: 'convo-1',
      category: 'deadline',
      title: 'Initial deadline 17:00',
      description: 'Deadline 17:00 Friday',
      responsiblePerson: null,
      isUserResponsible: false,
      deadline: '17:00 Friday',
      supportingMessageIds: ['msg-2'],
      evidenceQuotes: ['before 17:00 Friday.'],
      confidence: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'f-4',
      conversationId: 'convo-1',
      category: 'deadline',
      title: 'Extended deadline 19:00',
      description: 'Deadline changed from 17:00 Friday to 19:00 Friday.',
      responsiblePerson: null,
      isUserResponsible: false,
      deadline: '19:00 Friday',
      supportingMessageIds: ['msg-3'],
      evidenceQuotes: ['Deadline changed from 17:00 Friday to 19:00 Friday.'],
      confidence: 'high',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'f-5',
      conversationId: 'convo-1',
      category: 'decision',
      title: 'Switched from PostgreSQL to IndexedDB',
      description: 'We switched from PostgreSQL to IndexedDB instead of SQL.',
      responsiblePerson: null,
      isUserResponsible: false,
      deadline: null,
      supportingMessageIds: ['msg-4'],
      evidenceQuotes: ['We switched from PostgreSQL to IndexedDB instead of SQL.'],
      confidence: 'high',
      createdAt: new Date().toISOString(),
    },
  ];

  describe('Deterministic Prioritization Engine', () => {
    it('ranks user-assigned tasks with deadlines as urgent or high', () => {
      const { priority, reasons } = calculateFindingPriority(mockFindings[1], false);
      expect(['urgent', 'high']).toContain(priority);
      expect(reasons).toContain('Assigned to you');
      expect(reasons.some((r) => r.includes('deadline'))).toBe(true);
    });

    it('assigns lower priority to general announcements without deadlines', () => {
      const generalFinding: AIFinding = {
        ...mockFindings[0],
        category: 'announcement',
        isUserResponsible: false,
        deadline: null,
      };
      const { priority } = calculateFindingPriority(generalFinding, false);
      expect(['medium', 'low']).toContain(priority);
    });
  });

  describe('Task State Tracking', () => {
    it('transitions task to completed when owner reports completion in later message', () => {
      const { status, statusEvidence } = trackTaskStatus(mockFindings[1], mockMessages);
      expect(status).toBe('completed');
      expect(statusEvidence).toContain('completed');
    });

    it('retains pending state when no completion report is found', () => {
      const uncompletedTask: AIFinding = {
        ...mockFindings[1],
        id: 'f-uncompleted',
        supportingMessageIds: ['msg-5'], // appears at the end
      };
      const { status } = trackTaskStatus(uncompletedTask, mockMessages);
      expect(status).toBe('pending');
    });
  });

  describe('Event Change & Contradiction Detection', () => {
    it('detects deadline changes between chronological findings', () => {
      const changes = detectEventChanges(mockFindings, mockMessages);
      const deadlineChange = changes.find((c) => c.changeType === 'deadline_change');
      expect(deadlineChange).toBeDefined();
      expect(deadlineChange?.originalState).toBe('17:00 Friday');
      expect(deadlineChange?.updatedState).toBe('19:00 Friday');
      expect(deadlineChange?.isConfirmed).toBe(true);
    });

    it('detects decision reversals and superseded agreements', () => {
      const changes = detectEventChanges(mockFindings, mockMessages);
      const decisionChange = changes.find((c) => c.changeType === 'decision_reversal');
      expect(decisionChange).toBeDefined();
      expect(decisionChange?.originalState).toContain('PostgreSQL');
      expect(decisionChange?.updatedState).toContain('IndexedDB');
    });
  });

  describe('Project Context Keyword Filtering', () => {
    it('filters findings matching project context keywords', () => {
      const context: ProjectContext = {
        id: 'ctx-1',
        name: 'Database Migration',
        description: 'Tracking DB changes',
        keywords: ['indexeddb', 'postgresql'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const matched = filterFindingsByProjectContext(mockFindings, context);
      expect(matched.length).toBe(2);
      expect(matched.every((f) => f.matchedKeywords && f.matchedKeywords.length > 0)).toBe(true);
    });

    it('returns all findings when context is unfiltered or has no keywords', () => {
      const all = filterFindingsByProjectContext(mockFindings, null);
      expect(all.length).toBe(mockFindings.length);
    });
  });

  describe('Complete Context Recovery Orchestration', () => {
    it('runs reconciliation yielding priority, task status, and change records', () => {
      const { findings, changes } = reconcileContextRecovery(mockFindings, mockMessages);
      expect(findings.length).toBe(mockFindings.length);
      expect(changes.length).toBeGreaterThan(0);

      const authTask = findings.find((f) => f.id === 'f-2');
      expect(authTask?.status).toBe('completed');
      expect(authTask?.priority).toBeDefined();
      expect(authTask?.priorityReasons?.length).toBeGreaterThan(0);
    });
  });
});
