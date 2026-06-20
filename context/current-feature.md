# Current Feature

## Goals

## Notes

## History

### Pass 1 — Claim Extraction — completed 2026-06-20

Implemented the first LLM pipeline pass: `extractClaims(transcript, label)` calls Gemini to extract atomic claims grouped by topic. Includes `lib/gemini.ts` singleton, `types/detector.ts` Claim type, defensive JSON parsing with bracket-slicing fallback. Unit tests mock Gemini; integration tests run against the real API with the prototype transcripts (skipped when no key). Vitest set up with `yarn test` / `yarn test:watch` scripts.

### Transcript Input UI — completed 2026-06-20

Built the transcript input page: shared witness name field, two side-by-side transcript panels (date + textarea each), Find Contradictions button with loading/disabled/error states. Light theme matching the prototype. Analysis handler is a stub.
