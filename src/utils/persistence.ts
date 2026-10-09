// Utility to ensure AI findings are persisted even if the conversation hasn't been explicitly saved.
import type { ConversationParseResult, StoredConversation, AIFinding } from '../types';
import { saveConversation } from './indexedDb';

/**
 * Persist findings for a conversation.
 * If a stored conversation with the same id exists, it is updated with the new findings.
 * Otherwise, a new conversation record is created (without a fileHash) and saved.
 * Returns the conversation record that was saved.
 */
export async function persistFindings(
  parseResult: ConversationParseResult,
  findings: AIFinding[],
  storedConversations: StoredConversation[]
): Promise<StoredConversation> {
  const existing = storedConversations.find((c) => c.id === parseResult.conversationId);
  if (existing) {
    const updated: StoredConversation = {
      ...existing,
      findings,
      lastAnalyzedAt: new Date().toISOString(),
    };
    await saveConversation(updated);
    return updated;
  }

  // Auto‑save a new conversation (no fileHash because the user hasn't saved the raw import yet)
  const title = `${parseResult.sourcePlatform.toUpperCase()} Chat (${parseResult.totalMessages} msgs) - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const newConvo: StoredConversation = {
    id: parseResult.conversationId,
    title,
    sourcePlatform: parseResult.sourcePlatform,
    importedAt: new Date().toISOString(),
    messageCount: parseResult.totalMessages,
    senders: parseResult.senders,
    dateRange: parseResult.dateRange,
    // fileHash omitted – it's a draft that will be saved later if the user chooses.
    importBatchId: parseResult.importBatchId,
    messages: parseResult.messages,
    findings,
  };
  await saveConversation(newConvo);
  return newConvo;
}
