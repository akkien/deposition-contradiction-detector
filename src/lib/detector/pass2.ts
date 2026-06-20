import { getGemini, AI_MODEL } from '@/lib/gemini'
import { Claim, CandidatePair, ResolvedPair } from '@/types/detector'

const SYSTEM_PROMPT = `You are given two lists of claims from the same witness, taken months apart.
Match claims that address the same topic. For each match, give your best guess at the contradiction type:
- "direct": one claim directly negates the other
- "inferential": both claims could be individually true but cannot both hold at the same time
- "false_positive": likely just imprecise language, not a real conflict

This is a HINT only — a downstream scoring system will make the final call.
Return ONLY valid JSON, no markdown, no preamble.

Format:
{
  "pairs": [
    { "topic": "string", "claim_1_id": "string", "claim_2_id": "string",
      "llmType": "direct|inferential|false_positive", "llm_explanation": "string" }
  ]
}`

export async function pairClaims(
  t1Claims: Claim[],
  t2Claims: Claim[]
): Promise<CandidatePair[]> {
  const ai = getGemini()

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `${SYSTEM_PROMPT}\n\nT1 claims: ${JSON.stringify(t1Claims)}\n\nT2 claims: ${JSON.stringify(t2Claims)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          pairs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic:           { type: 'string' },
                claim_1_id:      { type: 'string' },
                claim_2_id:      { type: 'string' },
                llmType:         { type: 'string', enum: ['direct', 'inferential', 'false_positive'] },
                llm_explanation: { type: 'string' },
              },
              required: ['topic', 'claim_1_id', 'claim_2_id', 'llmType', 'llm_explanation'],
            },
          },
        },
        required: ['pairs'],
      },
    },
  })

  const raw = response.text ?? ''

  try {
    const parsed = JSON.parse(raw)
    return parsed.pairs as CandidatePair[]
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1))
        return parsed.pairs as CandidatePair[]
      } catch {
        // fall through to error
      }
    }
    console.error('[pass2] malformed LLM response:', raw)
    throw new Error('Candidate pairing returned malformed data, please retry')
  }
}

export function resolvePairs(
  pairs: CandidatePair[],
  t1Claims: Claim[],
  t2Claims: Claim[]
): ResolvedPair[] {
  const resolved: ResolvedPair[] = []
  for (const pair of pairs) {
    const claim1 = t1Claims.find((c) => c.id === pair.claim_1_id)
    const claim2 = t2Claims.find((c) => c.id === pair.claim_2_id)
    if (!claim1 || !claim2) continue
    resolved.push({
      topic: pair.topic,
      claim_1: claim1,
      claim_2: claim2,
      llmType: pair.llmType,
      llm_explanation: pair.llm_explanation,
    })
  }
  return resolved
}
