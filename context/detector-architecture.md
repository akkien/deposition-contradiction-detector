# Deposition Contradiction Detector — Architecture Guide

## Core Principle (read this first)

**Confidence scores must come from application logic, never from the LLM.**

The LLM (Gemini) is good at one thing in this system: **reading natural language and extracting/comparing claims**. It is explicitly *not* trusted to:
- Decide the final contradiction type (direct / inferential / false_positive)
- Assign a confidence score

This means the pipeline is **decoupled into two independent layers**:

```
LAYER A — LLM Layer (Pass 1 + Pass 2)
  Input:  raw transcript text
  Output: structured claims + candidate contradiction pairs
  Role:   language understanding only

LAYER B — Scoring Layer (pure application code, no LLM call)
  Input:  candidate pairs from Layer A
  Output: final type + confidence score + score breakdown
  Role:   deterministic, explainable, rule-based judgment
```

The LLM may *suggest* a type (`llmType`) as a hint, but the scoring layer can **override** it. The final `type` and `confidence` shown to the user always come from Layer B.

---

## Pass 1 — Claim Extraction

### Role
Convert each unstructured transcript into a structured list of atomic claims, tagged by topic, so they can be compared pairwise later. This is pure extraction — no comparison, no judgment.

### Input
Raw transcript text (string).

### Output format (JSON)
```json
{
  "claims": [
    {
      "id": "T1_C1",
      "topic": "location",
      "text": "I was at home all evening",
      "raw_quote": "I was at home all evening. I ordered pizza around 7pm and watched TV."
    }
  ]
}
```

### Example call

**System prompt:**
```
Extract atomic factual claims from this deposition transcript.
Group related claims under a short topic label (e.g. "location",
"sleep_time", "contact", "daniel_cho", "hargrove").
Return ONLY valid JSON, no markdown, no preamble.

Format:
{
  "claims": [
    { "id": "string", "topic": "string", "text": "string", "raw_quote": "string" }
  ]
}
```

**User message:**
```
Transcript label: T1
Transcript:
"""
Q: Where were you on the evening of November 3rd?
A: I was at home all evening. I ordered pizza around 7pm and watched TV.

Q: What time did you go to sleep?
A: Around 10, maybe 10:30. I had work the next morning.
"""
```

**Example response:**
```json
{
  "claims": [
    {
      "id": "T1_C1",
      "topic": "location",
      "text": "I was at home all evening",
      "raw_quote": "I was at home all evening. I ordered pizza around 7pm and watched TV."
    },
    {
      "id": "T1_C2",
      "topic": "sleep_time",
      "text": "Went to sleep around 10, maybe 10:30",
      "raw_quote": "Around 10, maybe 10:30. I had work the next morning."
    }
  ]
}
```

Run this twice — once per transcript (`T1`, `T2`) — using independent calls so neither extraction is biased by the other transcript.

---

## Pass 2 — Candidate Pairing

### Role
Match claims from T1 and T2 that share the same topic, and produce a **candidate** contradiction pair with an `llmType` hint. This is still language understanding — "do these two claims seem to describe the same thing differently?" — not a final verdict.

### Input
Two claim lists (output of Pass 1, one per transcript).

### Output format (JSON)
```json
{
  "pairs": [
    {
      "topic": "string",
      "claim_1_id": "string",
      "claim_2_id": "string",
      "llmType": "direct | inferential | false_positive",
      "llm_explanation": "string"
    }
  ]
}
```

### Example call

**System prompt:**
```
You are given two lists of claims from the same witness, taken months apart.
Match claims that address the same topic. For each match, give your best
guess at the contradiction type:
- "direct": one claim directly negates the other
- "inferential": both claims could be individually true but cannot both
  hold at the same time
- "false_positive": likely just imprecise language, not a real conflict

This is a HINT only — a downstream scoring system will make the final call.
Return ONLY valid JSON.

Format:
{
  "pairs": [
    { "topic": "string", "claim_1_id": "string", "claim_2_id": "string",
      "llmType": "direct|inferential|false_positive", "llm_explanation": "string" }
  ]
}
```

**User message:**
```
T1 claims: [...output of Pass 1 for transcript 1...]
T2 claims: [...output of Pass 1 for transcript 2...]
```

**Example response:**
```json
{
  "pairs": [
    {
      "topic": "location",
      "claim_1_id": "T1_C1",
      "claim_2_id": "T2_C1",
      "llmType": "direct",
      "llm_explanation": "First statement claims no departure from home; second admits leaving."
    },
    {
      "topic": "sleep_time",
      "claim_1_id": "T1_C2",
      "claim_2_id": "T2_C3",
      "llmType": "inferential",
      "llm_explanation": "Both times are plausible alone but conflict if both literally true."
    }
  ]
}
```

### Resolving IDs into full pair objects

Before scoring, join the IDs back to their full claim objects (this is plain code, not an LLM call):

```ts
function resolvePair(rawPair, t1Claims, t2Claims) {
  return {
    topic: rawPair.topic,
    claim_1: t1Claims.find(c => c.id === rawPair.claim_1_id),
    claim_2: t2Claims.find(c => c.id === rawPair.claim_2_id),
    llmType: rawPair.llmType,
    llm_explanation: rawPair.llm_explanation,
  };
}
```

This resolved object is the `pair` argument passed into `scoreContradiction()`.

---

## Scoring Layer — `scoreContradiction(pair, llmType)`

### Role
This is the **only place confidence scores are produced**. No LLM call happens here. It is pure, deterministic, testable application code. It takes the LLM's type as a *hint* but independently computes type + confidence from measurable linguistic signals.

### Function signature & parameter types

```ts
type Claim = {
  text: string;        // normalized claim text
  raw_quote: string;    // original quote from transcript, for UI display
};

type Pair = {
  topic: string;
  claim_1: Claim;
  claim_2: Claim;
};

type LlmType = "direct" | "inferential" | "false_positive";

type NumericDeltaResult = {
  unit: "time" | "age" | "distance" | "weight" | "height";
  value: number; // meaning depends on unit: minutes for time, years for age, km for distance, etc.
};

type ScoreResult = {
  type: LlmType;
  confidence: number;       // 0–1
  breakdown: {
    lexicalOverlap: number;             // 0–1
    numericDelta: NumericDeltaResult | null;
    assertionMin: number;                // 0–1
    hasScopeWord: boolean;
  };
};

function scoreContradiction(pair: Pair, llmType: LlmType): ScoreResult
```

### Example input

```js
const pair = {
  topic: "location",
  claim_1: {
    text: "I was at home all evening",
    raw_quote: "I was at home all evening. I ordered pizza around 7pm and watched TV."
  },
  claim_2: {
    text: "I think I went out briefly around 7:30 for groceries",
    raw_quote: "I think I went out briefly to get some groceries, maybe around 7:30, but came right back."
  }
};

const llmType = "direct";

scoreContradiction(pair, llmType);
```

### Example output

```json
{
  "type": "direct",
  "confidence": 0.55,
  "breakdown": {
    "lexicalOverlap": 0.18,
    "numericDelta": null,
    "assertionMin": 0.5,
    "hasScopeWord": true
  }
}
```

### Example output — age contradiction

To show why typed deltas matter, consider a different pair:

```js
const agePair = {
  topic: "witness_age",
  claim_1: { text: "I was 30 years old at the time", raw_quote: "..." },
  claim_2: { text: "I was 22 years old at the time", raw_quote: "..." }
};

scoreContradiction(agePair, "inferential");
```

```json
{
  "type": "direct",
  "confidence": 0.95,
  "breakdown": {
    "lexicalOverlap": 0.42,
    "numericDelta": { "unit": "age", "value": 8 },
    "assertionMin": 0.5,
    "hasScopeWord": false
  }
}
```

An 8-unit delta means something completely different depending on `unit`:
- `{ unit: "time", value: 8 }` → 8 minutes apart → likely a **false positive**
- `{ unit: "age", value: 8 }` → 8 years apart → almost certainly a **direct contradiction**

This is exactly why thresholds must be **unit-aware**, not a single global number — see the next section.

---

## Logic of `scoreContradiction()`

The function applies rules **in priority order** — each rule is a deterministic, explainable check. It does not blend all signals into one opaque weighted sum; instead it asks "is there a strong, specific signal first?" before falling back to a general estimate.

```
1. If both claims contain a parseable, comparable numeric value (same unit category)
     → compute numericDelta = { unit, value }
     → look up thresholds for that specific unit (see table below)
     → value < unit.smallThreshold   → type = "false_positive", confidence = 0.9
     → value < unit.mediumThreshold  → type = "inferential",    confidence = 0.7
     → value ≥ unit.mediumThreshold  → fall through to step 2 (treat as supporting evidence, not final)

2. If either claim contains a scope qualifier ("all", "never", "always", "only"...)
     → type = "direct"
     → confidence = assertionMin * 0.9 + 0.1

3. Otherwise (no decisive numeric or scope signal):
     → trust llmType as the type
     → confidence = assertionMin * 0.6 + lexicalOverlap * 0.4
```

### Why thresholds must be unit-aware

A raw numeric distance means nothing without its unit. The same number `10` is:
- **trivial** for seconds (`10 sec` apart on a timestamp — rounding)
- **significant** for minutes (`10 min` apart — worth flagging as inferential)
- **enormous** for years of age (`10 years` apart — almost never an honest imprecision)

So `calcNumericDelta` returns a **typed** result (`{ unit, value }`), and the scoring step looks up thresholds **per unit**, not a single global cutoff:

| Unit | smallThreshold (→ false_positive) | mediumThreshold (→ inferential) | Reasoning |
|---|---|---|---|
| `time` (minutes) | < 15 | < 60 | A few minutes is normal imprecision; over an hour is a real gap |
| `age` (years) | < 1 | < 3 | People rarely misstate their own age by more than rounding; even 2–3 years is suspicious |
| `distance` (km) | < 0.5 | < 5 | Sub-500m is rounding ("near the store" vs "at the store"); a few km gap suggests two different locations |
| `weight` (kg) | < 1 | < 5 | Day-to-day weight fluctuation is normal under 1kg; a 5kg+ gap in self-reported weight is notable |
| `height` (cm) | < 1 | < 3 | Height is highly stable; even small reported differences are usually measurement/rounding, but >3cm is odd |

```ts
const UNIT_THRESHOLDS: Record<NumericDeltaResult["unit"], { small: number; medium: number }> = {
  time:       { small: 15,   medium: 60 },    // minutes — a few min is rounding; 1hr+ is a real gap
  age:        { small: 1,    medium: 3 },      // years — people rarely misstate age by rounding alone
  distance:   { small: 0.5,  medium: 5 },      // km — sub-500m is "near"; several km is a different place
  weight:     { small: 1,    medium: 5 },      // kg — daily fluctuation vs a real discrepancy
  height:     { small: 1,    medium: 3 },      // cm — height is stable; >3cm is odd
  money:      { small: 50,   medium: 500 },    // dollars — small amounts are rounding; large gaps suggest different transactions
  duration:   { small: 5,    medium: 30 },     // minutes (event length, not a clock time) — "a few minutes" vs "half an hour"
  speed:      { small: 5,    medium: 20 },     // mph/kmh — under 5 is normal estimation error; 20+ changes the narrative
  occurrence: { small: 1,    medium: 3 },      // how many times something happened ("called twice" vs "called five times") — off-by-one is human; off-by-3+ suggests fabrication
  percentage: { small: 2,    medium: 10 },     // percentage points — 2pp is rounding; 10pp+ changes ownership/liability claims materially
};
```

This table is intentionally explicit and editable — if the legal domain calls for different sensitivity (e.g. stricter age thresholds for minors), it's a one-line change, not a retrained model.

### Why this order, not a flat weighted sum

- **Numeric deltas are checked first** because they are the most objective, hardest-to-dispute signal — math, not interpretation.
- **Scope qualifiers are checked second** because "all" vs "some occasion" is a logical contradiction almost by definition, regardless of wording similarity.
- **Only when neither fires** do we fall back to a blended estimate that leans on the LLM's type — but even then, confidence is computed independently, not copied from the LLM.

### Sub-functions used inside `scoreContradiction`

| Function | Signature | Purpose |
|---|---|---|
| `calcLexicalOverlap(pair)` | `(pair: Pair) => number` | Stemmed word overlap (via `natural`) between `claim_1.text` and `claim_2.text` |
| `calcNumericDelta(pair)` | `(pair: Pair) => NumericDeltaResult \| null` | Detects a comparable numeric value pair (time, age, distance, weight, or height) and returns its unit + delta, or `null` if no comparable numeric signal exists |
| `calcAssertionStrength(text)` | `(text: string) => number` | 0–1 score; lowered by hedge words, raised by strong/absolute words |
| `detectScopeQualifier(text)` | `(text: string) => boolean` | True if text contains an absolute scope word |

Full implementations of these four functions, plus the `UNIT_THRESHOLDS` table they depend on, are shown together in the **Libraries** section below — that's where their library dependencies are introduced.

---

## Libraries

| Function | Library | Why |
|---|---|---|
| `calcLexicalOverlap` | **`natural`** | Used for stemming (Porter Stemmer) so "drove"/"driving"/"drive" count as the same word, plus optional TF-IDF weighting so common words ("the", "was") count less than distinctive ones ("Hargrove", "midnight"). Plain `Set` intersection over raw words is too brittle for real transcript phrasing. |
| `calcNumericDelta` | **`chrono-node`** + **`compromise`** | `chrono-node` handles *time/date* expressions ("around 7:30", "midnight maybe"). `compromise` handles *quantity + unit* expressions that chrono doesn't cover — age ("30 years old"), distance ("5 km away"), weight ("150 lbs"), height, etc. — via its `.numbers()` and entity tagging. Both are needed because they parse different semantic categories. |
| `calcAssertionStrength` | **None** — hand-curated wordlists | Hedge words (`maybe`, `i think`, `perhaps`) and strong words (`never`, `always`, `definitely`) are domain-specific and small enough to maintain directly; backed by forensic-linguistics findings that hedging correlates with uncertain/inaccurate statements |
| `detectScopeQualifier` | **None** — regex over a small wordlist | Simple boundary-matched regex (`\ball\b`, `\bnever\b`, etc.) is sufficient and fully explainable |

Install:
```bash
yarn add chrono-node compromise natural
```

### Sub-function implementations

```ts
import * as chrono from "chrono-node";
import nlp from "compromise";
import natural from "natural";

const stemmer = natural.PorterStemmer;
const tfidf = new natural.TfIdf();

function calcLexicalOverlap(pair: Pair): number {
  const stem = (text: string) =>
    new Set(stemmer.tokenizeAndStem(text.toLowerCase()));

  const stems1 = stem(pair.claim_1.text);
  const stems2 = stem(pair.claim_2.text);
  const intersection = [...stems1].filter((s) => stems2.has(s));
  return intersection.length / Math.max(stems1.size, stems2.size, 1);
}

function calcNumericDelta(pair: Pair): NumericDeltaResult | null {
  // Try time/date first (chrono-node's specialty)
  const t1 = chrono.parse(pair.claim_1.text)[0];
  const t2 = chrono.parse(pair.claim_2.text)[0];
  if (t1 && t2) {
    const minutes = Math.abs(t1.start.date().getTime() - t2.start.date().getTime()) / 60000;
    return { unit: "time", value: minutes };
  }

  // Fall back to quantity + unit extraction (compromise's specialty)
  const q1 = extractQuantity(pair.claim_1.text);
  const q2 = extractQuantity(pair.claim_2.text);
  if (q1 && q2 && q1.unitType === q2.unitType) {
    return { unit: q1.unitType, value: Math.abs(q1.value - q2.value) };
  }

  return null; // no comparable numeric signal in either claim
}

// Maps raw unit words to a normalized unitType category
const UNIT_TYPE_MAP: Record<string, string> = {
  year: "age", years: "age", "years old": "age",
  km: "distance", kilometer: "distance", kilometers: "distance",
  mile: "distance", miles: "distance", m: "distance", meter: "distance",
  kg: "weight", kilogram: "weight", lb: "weight", lbs: "weight", pound: "weight", pounds: "weight",
  cm: "height", ft: "height", feet: "height", inch: "height", inches: "height",
};

function extractQuantity(text: string): { value: number; unitType: string } | null {
  const doc = nlp(text);
  const values = doc.numbers().json(); // e.g. [{ number: 30, ... }]
  if (values.length === 0) return null;

  // Look for a unit word near the number (simple window match)
  const lower = text.toLowerCase();
  for (const [unitWord, unitType] of Object.entries(UNIT_TYPE_MAP)) {
    if (lower.includes(unitWord)) {
      return { value: values[0].number, unitType };
    }
  }
  return null;
}

const HEDGE_WORDS = ["think", "maybe", "might", "perhaps", "probably", "i guess", "not sure"];
const STRONG_WORDS = ["never", "always", "definitely", "certainly", "all"];

function calcAssertionStrength(text: string): number {
  const lower = text.toLowerCase();
  const hedgeCount = HEDGE_WORDS.filter((w) => lower.includes(w)).length;
  const strongCount = STRONG_WORDS.filter((w) => lower.includes(w)).length;
  return Math.max(0, Math.min(1, 0.5 + strongCount * 0.25 - hedgeCount * 0.2));
}

const SCOPE_WORDS = ["all", "every", "never", "always", "only", "none", "nobody", "everyone"];

function detectScopeQualifier(text: string): boolean {
  const lower = text.toLowerCase();
  return SCOPE_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

// Per-unit thresholds — see "Why thresholds must be unit-aware" above
const UNIT_THRESHOLDS: Record<NumericDeltaResult["unit"], { small: number; medium: number }> = {
  time:     { small: 15, medium: 60 },   // minutes
  age:      { small: 1,  medium: 3 },     // years
  distance: { small: 0.5, medium: 5 },    // km
  weight:   { small: 1,  medium: 5 },     // kg
  height:   { small: 1,  medium: 3 },     // cm
};

function scoreContradiction(pair: Pair, llmType: LlmType): ScoreResult {
  const lexicalOverlap = calcLexicalOverlap(pair);
  const numericDelta = calcNumericDelta(pair);
  const assertionMin = Math.min(
    calcAssertionStrength(pair.claim_1.text),
    calcAssertionStrength(pair.claim_2.text)
  );
  const hasScopeWord =
    detectScopeQualifier(pair.claim_1.text) ||
    detectScopeQualifier(pair.claim_2.text);

  const breakdown = { lexicalOverlap, numericDelta, assertionMin, hasScopeWord };

  if (numericDelta !== null) {
    const thresholds = UNIT_THRESHOLDS[numericDelta.unit];
    if (numericDelta.value < thresholds.small) {
      return { type: "false_positive", confidence: 0.9, breakdown };
    }
    if (numericDelta.value < thresholds.medium) {
      return { type: "inferential", confidence: 0.7, breakdown };
    }
    // value >= medium threshold: a large, decisive gap — fall through to step 2,
    // but this is strong supporting evidence even if step 2/3 ultimately decides type
  }

  if (hasScopeWord) {
    return {
      type: "direct",
      confidence: assertionMin * 0.9 + 0.1,
      breakdown,
    };
  }

  return {
    type: llmType,
    confidence: assertionMin * 0.6 + lexicalOverlap * 0.4,
    breakdown,
  };
}
```

---

## End-to-end flow summary

```
Transcript 1 ──┐
               ├─► Pass 1 (LLM) ─► claims_1
Transcript 2 ──┘
               ├─► Pass 1 (LLM) ─► claims_2

claims_1 + claims_2 ─► Pass 2 (LLM) ─► candidate pairs (with llmType hint)

candidate pairs ─► resolvePair() [plain code] ─► full Pair objects

For each Pair:
  scoreContradiction(pair, llmType) [plain code, NO LLM CALL]
    ─► final { type, confidence, breakdown }

Final results ─► UI (color-coded chips, confidence bars, raw quote highlights)
```

**The only two LLM calls in the entire pipeline are Pass 1 and Pass 2.** Everything after that — type finalization, confidence scoring, breakdown — is deterministic application code that can be unit-tested independently of the LLM.