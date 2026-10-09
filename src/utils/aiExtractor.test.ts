import { describe, it, expect } from 'vitest';
import { 
  chunkMessages, 
  formatChunkPrompt, 
  validateAndNormalizeFindings, 
  deduplicateFindings, 
  extractFindingsHeuristically 
} from './aiExtractor';
import type { NormalizedMessage } from '../types';

describe('Local AI Extractor Engine', () => {
  const sampleMessages: NormalizedMessage[] = [
    {
      id: 'msg-1',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Alice',
      originalTimestamp: '10:00 AM',
      parsedTimestamp: null,
      content: 'Important announcement: The submission portal opens at 14:00 UTC.',
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
      content: '@Bob please submit the API documentation before 17:00 Friday.',
      messageType: 'chat',
      rawLineIndex: 2,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-3',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Bob',
      originalTimestamp: '10:06 AM',
      parsedTimestamp: null,
      content: 'I will submit the API documentation by 16:30.',
      messageType: 'chat',
      rawLineIndex: 3,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-4',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'Charlie',
      originalTimestamp: '10:08 AM',
      parsedTimestamp: null,
      content: 'We agreed to use client-side IndexedDB for all local storage.',
      messageType: 'chat',
      rawLineIndex: 4,
      importBatchId: 'b-1',
    },
    {
      id: 'msg-5',
      conversationId: 'convo-1',
      sourcePlatform: 'whatsapp',
      sender: 'David',
      originalTimestamp: '10:10 AM',
      parsedTimestamp: null,
      content: 'Blocker alert: The WebGPU driver is crashing on older devices.',
      messageType: 'chat',
      rawLineIndex: 5,
      importBatchId: 'b-1',
    },
  ];

  describe('Chunking and Prompt Generation', () => {
    it('correctly chunks messages into bounded groups', () => {
      const chunks = chunkMessages(sampleMessages);
      expect(chunks.length).toBe(1);
      expect(chunks[0].length).toBe(5);
    });

    it('formats chunks preserving message IDs, senders, and timestamps', () => {
      const promptText = formatChunkPrompt(sampleMessages);
      expect(promptText).toContain('[ID: msg-1]');
      expect(promptText).toContain('Alice:');
      expect(promptText).toContain('Important announcement');
    });
  });

  describe('Structured JSON Validation & Normalization', () => {
    it('validates raw JSON into typed AIFinding models', () => {
      const rawOutput = [
        {
          category: 'task_assignment',
          title: 'Submit API documentation',
          description: 'Submit API documentation before 17:00 Friday',
          responsiblePerson: 'Bob',
          deadline: '17:00 Friday',
          supportingMessageIds: ['msg-2'],
          evidenceQuote: '@Bob please submit the API documentation before 17:00 Friday.',
          confidence: 'high',
        },
      ];

      const validIds = new Set(['msg-2']);
      const findings = validateAndNormalizeFindings(rawOutput, 'convo-1', ['Bob'], validIds);

      expect(findings.length).toBe(1);
      expect(findings[0].category).toBe('task_assignment');
      expect(findings[0].responsiblePerson).toBe('Bob');
      expect(findings[0].isUserResponsible).toBe(true);
      expect(findings[0].deadline).toBe('17:00 Friday');
      expect(findings[0].supportingMessageIds).toEqual(['msg-2']);
    });

    it('handles malformed, incomplete, or unsupported fields safely', () => {
      const malformed = [
        null,
        'not an object',
        { invalid: true }, // missing description
        {
          category: 'unknown_cat',
          title: 'Fallback',
          description: 'Valid description here',
          responsiblePerson: 'null',
          deadline: null,
          supportingMessageIds: ['non-existent-id'],
        },
      ];

      const validIds = new Set(['msg-1']);
      const findings = validateAndNormalizeFindings(malformed, 'convo-1', ['Alice'], validIds);

      expect(findings.length).toBe(1);
      expect(findings[0].category).toBe('announcement'); // normalized to default category
      expect(findings[0].responsiblePerson).toBeNull(); // 'null' string handled safely
      expect(findings[0].supportingMessageIds).toEqual(['msg-1']); // fallback to valid in-scope id
    });
  });

  describe('Deduplication', () => {
    it('deduplicates identical findings', () => {
      const duplicates = [
        {
          id: 'f-1',
          conversationId: 'convo-1',
          category: 'deadline' as const,
          title: 'Deadline',
          description: 'Due Friday at 5 PM',
          responsiblePerson: null,
          isUserResponsible: false,
          deadline: 'Friday 5 PM',
          supportingMessageIds: ['msg-1'],
          evidenceQuotes: ['Due Friday at 5 PM'],
          confidence: 'high' as const,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'f-2',
          conversationId: 'convo-1',
          category: 'deadline' as const,
          title: 'Deadline duplicate',
          description: 'Due Friday at 5 PM',
          responsiblePerson: null,
          isUserResponsible: false,
          deadline: 'Friday 5 PM',
          supportingMessageIds: ['msg-1'],
          evidenceQuotes: ['Due Friday at 5 PM'],
          confidence: 'high' as const,
          createdAt: new Date().toISOString(),
        },
      ];

      const deduped = deduplicateFindings(duplicates);
      expect(deduped.length).toBe(1);
    });
  });

  describe('Deterministic On-Device Heuristic Extractor', () => {
    it('extracts tasks, commitments, decisions, deadlines, and blockers', () => {
      const findings = extractFindingsHeuristically(sampleMessages, 'convo-1', ['Bob']);
      expect(findings.length).toBeGreaterThan(0);

      // Verify deadlines found
      const deadlineFinding = findings.find((f) => f.category === 'deadline');
      expect(deadlineFinding).toBeDefined();

      // Verify commitment found for Bob
      const commitmentFinding = findings.find((f) => f.category === 'commitment');
      expect(commitmentFinding).toBeDefined();
      expect(commitmentFinding?.responsiblePerson).toBe('Bob');
      expect(commitmentFinding?.isUserResponsible).toBe(true);

      // Verify decision found
      const decisionFinding = findings.find((f) => f.category === 'decision');
      expect(decisionFinding).toBeDefined();

      // Verify blocker found
      const blockerFinding = findings.find((f) => f.category === 'blocker');
      expect(blockerFinding).toBeDefined();
    });

    it('preserves evidence quotes for all extracted findings', () => {
      const findings = extractFindingsHeuristically(sampleMessages, 'convo-1', ['Alex']);
      findings.forEach((finding) => {
        expect(finding.evidenceQuotes.length).toBeGreaterThan(0);
        expect(finding.supportingMessageIds.length).toBeGreaterThan(0);
      });
    });
  });
});
