export type NavigationTab = 
  | 'dashboard' 
  | 'import' 
  | 'actions' 
  | 'decisions' 
  | 'contexts' 
  | 'evidence' 
  | 'settings';

export type SourcePlatform = 'whatsapp' | 'generic_text' | 'json' | 'telegram' | 'teams';

export type MessageType = 'chat' | 'system' | 'media' | 'unknown';

export type FindingCategory = 
  | 'announcement'
  | 'task_assignment'
  | 'deadline'
  | 'decision'
  | 'request'
  | 'commitment'
  | 'blocker';

export type FindingConfidence = 'high' | 'medium' | 'low';

export type TaskStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled'
  | 'superseded'
  | 'uncertain';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

/**
 * Event Change / Contradiction Record
 */
export interface EventChange {
  id: string;
  findingId: string;
  changeType: 'deadline_change' | 'decision_reversal' | 'task_reassignment' | 'cancellation' | 'blocker_resolved';
  originalState: string;
  updatedState: string;
  earlierMessageId: string;
  laterMessageId: string;
  earlierTimestamp: string;
  laterTimestamp: string;
  explanation: string;
  isConfirmed: boolean; // Confirmed vs possible contradiction
}

/**
 * Validated AI Finding Data Model
 */
export interface AIFinding {
  id: string;                               // Unique deterministic finding ID
  conversationId: string;                   // Reference to analyzed conversation
  category: FindingCategory;                // Typed category
  title: string;                            // Short summary title
  description: string;                      // What the message communicated
  responsiblePerson: string | null;         // Explicit assignee/owner if stated
  isUserResponsible: boolean;               // True if matches user's identity
  deadline: string | null;                  // Explicit, unambiguous deadline string
  supportingMessageIds: string[];           // Verifiable message IDs
  evidenceQuotes: string[];                 // Exact verbatim quotes supporting finding
  confidence: FindingConfidence;            // Confidence level
  createdAt: string;                        // Timestamp of analysis
  // Phase 4 additions:
  status?: TaskStatus;                      // Dynamic task state
  priority?: PriorityLevel;                 // Deterministic calculated priority
  priorityReasons?: string[];               // Understandable reasons for priority
  changeHistory?: EventChange[];            // Detected changes / reversals
  matchedKeywords?: string[];               // Keywords matched from active project context
}

/**
 * Platform-independent normalized message model
 */
export interface NormalizedMessage {
  id: string;                    // Stable deterministic or indexed ID
  conversationId: string;        // Parent conversation ID
  sourcePlatform: SourcePlatform;
  sender: string;                // Sender display name or 'System'
  originalTimestamp: string;     // Verbatim timestamp string
  parsedTimestamp: string | null;// ISO-8601 string if unambiguous, else null
  content: string;               // Normalized message body text
  messageType: MessageType;      // chat, system, or media placeholder
  rawLineIndex?: number;         // Original line number in imported file
  importBatchId: string;         // Unique import batch reference
}

export type ChatMessage = NormalizedMessage;

/**
 * Conversation metadata entity stored in local IndexedDB
 */
export interface StoredConversation {
  id: string;
  title: string;
  sourcePlatform: SourcePlatform;
  importedAt: string;
  messageCount: number;
  senders: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  fileHash?: string;
  importBatchId: string;
  messages: NormalizedMessage[];
  findings?: AIFinding[];
  changes?: EventChange[];
  lastAnalyzedAt?: string;
}

export interface ConversationParseResult {
  success: boolean;
  messages: NormalizedMessage[];
  totalMessages: number;
  senders: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  errors: string[];
  warnings: string[];
  rawTextLength: number;
  sourcePlatform: SourcePlatform;
  conversationId: string;
  importBatchId: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  activeContextId: string | null;
  currentUserIdentity: string;
  theme: 'dark' | 'light' | 'system';
  localDataRetentionDays: number;
}

export interface AnalysisProgress {
  stage: 'idle' | 'loading_model' | 'processing_chunks' | 'reconciling_context' | 'validating' | 'completed' | 'error';
  progressPercent: number;
  currentChunk: number;
  totalChunks: number;
  message: string;
}
