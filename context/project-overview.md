# Deposition Contradiction Detector — Project Overview

## 1. Summary

A web application that helps legal professionals (attorneys, paralegals, legal researchers) detect contradictions between multiple depositions, witness statements, or testimony transcripts from the same individual. The app sends transcript pairs to an LLM (Gemini) for analysis and displays structured, categorized contradiction findings in a readable side-by-side UI.

This document is a spec for rebuilding the current React/Artifact prototype as a production Next.js application.

---

## 2. Problem Statement

When witnesses give testimony multiple times (e.g., initial deposition, follow-up deposition, trial testimony), inconsistencies in their statements can be legally significant — they may indicate unreliable memory, coaching, or deception. Manually cross-referencing long transcripts to find these inconsistencies is slow and error-prone. This tool automates first-pass detection so legal staff can focus their review time on the most relevant discrepancies.

---

## 3. Core Features (MVP)

1. **Transcript input**
   - Paste two transcripts.
   - Support plain text paste initially.
   - Each transcript has metadata: witness name, date, deposition/proceeding type.

2. **Contradiction analysis**
   - Send transcripts to Gemini via API with a structured prompt.
   - Request structured JSON output: list of contradictions, each with:
     - `claim1` (quote/paraphrase from transcript 1)
     - `claim2` (quote/paraphrase from transcript 2)
     - `type`: `DIRECT` | `INFERENTIAL` | `FALSE_POSITIVE`
     - `severity`: `HIGH` | `MEDIUM` | `LOW`
     - `topic` (short label, e.g. "Location on Nov 3rd")
     - `explanation` (why this is/isn't a contradiction)

3. **Results display**
   - Side-by-side transcript viewer, highlighted contradiction claims, pair by pair using type color codes
   - List of contradictions, color-coded by type.
   - Click a contradiction to highlight/scroll to the relevant lines in both transcripts.
   - Filter/sort by severity or type.
   - Type color codes:
      - `DIRECT`: "#ef4444"
      - `INFERENTIAL`: "#f59e0b"
      - `FALSE_POSITIVE`: "#9ca3af"
   - Severity color codes:
      - `HIGH`: "#1b5e20"
      - `MEDIUM`: "#2e7d32"
      - `LOW`: "#4caf50"

4. **Authentication**
   - This version is for guest user only. 
   - There is no authentication and authorization for this version.

5. **Transcripts edit**

    - After analyzing two transcripts, users are allowed to edit transcripts and analyze again

---

## 4. Contradiction Detector Architecture

This is the main logic of the application. Read @context/detector-architecture.md

## 5. Non-Goals (for MVP)

- No multi-party comparison (more than 2 transcripts at once) — defer to v2.
- No automatic transcription from audio/video — text input only.
- No legal-conclusion generation ("this proves perjury") — tool surfaces inconsistencies only; legal judgment remains with the human user.
- No real-time collaborative editing.

---

## 6. Tech Stack

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS
- **AI:** Gemini API, called server-side only (never expose API key client-side)
- **File parsing:** `pdf-parse` or similar for PDF upload support (fast-follow)
- **Hosting:** Vercel
- **Package Manager:** yarn

---

## 7. Architecture Notes

### API key & security

- All calls to the Gemini API must go through a Next.js API route (`/app/api/analyze/route.ts`), never directly from the client. The API key lives in server-side environment variables only.

### Prompting & output parsing

- **AI provider:** Google Gemini, via the `@google/genai` SDK. Model: `gemini-2.5-flash` (see `AI_MODEL` constant).
- All calls go through a singleton client (`getGemini()`), instantiated lazily and reused across requests within the same server process. `GEMINI_API_KEY` lives in server-side env vars only — never exposed to the client.

```ts
// lib/gemini.ts
import { GoogleGenAI } from '@google/genai'

let _gemini: GoogleGenAI | null = null

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('Missing GEMINI_API_KEY environment variable')
    _gemini = new GoogleGenAI({ apiKey: key })
  }
  return _gemini
}

export const AI_MODEL = 'gemini-2.5-flash'
```

- **Force structured output with `responseSchema`.** Gemini supports a native JSON mode (`responseMimeType: 'application/json'` + `responseSchema`) that constrains the model to emit valid JSON matching a schema — this is strongly preferred over prompting the model to "return only JSON" and hoping it complies. Example call shape:

```ts
const ai = getGemini()

const response = await ai.models.generateContent({
  model: AI_MODEL,
  contents: prompt, // includes both transcripts + instructions
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim1: { type: 'string' },
          claim2: { type: 'string' },
          type: { type: 'string', enum: ['DIRECT', 'INFERENTIAL', 'FALSE_POSITIVE'] },
          severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          topic: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['claim1', 'claim2', 'type', 'severity', 'topic', 'explanation'],
      },
    },
  },
})

const text = response.text // SDK exposes the generated text directly
```

- **Still parse defensively even with `responseSchema`.** Schema mode makes malformed output rare, not impossible (truncation from hitting `maxOutputTokens`, transient API quirks, etc.). Do **not** rely on regex-stripping markdown fences as the only safeguard — it silently breaks if the model adds any text before/after the JSON. Instead:
  - Wrap `JSON.parse(text)` in try/catch.
  - As a fallback, locate the first `[` and the matching last `]` in the text and slice before parsing.
  - On parse failure, return a clear soft error to the client (e.g., `{ error: 'AI returned malformed data, please retry' }`) rather than letting the API route crash with a 500.
  - Log the raw response text (server-side only) on parse failure for debugging — never log it somewhere the client can see, since transcripts may contain sensitive case material.

- **Token/length limits:** `gemini-2.5-flash` has a large context window, but very long transcript pairs plus the schema overhead can still approach `maxOutputTokens` for the response. Set `maxOutputTokens` explicitly and treat a response that looks truncated (e.g., parse fails at the very end of the string) as a signal to chunk the input rather than just retrying.

## 8. UI/UX Notes

- Two-pane transcript viewer (left/right), synced scrolling optional.
- Contradiction list as below the panes.
- Severity shown as a badge (HIGH/MEDIUM/LOW).
- Loading state while analysis runs (can take several seconds for long transcripts).
- Clear empty/error states (e.g., "no contradictions found" vs. "analysis failed, retry").

---

## 9. Reference Prototype

UI Prototype:

- @context/prototype/main-ui.png
- @context/prototype/output-ui.png

The current prototype (React artifact at @context/prototype/main.tsx) demonstrates:

- A hardcoded two-transcript example (witness depositions 6 months apart).
- A single API call to Gemini requesting JSON-formatted contradictions.
- Basic rendering of contradiction cards with type/severity styling.

These should be treated as a idea/UI/interaction reference only — the production app needs real transcript input, and robust JSON parsing as described above.

The application allow users to input two deposition of a person.


## 10. Remain Features

- **PDF/DOCX upload:** — upload transcripts instead of pasting
- **Export:** — download contradiction report as PDF/DOCX
- **Multiple transcripts:** — find contradictions across more than 2 transcripts
- **Authentication:** — user accounts, saved transcripts and results

## 11. Improvements

Use legal or deposition-specific fine-tuning AI models for detection

| Model | Strength | Why it fits |
| --- | --- | --- |
| `epequeno/legal-entailment-deberta-v3-large` | Highest accuracy for legal contradiction | Fine-tuned on a lawyer-reviewed legal entailment benchmark. Labels: `entailed`, `partially_entailed`, `contradicted`, `neutral`. Achieves 96.9% F1 on `contradicted` claims and 95.8% overall accuracy. Built for citation/claim verification in legal documents. |
| `nimamegh/roberta_cnn_legal` | LegalLens shared task winner | RoBERTa + CNN hybrid trained for legal NLI (entailment / neutral / contradiction). Good for general legal statement pairs. |
| `Agreemind/contractnli-distilbert-nda` | Fastest / production-friendly | DistilBERT fine-tuned on ContractNLI. Smaller and faster, but domain-focused on contract provisions, not free-form testimony. |