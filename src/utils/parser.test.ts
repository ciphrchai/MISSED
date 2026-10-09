import { describe, it, expect } from 'vitest';
import { parseConversationText, tryParseTimestamp, computeStringHash } from './parser';

describe('Real Chat Ingestion Parser', () => {
  describe('WhatsApp format parsing', () => {
    it('parses standard 12-hour WhatsApp messages', () => {
      const raw = `12/31/23, 2:30 PM - Alice: Meeting starts now!
12/31/23, 2:35 PM - Bob: Joining in a moment.`;

      const result = parseConversationText(raw);
      expect(result.success).toBe(true);
      expect(result.sourcePlatform).toBe('whatsapp');
      expect(result.totalMessages).toBe(2);
      expect(result.messages[0].sender).toBe('Alice');
      expect(result.messages[0].content).toBe('Meeting starts now!');
      expect(result.messages[0].originalTimestamp).toContain('12/31/23, 2:30 PM');
      expect(result.messages[0].parsedTimestamp).toBeDefined();
    });

    it('parses 24-hour WhatsApp messages', () => {
      const raw = `31/12/2023, 14:20 - Charlie: Here is the patch.`;

      const result = parseConversationText(raw);
      expect(result.success).toBe(true);
      expect(result.sourcePlatform).toBe('whatsapp');
      expect(result.messages[0].sender).toBe('Charlie');
      expect(result.messages[0].content).toBe('Here is the patch.');
    });

    it('identifies WhatsApp system announcements without senders', () => {
      const raw = `12/31/23, 10:00 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
12/31/23, 10:05 - Alice: Hello everyone`;

      const result = parseConversationText(raw);
      expect(result.success).toBe(true);
      expect(result.totalMessages).toBe(2);
      expect(result.messages[0].sender).toBe('System');
      expect(result.messages[0].messageType).toBe('system');
      expect(result.messages[1].sender).toBe('Alice');
      expect(result.messages[1].messageType).toBe('chat');
    });

    it('identifies media omission placeholders', () => {
      const raw = `12/31/23, 10:00 - Bob: <Media omitted>
12/31/23, 10:01 - Bob: sticker omitted
12/31/23, 10:02 - Bob: Normal text`;

      const result = parseConversationText(raw);
      expect(result.messages[0].messageType).toBe('media');
      expect(result.messages[1].messageType).toBe('media');
      expect(result.messages[2].messageType).toBe('chat');
    });

    it('handles multiline messages cleanly', () => {
      const raw = `12/31/23, 10:00 - Alice: Title of proposal:
- Bullet item 1
- Bullet item 2
12/31/23, 10:05 - Bob: Approved`;

      const result = parseConversationText(raw);
      expect(result.totalMessages).toBe(2);
      expect(result.messages[0].content).toContain('- Bullet item 1');
      expect(result.messages[0].content).toContain('- Bullet item 2');
      expect(result.messages[1].content).toBe('Approved');
    });

    it('handles Unicode and emoji correctly', () => {
      const raw = `12/31/23, 10:00 - Kenji: こんにちは世界 🚀🎉
12/31/23, 10:01 - Priya: धन्यवाद 👍`;

      const result = parseConversationText(raw);
      expect(result.success).toBe(true);
      expect(result.messages[0].content).toBe('こんにちは世界 🚀🎉');
      expect(result.messages[1].content).toBe('धन्यवाद 👍');
    });
  });

  describe('Ambiguous and invalid dates', () => {
    it('does not guess ambiguous dates like 05/06/23 where day and month are <= 12', () => {
      const ambiguous = '05/06/23, 14:00 - Alice: Ambiguous date';
      const result = parseConversationText(ambiguous);
      expect(result.success).toBe(true);
      // parsedTimestamp should be null to avoid hallucinating day vs month
      expect(result.messages[0].parsedTimestamp).toBeNull();
      // original timestamp preserved honestly
      expect(result.messages[0].originalTimestamp).toBe('05/06/23, 14:00');
      // Warning reported
      expect(result.warnings.some((w) => w.includes('ambiguous'))).toBe(true);
    });

    it('parses unambiguous dates when day is > 12', () => {
      const parsedIso = tryParseTimestamp('25/06/2023, 14:00');
      expect(parsedIso).not.toBeNull();
      expect(parsedIso).toContain('2023-06-25');
    });
  });

  describe('Error handling & Malformed input', () => {
    it('returns error when text is empty or whitespaces only', () => {
      const result = parseConversationText('     \n\t   ');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error when input has no recognized message structure', () => {
      const raw = `Random unformatted ramblings without any colon or timestamps`;
      const result = parseConversationText(raw);
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Could not detect standard message boundaries');
    });
  });

  describe('Deterministic hashing & IDs', () => {
    it('produces identical hashes for identical inputs', () => {
      const hash1 = computeStringHash('Test content string 123');
      const hash2 = computeStringHash('Test content string 123');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = computeStringHash('Hello world');
      const hash2 = computeStringHash('Hello world 2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Large input performance', () => {
    it('parses 1000 messages quickly without errors', () => {
      const lines: string[] = [];
      for (let i = 1; i <= 1000; i++) {
        lines.push(`12/31/23, 10:${(i % 50).toString().padStart(2, '0')} - User${i % 10}: Message payload ${i}`);
      }
      const raw = lines.join('\n');
      const start = performance.now();
      const result = parseConversationText(raw);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(result.totalMessages).toBe(1000);
      expect(duration).toBeLessThan(500); // must process within 500ms
    });
  });
});
