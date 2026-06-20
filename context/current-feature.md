# Current Feature

## Goals

## History

### Results Display — completed 2026-06-20

Wired the full pipeline to the UI. `runPipeline()` orchestrates Pass 1 (parallel) → Pass 2 → `resolvePairs` → `scoreContradiction` and maps results to `ScoredContradiction[]` with derived severity. `POST /api/analyze` calls the pipeline server-side with quota-aware error handling (429 → user-friendly message). `ContradictionCard` shows type/severity badges, confidence %, quotes, always-visible explanation, and an expandable score breakdown with a chevron toggle. `ContradictionList` has type/severity filter pills and confidence/topic sort. `TranscriptPanel` gained read-only mode with quote highlighting. Clicking "Edit Transcripts" makes transcripts editable again while keeping results visible.

### Pass 3 — Scoring Layer — completed 2026-06-20

Implemented the deterministic scoring layer (`scoreContradiction`): no LLM calls, pure application code. Four sub-functions (`calcLexicalOverlap`, `calcNumericDelta`, `calcAssertionStrength`, `detectScopeQualifier`) feed into a priority-ordered scoring pipeline — numeric delta first (unit-aware thresholds via `UNIT_THRESHOLDS`), then scope qualifiers, then LLM type fallback. Added `NumericDeltaResult` and `ScoreResult` types. 32 unit tests (all pure, no mocks) plus a full pipeline integration test (Pass 1 → Pass 2 → Pass 3, skipped without API key). Libraries: `chrono-node`, `natural`.

### Pass 2 — Candidate Pairing — completed 2026-06-20

Implemented the second LLM pass: `pairClaims(t1Claims, t2Claims)` calls Gemini to match claims by topic and return `CandidatePair[]` with `llmType` hints. `resolvePairs()` joins IDs back to full `Claim` objects (pure code, no LLM). Added `LlmType`, `CandidatePair`, `ResolvedPair` types. Unit tests cover pairing shape, fallback parsing, malformed error, and all `resolvePairs` edge cases. Integration test runs the full Pass 1 → Pass 2 chain against the real API.

### Pass 1 — Claim Extraction — completed 2026-06-20

Implemented the first LLM pipeline pass: `extractClaims(transcript, label)` calls Gemini to extract atomic claims grouped by topic. Includes `lib/gemini.ts` singleton, `types/detector.ts` Claim type, defensive JSON parsing with bracket-slicing fallback. Unit tests mock Gemini; integration tests run against the real API with the prototype transcripts (skipped when no key). Vitest set up with `yarn test` / `yarn test:watch` scripts.

### Transcript Input UI — completed 2026-06-20

Built the transcript input page: shared witness name field, two side-by-side transcript panels (date + textarea each), Find Contradictions button with loading/disabled/error states. Light theme matching the prototype. Analysis handler is a stub.
