import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConversationParseResult, StoredConversation, AIFinding } from '../types';

// Mock indexedDb module
vi.mock('./indexedDb', () => ({
  saveConversation: vi.fn().mockResolvedValue(undefined),
}));

import { persistFindings } from './persistence';
import { saveConversation } from './indexedDb';

const mockParseResult: ConversationParseResult = {
  success: true,
  messages: [],
  totalMessages: 5,
  senders: ['Alice', 'Bob'],
  dateRange: { start: '2026-01-01T00:00:00.000Z', end: '2026-01-01T01:00:00.000Z' },
  errors: [],
  warnings: [],
  rawTextLength: 100,
  sourcePlatform: 'whatsapp',
  conversationId: 'test-conv-id',
  importBatchId: 'test-batch-id',
};

const mockFindings: AIFinding[] = [
  {
    id: 'f1',
    conversationId: 'test-conv-id',
    category: 'task_assignment',
    title: 'Test task',
    description: 'Do the thing',
    responsiblePerson: 'Alice',
    isUserResponsible: false,
    deadline: null,
    supportingMessageIds: ['m1'],
    evidenceQuotes: ['Do the thing'],
    confidence: 'high',
    createdAt: new Date().toISOString(),
  },
];

describe('persistFindings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-saves a new conversation when not yet stored', async () => {
    const result = await persistFindings(mockParseResult, mockFindings, []);

    expect(saveConversation).toHaveBeenCalledOnce();
    const saved = (saveConversation as ReturnType<typeof vi.fn>).mock.calls[0][0] as StoredConversation;
    expect(saved.id).toBe('test-conv-id');
    expect(saved.findings).toHaveLength(1);
    expect(saved.findings![0].id).toBe('f1');
    expect(saved.fileHash).toBeUndefined(); // no fileHash on draft auto-save
    expect(result.id).toBe('test-conv-id');
  });

  it('updates existing conversation with new findings', async () => {
    const existing: StoredConversation = {
      id: 'test-conv-id',
      title: 'Existing',
      sourcePlatform: 'whatsapp',
      importedAt: '2026-01-01T00:00:00.000Z',
      messageCount: 5,
      senders: ['Alice', 'Bob'],
      importBatchId: 'test-batch-id',
      messages: [],
      fileHash: 'abc123',
    };

    const result = await persistFindings(mockParseResult, mockFindings, [existing]);

    expect(saveConversation).toHaveBeenCalledOnce();
    const saved = (saveConversation as ReturnType<typeof vi.fn>).mock.calls[0][0] as StoredConversation;
    expect(saved.fileHash).toBe('abc123'); // preserves existing fileHash
    expect(saved.findings).toHaveLength(1);
    expect(saved.lastAnalyzedAt).toBeDefined();
    expect(result.findings).toHaveLength(1);
  });

  it('does not create duplicate records when called twice', async () => {
    // Second call simulates reanalysis; storedConversations now contains the first auto-saved record
    const first = await persistFindings(mockParseResult, mockFindings, []);
    await persistFindings(mockParseResult, mockFindings, [first]);

    // saveConversation called twice, but both calls are PUT (upsert) — no duplicates
    expect(saveConversation).toHaveBeenCalledTimes(2);
    const secondSave = (saveConversation as ReturnType<typeof vi.fn>).mock.calls[1][0] as StoredConversation;
    // Second call should update the existing record (same id, has fileHash undefined from draft)
    expect(secondSave.id).toBe('test-conv-id');
    expect(secondSave.findings).toHaveLength(1);
  });
});
