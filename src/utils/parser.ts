export type { NormalizedMessage, ConversationParseResult, SourcePlatform, MessageType } from '../types';
import type { NormalizedMessage, ConversationParseResult, SourcePlatform, MessageType } from '../types';

/**
 * Fast deterministic string hash function (djb2 based) for duplicate detection and stable IDs
 */
export function computeStringHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Robust date parser attempting unambiguous ISO representation
 * Supports DD/MM/YYYY vs MM/DD/YYYY detection heuristics.
 * Returns null if the date is ambiguous or invalid so we never hallucinate dates.
 */
export function tryParseTimestamp(rawTimestamp: string): string | null {
  const clean = rawTimestamp.trim().replace(/^\[|\]$/g, '');

  // 1. Check if valid direct ISO string
  const directDate = new Date(clean);
  if (!isNaN(directDate.getTime()) && clean.includes('T')) {
    return directDate.toISOString();
  }

  // 2. WhatsApp date formats (e.g. 12/31/23, 14:20 or 31/12/2023, 2:20 PM or 2026-10-09 10:15)
  // Match Date part and Time part
  const waMatch = clean.match(/^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)$/);
  if (waMatch) {
    const [, p1, p2, p3, timePart] = waMatch;
    let year = 0;
    let month = 0;
    let day = 0;

    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    const n3 = parseInt(p3, 10);

    // If p1 is 4 digits -> YYYY-MM-DD
    if (p1.length === 4) {
      year = n1;
      month = n2;
      day = n3;
    } else {
      // 2 or 4 digit year is at p3
      year = p3.length === 2 ? 2000 + n3 : n3;
      // Heuristic: If n1 > 12, n1 must be DAY (DD/MM/YYYY)
      if (n1 > 12 && n2 <= 12) {
        day = n1;
        month = n2;
      } else if (n2 > 12 && n1 <= 12) {
        // n2 must be DAY (MM/DD/YYYY)
        month = n1;
        day = n2;
      } else if (n1 <= 12 && n2 <= 12) {
        // Ambiguous without locale context! Return null to preserve original timestamp honestly
        return null;
      } else {
        return null;
      }
    }

    // Parse time part
    const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([APap][Mm]))?$/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const meridiem = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;

      const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString();
      }
    }
  }

  // 3. Fallback: try standard YYYY-MM-DD HH:MM
  const stdMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (stdMatch) {
    const [, yr, mo, da, hr, mn, sc] = stdMatch;
    const dateObj = new Date(Date.UTC(
      parseInt(yr, 10),
      parseInt(mo, 10) - 1,
      parseInt(da, 10),
      parseInt(hr, 10),
      parseInt(mn, 10),
      sc ? parseInt(sc, 10) : 0
    ));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString();
    }
  }

  return null;
}

/**
 * Identifies if a message is a media placeholder or system event
 */
export function classifyMessageType(content: string, sender: string): { type: MessageType; cleanContent: string } {
  const trimmed = content.trim();

  // Media attachments common in WhatsApp
  const mediaPatterns = [
    /<Media omitted>/i,
    /image omitted/i,
    /video omitted/i,
    /audio omitted/i,
    /document omitted/i,
    /sticker omitted/i,
    /Contact card omitted/i,
    /Voice call/i,
    /Video call/i,
    /location:\s*https?:\/\//i
  ];

  for (const pattern of mediaPatterns) {
    if (pattern.test(trimmed)) {
      return { type: 'media', cleanContent: trimmed };
    }
  }

  // System events (e.g. security codes, group creation, member added)
  if (
    sender === 'System' ||
    /Messages and calls are end-to-end encrypted/i.test(trimmed) ||
    /created group/i.test(trimmed) ||
    /added you/i.test(trimmed) ||
    /changed the subject/i.test(trimmed) ||
    /left/i.test(trimmed) && trimmed.length < 50
  ) {
    return { type: 'system', cleanContent: trimmed };
  }

  return { type: 'chat', cleanContent: trimmed };
}

/**
 * Main parser implementation normalizing any supported chat logs into NormalizedMessage[]
 */
export function parseConversationText(rawText: string, customConversationId?: string): ConversationParseResult {
  const trimmed = rawText.trim();
  const conversationId = customConversationId || `convo-${Date.now()}`;
  const importBatchId = `batch-${computeStringHash(trimmed.slice(0, 500) + trimmed.length)}`;

  if (!trimmed) {
    return {
      success: false,
      messages: [],
      totalMessages: 0,
      senders: [],
      errors: ['The provided conversation input is empty.'],
      warnings: [],
      rawTextLength: 0,
      sourcePlatform: 'generic_text',
      conversationId,
      importBatchId,
    };
  }

  // 1. Try parsing JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const validMessages: NormalizedMessage[] = [];
      const sendersSet = new Set<string>();

      items.forEach((item, index) => {
        if (typeof item === 'object' && item !== null && (item.content || item.message || item.text)) {
          const sender = String(item.sender || item.author || item.user || 'Unknown').trim();
          const content = String(item.content || item.message || item.text || '');
          const originalTimestamp = String(item.timestamp || item.time || `Item ${index + 1}`);
          const parsedTimestamp = tryParseTimestamp(originalTimestamp);
          const { type: messageType } = classifyMessageType(content, sender);

          const msgId = `${conversationId}-msg-${index + 1}-${computeStringHash(content.slice(0, 30))}`;

          validMessages.push({
            id: msgId,
            conversationId,
            sourcePlatform: 'json',
            sender,
            originalTimestamp,
            parsedTimestamp,
            content,
            messageType,
            rawLineIndex: index + 1,
            importBatchId,
          });
          sendersSet.add(sender);
        }
      });

      if (validMessages.length > 0) {
        return {
          success: true,
          messages: validMessages,
          totalMessages: validMessages.length,
          senders: Array.from(sendersSet),
          dateRange: {
            start: validMessages[0].originalTimestamp,
            end: validMessages[validMessages.length - 1].originalTimestamp,
          },
          errors: [],
          warnings: [],
          rawTextLength: rawText.length,
          sourcePlatform: 'json',
          conversationId,
          importBatchId,
        };
      }
    } catch {
      // Fall through to regex parser
    }
  }

  // 2. Line by line parser
  const lines = rawText.split(/\r?\n/);
  const messages: NormalizedMessage[] = [];
  const sendersSet = new Set<string>();
  const warnings: string[] = [];

  // Patterns
  // Pattern A: Bracket format [YYYY-MM-DD HH:MM] Sender: Message OR [DD/MM/YYYY, HH:MM:SS] Sender: Message
  const bracketRegex = /^\[([^\]]+)\]\s+([^:]+):\s*(.*)$/;

  // Pattern B: WhatsApp standard dash (e.g. 12/31/23, 14:20 - Sender: Message or 12/31/2023, 2:20 PM - Sender: Message)
  const whatsAppDashRegex = /^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*-\s+([^:]+):\s*(.*)$/;

  // Pattern C: WhatsApp system event without sender (e.g. 12/31/23, 14:20 - Messages and calls are end-to-end encrypted)
  const whatsAppSystemRegex = /^(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s*-\s+(.+)$/;

  // Pattern D: Plain sender colon (Sender: Message)
  const simpleColonRegex = /^([A-Za-z0-9_\s.()'-]{2,30}):\s+(.+)$/;

  let detectedPlatform: SourcePlatform = 'generic_text';
  let currentMessage: NormalizedMessage | null = null;
  let skippedLinesCount = 0;
  let ambiguousDateCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let matched = false;

    // Check WhatsApp Dash
    const waDashMatch = trimmedLine.match(whatsAppDashRegex);
    if (waDashMatch) {
      detectedPlatform = 'whatsapp';
      if (currentMessage) messages.push(currentMessage);

      const [, rawTime, sender, content] = waDashMatch;
      const cleanSender = sender.trim();
      const parsedTime = tryParseTimestamp(rawTime);
      if (!parsedTime && rawTime.includes('/')) ambiguousDateCount++;

      const { type } = classifyMessageType(content, cleanSender);
      const msgId = `${conversationId}-msg-${messages.length + 1}-${computeStringHash(content.slice(0, 30))}`;

      currentMessage = {
        id: msgId,
        conversationId,
        sourcePlatform: 'whatsapp',
        sender: cleanSender,
        originalTimestamp: rawTime.trim(),
        parsedTimestamp: parsedTime,
        content: content.trim(),
        messageType: type,
        rawLineIndex: i + 1,
        importBatchId,
      };
      sendersSet.add(cleanSender);
      matched = true;
    }

    // Check WhatsApp System line
    if (!matched) {
      const waSysMatch = trimmedLine.match(whatsAppSystemRegex);
      if (waSysMatch && !waSysMatch[2].includes(':')) {
        detectedPlatform = 'whatsapp';
        if (currentMessage) messages.push(currentMessage);

        const [, rawTime, sysContent] = waSysMatch;
        const parsedTime = tryParseTimestamp(rawTime);
        const msgId = `${conversationId}-msg-${messages.length + 1}-sys`;

        currentMessage = {
          id: msgId,
          conversationId,
          sourcePlatform: 'whatsapp',
          sender: 'System',
          originalTimestamp: rawTime.trim(),
          parsedTimestamp: parsedTime,
          content: sysContent.trim(),
          messageType: 'system',
          rawLineIndex: i + 1,
          importBatchId,
        };
        sendersSet.add('System');
        matched = true;
      }
    }

    // Check Bracket
    if (!matched) {
      const bracketMatch = trimmedLine.match(bracketRegex);
      if (bracketMatch) {
        if (currentMessage) messages.push(currentMessage);

        const [, rawTime, sender, content] = bracketMatch;
        const cleanSender = sender.trim();
        const parsedTime = tryParseTimestamp(rawTime);
        const { type } = classifyMessageType(content, cleanSender);
        const msgId = `${conversationId}-msg-${messages.length + 1}-${computeStringHash(content.slice(0, 30))}`;

        currentMessage = {
          id: msgId,
          conversationId,
          sourcePlatform: 'generic_text',
          sender: cleanSender,
          originalTimestamp: rawTime.trim(),
          parsedTimestamp: parsedTime,
          content: content.trim(),
          messageType: type,
          rawLineIndex: i + 1,
          importBatchId,
        };
        sendersSet.add(cleanSender);
        matched = true;
      }
    }

    // Check Simple Colon
    if (!matched) {
      const colonMatch = trimmedLine.match(simpleColonRegex);
      if (colonMatch && !colonMatch[1].toLowerCase().startsWith('http') && !colonMatch[1].toLowerCase().startsWith('note')) {
        if (currentMessage) messages.push(currentMessage);

        const [, sender, content] = colonMatch;
        const cleanSender = sender.trim();
        const { type } = classifyMessageType(content, cleanSender);
        const msgId = `${conversationId}-msg-${messages.length + 1}-${computeStringHash(content.slice(0, 30))}`;

        currentMessage = {
          id: msgId,
          conversationId,
          sourcePlatform: 'generic_text',
          sender: cleanSender,
          originalTimestamp: `Line ${i + 1}`,
          parsedTimestamp: null,
          content: content.trim(),
          messageType: type,
          rawLineIndex: i + 1,
          importBatchId,
        };
        sendersSet.add(cleanSender);
        matched = true;
      }
    }

    // Multiline continuation or unmatched line
    if (!matched) {
      if (currentMessage) {
        currentMessage.content += `\n${line}`;
      } else {
        skippedLinesCount++;
      }
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  if (messages.length === 0) {
    return {
      success: false,
      messages: [],
      totalMessages: 0,
      senders: [],
      errors: [
        'Could not detect standard message boundaries (e.g. WhatsApp "MM/DD/YY, HH:MM - Sender: msg", "[time] Sender: msg", or JSON). Please verify the formatting.',
      ],
      warnings: [],
      rawTextLength: rawText.length,
      sourcePlatform: detectedPlatform,
      conversationId,
      importBatchId,
    };
  }

  if (skippedLinesCount > 0) {
    warnings.push(`${skippedLinesCount} unformatted header or preamble lines were skipped before the first message.`);
  }

  if (ambiguousDateCount > 0) {
    warnings.push(`${ambiguousDateCount} timestamps had ambiguous day/month order (e.g. 05/06/23). Original timestamps were preserved honestly without guessing.`);
  }

  return {
    success: true,
    messages,
    totalMessages: messages.length,
    senders: Array.from(sendersSet),
    dateRange: {
      start: messages[0].originalTimestamp,
      end: messages[messages.length - 1].originalTimestamp,
    },
    errors: [],
    warnings,
    rawTextLength: rawText.length,
    sourcePlatform: detectedPlatform,
    conversationId,
    importBatchId,
  };
}
