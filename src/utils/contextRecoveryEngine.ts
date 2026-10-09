import type { 
  NormalizedMessage, 
  AIFinding, 
  EventChange, 
  TaskStatus, 
  PriorityLevel, 
  ProjectContext 
} from '../types';

/**
 * Computes deterministic priority for a finding based on transparent, testable rules:
 * - Deadline urgency (explicit deadline presence)
 * - Personal relevance (assigned to user)
 * - Blockers & critical issues
 * - Contradictions or changed plans
 */
export function calculateFindingPriority(
  finding: AIFinding,
  hasChanges: boolean
): { priority: PriorityLevel; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Personal responsibility (+4)
  if (finding.isUserResponsible) {
    score += 4;
    reasons.push('Assigned to you');
  }

  // 2. Concrete deadline (+3)
  if (finding.deadline) {
    score += 3;
    reasons.push(`Target deadline: ${finding.deadline}`);
  }

  // 3. Blocker or reported obstacle (+4)
  if (finding.category === 'blocker') {
    score += 4;
    reasons.push('Reported blocker or system obstacle');
  }

  // 4. Decision reversal or changed deadline (+3)
  if (hasChanges) {
    score += 3;
    reasons.push('Plan, deadline, or agreement changed');
  }

  // 5. Explicit commitment (+2)
  if (finding.category === 'commitment') {
    score += 2;
    reasons.push('Explicit personal commitment');
  }

  // 6. Direct task assignment (+2)
  if (finding.category === 'task_assignment') {
    score += 2;
    if (finding.responsiblePerson) {
      reasons.push(`Assigned to ${finding.responsiblePerson}`);
    }
  }

  // Determine Level
  let priority: PriorityLevel = 'low';
  if (score >= 6) {
    priority = 'urgent';
  } else if (score >= 4) {
    priority = 'high';
  } else if (score >= 2) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  if (reasons.length === 0) {
    reasons.push('General conversation item');
  }

  return { priority, reasons };
}

/**
 * Reconciles chronological messages to track task status transitions:
 * - detects completion reports ("Done", "Fixed", "Finished", "PR merged")
 * - detects blocker reports ("Blocked by...")
 * - detects cancellation ("Cancelled", "Drop this")
 * - preserves evidence citations
 */
export function trackTaskStatus(
  finding: AIFinding,
  messages: NormalizedMessage[]
): { status: TaskStatus; statusEvidence?: string } {
  if (finding.category === 'blocker') {
    return { status: 'blocked', statusEvidence: finding.description };
  }

  // Look for later messages mentioning related topic or sender
  const msgMap = new Map(messages.map((m) => [m.id, m]));
  const primaryMsg = finding.supportingMessageIds[0] ? msgMap.get(finding.supportingMessageIds[0]) : null;
  const primaryIndex = primaryMsg?.rawLineIndex || 0;

  // Check later messages in timeline
  const laterMessages = messages.filter((m) => (m.rawLineIndex || 0) > primaryIndex);

  const completionRegex = /\b(?:done|completed|finished|shipped|merged|deployed|resolved|fixed)\b/i;
  const cancelRegex = /\b(?:cancelled|canceled|discarded|dropped|no longer needed|obsolete)\b/i;
  const inProgressRegex = /\b(?:working on it|in progress|looking into|investigating|started)\b/i;

  for (const later of laterMessages) {
    // If the person responsible reports status
    const isOwnerSpeaking = finding.responsiblePerson && 
      later.sender.toLowerCase().includes(finding.responsiblePerson.toLowerCase());

    if (isOwnerSpeaking || later.content.toLowerCase().includes(finding.title.toLowerCase().slice(0, 20))) {
      if (completionRegex.test(later.content)) {
        return { status: 'completed', statusEvidence: `Reported by ${later.sender}: "${later.content}"` };
      }
      if (cancelRegex.test(later.content)) {
        return { status: 'cancelled', statusEvidence: `Cancelled by ${later.sender}: "${later.content}"` };
      }
      if (inProgressRegex.test(later.content)) {
        return { status: 'in_progress', statusEvidence: `Progress note by ${later.sender}: "${later.content}"` };
      }
    }
  }

  if (finding.category === 'task_assignment' || finding.category === 'commitment') {
    return { status: 'pending' };
  }

  return { status: 'pending' };
}

/**
 * Detects chronological changes, contradictory plans, and deadline shifts
 */
export function detectEventChanges(
  findings: AIFinding[],
  messages: NormalizedMessage[]
): EventChange[] {
  const changes: EventChange[] = [];
  const msgMap = new Map(messages.map((m) => [m.id, m]));

  // 1. Deadline changes
  const deadlineFindings = findings.filter((f) => f.category === 'deadline' && f.deadline);
  if (deadlineFindings.length >= 2) {
    for (let i = 0; i < deadlineFindings.length - 1; i++) {
      for (let j = i + 1; j < deadlineFindings.length; j++) {
        const earlier = deadlineFindings[i];
        const later = deadlineFindings[j];

        if (earlier.deadline !== later.deadline) {
          const earlierMsg = msgMap.get(earlier.supportingMessageIds[0]);
          const laterMsg = msgMap.get(later.supportingMessageIds[0]);

          changes.push({
            id: `change-dl-${earlier.id}-${later.id}`,
            findingId: later.id,
            changeType: 'deadline_change',
            originalState: earlier.deadline || 'Initial deadline',
            updatedState: later.deadline || 'Revised deadline',
            earlierMessageId: earlier.supportingMessageIds[0] || '',
            laterMessageId: later.supportingMessageIds[0] || '',
            earlierTimestamp: earlierMsg?.originalTimestamp || 'Earlier',
            laterTimestamp: laterMsg?.originalTimestamp || 'Later',
            explanation: `Deadline shifted from "${earlier.deadline}" to "${later.deadline}".`,
            isConfirmed: true,
          });
        }
      }
    }
  }

  // 2. Decision reversals & superseded agreements
  const decisionFindings = findings.filter((f) => f.category === 'decision');
  if (decisionFindings.length >= 2) {
    for (let i = 0; i < decisionFindings.length - 1; i++) {
      const earlier = decisionFindings[i];
      const later = decisionFindings[i + 1];

      const earlierMsg = msgMap.get(earlier.supportingMessageIds[0]);
      const laterMsg = msgMap.get(later.supportingMessageIds[0]);

      // Check if later message explicitly mentions "changed from", "instead of", "moved from", "updated to"
      const shiftIndicators = /\b(?:instead of|changed from|moved from|rather than|reversing|switch to|switched)\b/i;
      if (shiftIndicators.test(later.description) || (laterMsg && shiftIndicators.test(laterMsg.content))) {
        changes.push({
          id: `change-dec-${earlier.id}-${later.id}`,
          findingId: later.id,
          changeType: 'decision_reversal',
          originalState: earlier.title,
          updatedState: later.title,
          earlierMessageId: earlier.supportingMessageIds[0] || '',
          laterMessageId: later.supportingMessageIds[0] || '',
          earlierTimestamp: earlierMsg?.originalTimestamp || 'Earlier',
          laterTimestamp: laterMsg?.originalTimestamp || 'Later',
          explanation: `Earlier decision superseded by later consensus: "${later.title}".`,
          isConfirmed: true,
        });
      }
    }
  }

  return changes;
}

/**
 * Filter findings by active ProjectContext keywords
 */
export function filterFindingsByProjectContext(
  findings: AIFinding[],
  context: ProjectContext | null
): AIFinding[] {
  if (!context || !context.keywords || context.keywords.length === 0) {
    return findings;
  }

  const normalizedKeywords = context.keywords
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  return findings.filter((f) => {
    const text = `${f.title} ${f.description} ${f.evidenceQuotes.join(' ')}`.toLowerCase();
    const matched = normalizedKeywords.filter((kw) => text.includes(kw));
    if (matched.length > 0) {
      f.matchedKeywords = matched;
      return true;
    }
    return false;
  });
}

/**
 * Complete context recovery orchestrator:
 * Computes task states, event changes, and priorities for all findings
 */
export function reconcileContextRecovery(
  findings: AIFinding[],
  messages: NormalizedMessage[]
): { findings: AIFinding[]; changes: EventChange[] } {
  const changes = detectEventChanges(findings, messages);
  const changeFindingIds = new Set(changes.map((c) => c.findingId));

  const reconciledFindings = findings.map((finding) => {
    const hasChanges = changeFindingIds.has(finding.id);
    const { status } = trackTaskStatus(finding, messages);
    const { priority, reasons } = calculateFindingPriority(finding, hasChanges);
    const relevantChanges = changes.filter((c) => c.findingId === finding.id);

    return {
      ...finding,
      status,
      priority,
      priorityReasons: reasons,
      changeHistory: relevantChanges.length > 0 ? relevantChanges : undefined,
    };
  });

  return { findings: reconciledFindings, changes };
}
