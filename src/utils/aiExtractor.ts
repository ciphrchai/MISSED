import type { NormalizedMessage, AIFinding, FindingCategory, FindingConfidence } from '../types';
import { computeStringHash } from './parser';

/**
 * Chunk size constraint to maintain bounded token windows
 */
const MESSAGES_PER_CHUNK = 20;

/**
 * System prompt instructing model to extract exact structured JSON findings
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a privacy-first conversation intelligence extractor.
Analyze the following conversation messages and extract ONLY verifiable facts in JSON format.
Extract findings in these 7 categories:
- announcement: Team-wide announcements, updates, and broadcasts
- task_assignment: Specific tasks assigned to an explicit person
- deadline: Concrete deadlines, dates, or time limits
- decision: Architecture decisions, agreed plans, or resolved questions
- request: Direct questions or requests expecting an answer
- commitment: Explicit promises or undertakings ("I will...", "I'll do...")
- blocker: Reported obstacles, issues, bugs, or blockers

RULES:
1. Do NOT hallucinate or assume facts not present in the messages.
2. If responsible person is not explicitly named, set responsiblePerson to null.
3. If deadline is not stated, set deadline to null.
4. Output valid JSON array of objects:
[
  {
    "category": "task_assignment" | "deadline" | "decision" | "announcement" | "request" | "commitment" | "blocker",
    "title": "Short title",
    "description": "What was communicated",
    "responsiblePerson": "Name" or null,
    "deadline": "YYYY-MM-DD or time text" or null,
    "supportingMessageIds": ["msg-id-1"],
    "evidenceQuote": "exact quote from message",
    "confidence": "high" | "medium" | "low"
  }
]`;

/**
 * Splits conversation messages into manageable, bounded chunks with sender and timestamp context
 */
export function chunkMessages(messages: NormalizedMessage[]): NormalizedMessage[][] {
  const chatMessages = messages.filter((m) => m.messageType === 'chat' || m.messageType === 'system');
  if (chatMessages.length === 0) return [];

  const chunks: NormalizedMessage[][] = [];
  for (let i = 0; i < chatMessages.length; i += MESSAGES_PER_CHUNK) {
    chunks.push(chatMessages.slice(i, i + MESSAGES_PER_CHUNK));
  }
  return chunks;
}

/**
 * Formats a message chunk into a clean prompt string preserving message IDs, senders, and timestamps
 */
export function formatChunkPrompt(chunk: NormalizedMessage[]): string {
  return chunk
    .map((m) => `[ID: ${m.id}] [${m.originalTimestamp}] ${m.sender}: ${m.content}`)
    .join('\n');
}

/**
 * Validates and normalizes raw JSON output from the model into typed AIFinding objects
 */
export function validateAndNormalizeFindings(
  rawJson: unknown,
  conversationId: string,
  userAliases: string[],
  validMessageIds: Set<string>
): AIFinding[] {
  if (!rawJson) return [];
  const items = Array.isArray(rawJson) ? rawJson : [rawJson];
  const validCategories: Set<FindingCategory> = new Set([
    'announcement',
    'task_assignment',
    'deadline',
    'decision',
    'request',
    'commitment',
    'blocker',
  ]);

  const findings: AIFinding[] = [];
  const normalizedUserAliases = userAliases
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.length > 0);

  items.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) return;

    const rawCategory = String((item as Record<string, unknown>).category || '').toLowerCase();
    const category: FindingCategory = validCategories.has(rawCategory as FindingCategory)
      ? (rawCategory as FindingCategory)
      : 'announcement';

    const title = String((item as Record<string, unknown>).title || 'Extracted Finding').trim();
    const description = String((item as Record<string, unknown>).description || '').trim();
    if (!description) return;

    const rawPerson = (item as Record<string, unknown>).responsiblePerson;
    const responsiblePerson = rawPerson && typeof rawPerson === 'string' && rawPerson.toLowerCase() !== 'null'
      ? rawPerson.trim()
      : null;

    // Check personal relevance
    const isUserResponsible = responsiblePerson
      ? normalizedUserAliases.some((alias) => responsiblePerson.toLowerCase().includes(alias))
      : false;

    const rawDeadline = (item as Record<string, unknown>).deadline;
    const deadline = rawDeadline && typeof rawDeadline === 'string' && rawDeadline.toLowerCase() !== 'null'
      ? rawDeadline.trim()
      : null;

    // Validate supporting message IDs
    const rawIds = (item as Record<string, unknown>).supportingMessageIds;
    let supportingMessageIds: string[] = [];
    if (Array.isArray(rawIds)) {
      supportingMessageIds = rawIds.map(String).filter((id) => validMessageIds.has(id));
    }
    if (supportingMessageIds.length === 0 && validMessageIds.size > 0) {
      // Pick first message from scope if not specified
      supportingMessageIds = [Array.from(validMessageIds)[0]];
    }

    // Evidence quote
    const rawQuote = (item as Record<string, unknown>).evidenceQuotes || (item as Record<string, unknown>).evidenceQuote || (item as Record<string, unknown>).evidence;
    const evidenceQuotes: string[] = [];
    if (typeof rawQuote === 'string' && rawQuote.trim()) {
      evidenceQuotes.push(rawQuote.trim());
    } else if (Array.isArray(rawQuote)) {
      evidenceQuotes.push(...rawQuote.map(String).filter(Boolean));
    }
    if (evidenceQuotes.length === 0 && description) {
      evidenceQuotes.push(description);
    }

    const rawConf = String((item as Record<string, unknown>).confidence || 'medium').toLowerCase();
    const confidence: FindingConfidence = ['high', 'medium', 'low'].includes(rawConf)
      ? (rawConf as FindingConfidence)
      : 'medium';

    const findingId = `finding-${conversationId}-${computeStringHash(title + description + index)}`;

    findings.push({
      id: findingId,
      conversationId,
      category,
      title,
      description,
      responsiblePerson,
      isUserResponsible,
      deadline,
      supportingMessageIds,
      evidenceQuotes,
      confidence,
      createdAt: new Date().toISOString(),
    });
  });

  return deduplicateFindings(findings);
}

/**
 * Deduplicate findings that have identical or nearly identical descriptions and categories
 */
export function deduplicateFindings(findings: AIFinding[]): AIFinding[] {
  const seen = new Set<string>();
  const unique: AIFinding[] = [];

  for (const f of findings) {
    const key = `${f.category}:${f.description.toLowerCase().slice(0, 50)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(f);
    }
  }

  return unique;
}

/**
 * Fallback heuristic extractor:
 * If browser WebAssembly / WebGPU is unavailable or fails due to hardware memory limits,
 * this genuine local rule-based extractor processes messages locally on the device
 * with ZERO cloud API calls, guaranteeing structured output.
 */
export function extractFindingsHeuristically(
  messages: NormalizedMessage[],
  conversationId: string,
  userAliases: string[]
): AIFinding[] {
  const findings: AIFinding[] = [];
  const validMessageIds = new Set(messages.map((m) => m.id));
  const normalizedUserAliases = userAliases.map((a) => a.trim().toLowerCase()).filter(Boolean);

  const deadlineRegex = /\b(?:before|by|until|due|deadline)\s+([A-Za-z0-9: ,/-]+(?:\bAM\b|\bPM\b|\bUTC\b|\bFriday\b|\bMonday\b|\bToday\b|\bTomorrow\b)?)/i;
  const decisionRegex = /\b(?:decided|agreed|locked in|confirmed|approved|resolved|moving to)\b/i;
  const commitmentRegex = /\b(?:I will|I'll|will do|taking care of|working on)\b/i;
  const blockerRegex = /\b(?:blocker|blocked by|bug|issue|broken|failing|error|warning)\b/i;
  const requestRegex = /\b(?:please|could you|can you|need someone to)\b/i;

  messages.forEach((msg, idx) => {
    if (msg.messageType !== 'chat') return;
    const content = msg.content;

    // 1. Deadlines
    const dlMatch = content.match(deadlineRegex);
    if (dlMatch) {
      findings.push({
        id: `finding-${conversationId}-dl-${msg.id}-${idx}`,
        conversationId,
        category: 'deadline',
        title: `Deadline: ${dlMatch[1].trim().slice(0, 40)}`,
        description: content,
        responsiblePerson: null,
        isUserResponsible: false,
        deadline: dlMatch[1].trim(),
        supportingMessageIds: [msg.id],
        evidenceQuotes: [content],
        confidence: 'high',
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Commitments
    if (commitmentRegex.test(content)) {
      const isUser = normalizedUserAliases.some((a) => msg.sender.toLowerCase().includes(a));
      findings.push({
        id: `finding-${conversationId}-commit-${msg.id}-${idx}`,
        conversationId,
        category: 'commitment',
        title: `Commitment by ${msg.sender}`,
        description: content,
        responsiblePerson: msg.sender,
        isUserResponsible: isUser,
        deadline: dlMatch ? dlMatch[1].trim() : null,
        supportingMessageIds: [msg.id],
        evidenceQuotes: [content],
        confidence: 'high',
        createdAt: new Date().toISOString(),
      });
    }

    // 3. Decisions
    if (decisionRegex.test(content)) {
      findings.push({
        id: `finding-${conversationId}-dec-${msg.id}-${idx}`,
        conversationId,
        category: 'decision',
        title: `Agreed Decision`,
        description: content,
        responsiblePerson: null,
        isUserResponsible: false,
        deadline: null,
        supportingMessageIds: [msg.id],
        evidenceQuotes: [content],
        confidence: 'high',
        createdAt: new Date().toISOString(),
      });
    }

    // 4. Requests & Tasks
    if (requestRegex.test(content)) {
      // Check if another participant is addressed
      const words = content.split(' ');
      let assignedPerson: string | null = null;
      if (content.startsWith('@') || words[0].endsWith(':') || words[0].endsWith(',')) {
        assignedPerson = words[0].replace(/[@:,]/g, '');
      }
      const isUser = assignedPerson
        ? normalizedUserAliases.some((a) => assignedPerson!.toLowerCase().includes(a))
        : false;

      findings.push({
        id: `finding-${conversationId}-task-${msg.id}-${idx}`,
        conversationId,
        category: assignedPerson ? 'task_assignment' : 'request',
        title: assignedPerson ? `Task for ${assignedPerson}` : 'Direct Request',
        description: content,
        responsiblePerson: assignedPerson,
        isUserResponsible: isUser,
        deadline: dlMatch ? dlMatch[1].trim() : null,
        supportingMessageIds: [msg.id],
        evidenceQuotes: [content],
        confidence: 'medium',
        createdAt: new Date().toISOString(),
      });
    }

    // 5. Blockers
    if (blockerRegex.test(content)) {
      findings.push({
        id: `finding-${conversationId}-blocker-${msg.id}-${idx}`,
        conversationId,
        category: 'blocker',
        title: `Reported Blocker/Issue`,
        description: content,
        responsiblePerson: null,
        isUserResponsible: false,
        deadline: null,
        supportingMessageIds: [msg.id],
        evidenceQuotes: [content],
        confidence: 'medium',
        createdAt: new Date().toISOString(),
      });
    }
  });

  return validateAndNormalizeFindings(findings, conversationId, userAliases, validMessageIds);
}
