# Current Feature

## Goals

### Feature: Results Display

Wire up the full pipeline to the UI and display scored contradictions below the transcript panes.

---

#### New types (`src/types/detector.ts`)

```ts
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ScoredContradiction {
  topic: string
  type: LlmType
  confidence: number      // 0–1, from scoring layer
  severity: Severity      // derived from confidence + type
  claim1: string          // raw_quote from claim_1 (T1)
  claim2: string          // raw_quote from claim_2 (T2)
  explanation: string     // llm_explanation from Pass 2
  breakdown: ScoreResult['breakdown']
}
```

**Severity derivation** (pure function, no LLM):
- `type === 'false_positive'` → `LOW`
- `confidence >= 0.7` → `HIGH`
- `confidence >= 0.4` → `MEDIUM`
- else → `LOW`

---

#### Color constants (`src/lib/colors.ts`)

```ts
export const TYPE_COLORS: Record<LlmType, string> = {
  direct:         '#ef4444',
  inferential:    '#f59e0b',
  false_positive: '#9ca3af',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  HIGH:   '#1b5e20',
  MEDIUM: '#2e7d32',
  LOW:    '#4caf50',
}
```

---

#### Pipeline orchestrator (`src/lib/detector/pipeline.ts`)

`runPipeline(t1: TranscriptData, t2: TranscriptData): Promise<ScoredContradiction[]>`

Runs Pass 1 (parallel for T1 and T2) → Pass 2 → `resolvePairs` → `scoreContradiction` for each pair → derives severity → returns `ScoredContradiction[]`. Called only from the API route.

---

#### API route (`src/app/api/analyze/route.ts`)

- `POST /api/analyze`
- Body: `{ witnessName: string, transcript1: TranscriptData, transcript2: TranscriptData }`
- Calls `runPipeline`, returns `{ contradictions: ScoredContradiction[] }`
- On error: returns `{ error: string }` with appropriate HTTP status
- Never exposes raw transcript text or LLM responses in error messages

---

#### UI components

**`src/components/results/ContradictionCard.tsx`**

Props: `contradiction: ScoredContradiction`, `isSelected: boolean`, `date1: string`, `date2: string`, `onClick: () => void`

Layout (matches prototype):
- Left border colored by type (`TYPE_COLORS[type]`)
- Header row: type badge (uppercase, background tinted by type color) + severity badge (text colored by `SEVERITY_COLORS[severity]`) + topic label + confidence percentage
- Body: `date1:` label + `claim1` quote, then `date2:` label + `claim2` quote
- Collapsed by default; clicking expands to show `explanation` and score breakdown

**`src/components/results/ContradictionList.tsx`**

Props: `contradictions: ScoredContradiction[]`, `selectedId: number | null`, `onSelect: (i: number | null) => void`, `date1: string`, `date2: string`

- Count header: "Results (N found)" — "No contradictions found" if empty
- Filter row: type pills (ALL / DIRECT / INFERENTIAL / FALSE_POSITIVE) + severity pills (ALL / HIGH / MEDIUM / LOW)
- Sort toggle: by confidence (default, HIGH first) or by topic (A–Z)
- Renders filtered/sorted `ContradictionCard` list

---

#### `TranscriptInputPage` changes

New state:
- `results: ScoredContradiction[] | null` — null = not yet analyzed
- `selectedIdx: number | null` — which card is expanded/active
- `mode: 'input' | 'results'` — controls which view is shown

Flow:
1. **Input mode**: existing UI (witness name, two transcript panels, button)
2. Button click → `handleAnalyze` → POST `/api/analyze` → on success: `setResults(...)`, `setMode('results')`
3. **Results mode**: show transcript panes (read-only, with active quote highlighted) + `ContradictionList` below; show "Edit Transcripts" button that resets to input mode

**Transcript quote highlighting** (in results mode):

Replace the `<textarea>` in each `TranscriptPanel` with a read-only `<pre>` that splits the transcript text around the active `raw_quote` substring and wraps the matching segment in a `<mark>` styled with a light tint of `TYPE_COLORS[type]`. If the quote is not found as an exact substring, render the transcript without highlight (graceful fallback).

---

#### What is NOT in this feature

- No server actions — this feature uses an API route (long-running, needs specific status codes)
- No transcript edit after results (that is a separate future feature listed in the spec)
- No export

## History

### Pass 3 — Scoring Layer — completed 2026-06-20

Implemented the deterministic scoring layer (`scoreContradiction`): no LLM calls, pure application code. Four sub-functions (`calcLexicalOverlap`, `calcNumericDelta`, `calcAssertionStrength`, `detectScopeQualifier`) feed into a priority-ordered scoring pipeline — numeric delta first (unit-aware thresholds via `UNIT_THRESHOLDS`), then scope qualifiers, then LLM type fallback. Added `NumericDeltaResult` and `ScoreResult` types. 32 unit tests (all pure, no mocks) plus a full pipeline integration test (Pass 1 → Pass 2 → Pass 3, skipped without API key). Libraries: `chrono-node`, `natural`.

### Pass 2 — Candidate Pairing — completed 2026-06-20

Implemented the second LLM pass: `pairClaims(t1Claims, t2Claims)` calls Gemini to match claims by topic and return `CandidatePair[]` with `llmType` hints. `resolvePairs()` joins IDs back to full `Claim` objects (pure code, no LLM). Added `LlmType`, `CandidatePair`, `ResolvedPair` types. Unit tests cover pairing shape, fallback parsing, malformed error, and all `resolvePairs` edge cases. Integration test runs the full Pass 1 → Pass 2 chain against the real API.

### Pass 1 — Claim Extraction — completed 2026-06-20

Implemented the first LLM pipeline pass: `extractClaims(transcript, label)` calls Gemini to extract atomic claims grouped by topic. Includes `lib/gemini.ts` singleton, `types/detector.ts` Claim type, defensive JSON parsing with bracket-slicing fallback. Unit tests mock Gemini; integration tests run against the real API with the prototype transcripts (skipped when no key). Vitest set up with `yarn test` / `yarn test:watch` scripts.

### Transcript Input UI — completed 2026-06-20

Built the transcript input page: shared witness name field, two side-by-side transcript panels (date + textarea each), Find Contradictions button with loading/disabled/error states. Light theme matching the prototype. Analysis handler is a stub.
