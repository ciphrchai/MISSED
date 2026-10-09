# MISSED — Know What You Missed

**MISSED** is a privacy-first AI conversation intelligence platform built to restore personalized context from overflowing conversation channels, sprint chats, and team threads.

Instead of generic document summaries, MISSED pinpoints:
- **Personal obligations & assignments** mapped to your identity.
- **Decision & timeline reversals** (e.g., changing deadlines, superseded architectural agreements).
- **Verifiable evidence trails** preserving timestamps, sender tags, and original line references.

---

## Phase 3: Local AI Intelligence (On-Device Inference)

Phase 3 extends MISSED with **zero-cloud, on-device AI inference** to extract structured findings directly in the browser:

### 1. Local AI Engine Architecture
- **Inference Pipeline:** Utilizes `@huggingface/transformers` (`ONNX / WebAssembly`) on the user's client hardware. If browser memory or WebGPU features restrict neural weight initialization, the system cleanly activates the local deterministic rule engine.
- **Strict Privacy Invariant:** **0% Cloud / 0% Telemetry**. No chat transcripts, user queries, findings, or prompts are transmitted across any network. Everything remains inside browser RAM and local IndexedDB.
- **Bounded Chunking:** Messages are sliced into bounded message windows (preserving senders, timestamps, and stable message IDs) to prevent context exhaustion and browser freezing.

### 2. Structured Extraction Schema (`AIFinding`)
Extracts findings across 7 explicit categories:
1. **Announcements & Updates:** Broadcast notifications and milestone alerts.
2. **Tasks & Assignments:** Action items mapped to explicitly identified owners.
3. **Deadlines:** Concrete, unambiguous dates and time constraints.
4. **Decisions & Agreements:** Technical architecture choices and consensus.
5. **Requests & Queries:** Questions expecting an explicit response.
6. **Commitments:** Explicit personal promises ("I will...", "Taking care of...").
7. **Blockers & Issues:** Reported obstacles, timeouts, and bugs.

Every finding retains:
- Categorization & Confidence score (`high` / `medium` / `low`)
- Explicit Assignee / Owner (or `null` if unstated; never fabricated)
- Personal relevance mapping (`isUserResponsible`)
- Verifiable supporting message IDs & verbatim evidence quotes.

### 3. Application Integration
- **Import Screen:** Active **"Analyze with Local AI"** button with a real-time progress bar.
- **Dashboard:** Dynamic counters and highlights for extracted actions and decision alerts.
- **My Actions:** Formatted obligation cards with assignee tags, deadline badges, and supporting quotes.
- **Decision Changes:** Timeline view rendering agreed decisions, concrete deadlines, and blockers with evidence citations.

---

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Run Automated Tests
```bash
npx vitest run
```

### 4. Production Build & Verification
```bash
npm run build
```

---

## Supported Input Formats

1. **WhatsApp Exports (`.txt`):**
   ```text
   12/31/23, 10:00 - Messages and calls are end-to-end encrypted.
   12/31/23, 10:05 - Alice: Team, deadline moved from 14:00 to 18:00 UTC!
   12/31/23, 10:06 - Bob: Understood. Here is the diagram:
   12/31/23, 10:06 - Bob: <Media omitted>
   12/31/23, 10:09 - Alice: @Bob please submit the release ticket before 17:30.
   12/31/23, 10:10 - Bob: I will submit the release ticket by 17:00.
   ```
2. **Standard Bracket Transcripts:**
   ```text
   [2026-10-09 10:15] Sarah: We need to finalize the deliverable before Friday 5 PM.
   [2026-10-09 10:16] Alex: Agreed. Working on the parser now.
   ```
3. **Structured JSON Arrays:**
   ```json
   [
     { "sender": "Sarah", "content": "Deadline moved to 5 PM", "timestamp": "2026-10-09T10:15:00Z" }
   ]
   ```

---

## Phase 3 Limitations

- **Browser Hardware Limits:** Transformer neural model weights require WebAssembly/WebGPU memory; on restricted client runtimes, the local deterministic fallback executes smoothly on-device without cloud fallback.
- **Future Phase 4 Scope:** Advanced cross-conversation delta diffing, change reconciliation, and semantic prioritization will be introduced in subsequent phases.
