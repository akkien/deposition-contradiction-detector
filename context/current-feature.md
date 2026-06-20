# Current Feature

## Goals

### Feature: Pass 3 — Scoring Layer

Implement the deterministic scoring layer: pure application code (no LLM) that takes a `ResolvedPair` and the LLM's type hint and returns a final `type`, `confidence`, and `breakdown`. This is the only place confidence scores are produced in the entire pipeline.

**Function signature:**

```ts
function scoreContradiction(pair: ResolvedPair, llmType: LlmType): ScoreResult
```

**New types (add to `src/types/detector.ts`):**

```ts
interface NumericDeltaResult {
  unit: 'time' | 'age' | 'distance' | 'weight' | 'height' | 'money' | 'duration' | 'speed' | 'occurrence' | 'percentage'
  value: number
}

interface ScoreResult {
  type: LlmType
  confidence: number  // 0–1
  breakdown: {
    lexicalOverlap: number
    numericDelta: NumericDeltaResult | null
    assertionMin: number
    hasScopeWord: boolean
  }
}
```

**Files to create:**

- `src/lib/detector/scoring.ts` — `scoreContradiction()` and four sub-functions:
  - `calcLexicalOverlap(pair)` — stemmed word overlap via `natural`
  - `calcNumericDelta(pair)` — typed numeric delta via `chrono-node` + `compromise`
  - `calcAssertionStrength(text)` — hedge/strong word scoring, no library
  - `detectScopeQualifier(text)` — absolute scope word detection, no library
- `src/lib/detector/__tests__/scoring.test.ts` — unit tests (no mocks needed, all pure functions)

**Scoring logic (priority order):**

1. If `numericDelta` exists → apply unit-aware thresholds (`UNIT_THRESHOLDS`):
   - `value < small` → `false_positive`, confidence 0.9
   - `value < medium` → `inferential`, confidence 0.7
   - `value ≥ medium` → fall through
2. If scope qualifier (`all`, `never`, `always`, etc.) → `direct`, confidence = `assertionMin * 0.9 + 0.1`
3. Otherwise → trust `llmType`, confidence = `assertionMin * 0.6 + lexicalOverlap * 0.4`

**Libraries to install:** `chrono-node`, `compromise`, `natural`

**Tests (all pure — no mocks):**

- `calcLexicalOverlap`: stemmed overlap, synonym-insensitive, handles empty strings
- `calcNumericDelta`: time expressions (chrono), age/distance/weight (compromise), returns null when no numeric signal
- `calcAssertionStrength`: hedge words lower score, strong words raise it, clamps to 0–1
- `detectScopeQualifier`: detects `never`/`all`/`always` etc., word-boundary matched
- `scoreContradiction`: numeric path (each unit type), scope path, fallback path, confidence range 0–1

## Notes

- All sub-functions exported for direct testing
- `UNIT_THRESHOLDS` exported as a constant so tests can reference it

## History

### Pass 2 — Candidate Pairing — completed 2026-06-20

Implemented the second LLM pass: `pairClaims(t1Claims, t2Claims)` calls Gemini to match claims by topic and return `CandidatePair[]` with `llmType` hints. `resolvePairs()` joins IDs back to full `Claim` objects (pure code, no LLM). Added `LlmType`, `CandidatePair`, `ResolvedPair` types. Unit tests cover pairing shape, fallback parsing, malformed error, and all `resolvePairs` edge cases. Integration test runs the full Pass 1 → Pass 2 chain against the real API.

### Pass 1 — Claim Extraction — completed 2026-06-20

Implemented the first LLM pipeline pass: `extractClaims(transcript, label)` calls Gemini to extract atomic claims grouped by topic. Includes `lib/gemini.ts` singleton, `types/detector.ts` Claim type, defensive JSON parsing with bracket-slicing fallback. Unit tests mock Gemini; integration tests run against the real API with the prototype transcripts (skipped when no key). Vitest set up with `yarn test` / `yarn test:watch` scripts.

### Transcript Input UI — completed 2026-06-20

Built the transcript input page: shared witness name field, two side-by-side transcript panels (date + textarea each), Find Contradictions button with loading/disabled/error states. Light theme matching the prototype. Analysis handler is a stub.
