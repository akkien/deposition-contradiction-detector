import { getGemini, AI_MODEL } from '@/lib/gemini'
import { Claim } from '@/types/detector'

const SYSTEM_PROMPT = `Extract atomic factual claims from this deposition transcript.
Group related claims under a short topic label (e.g. "location", "sleep_time", "contact").
Return ONLY valid JSON, no markdown, no preamble.

Format:
{
  "claims": [
    { "id": "string", "topic": "string", "text": "string", "raw_quote": "string" }
  ]
}`

export async function extractClaims(transcript: string, label: string): Promise<Claim[]> {
  const ai = getGemini()

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: `${SYSTEM_PROMPT}\n\nTranscript label: ${label}\nTranscript:\n"""\n${transcript}\n"""`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          claims: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id:        { type: 'string' },
                topic:     { type: 'string' },
                text:      { type: 'string' },
                raw_quote: { type: 'string' },
              },
              required: ['id', 'topic', 'text', 'raw_quote'],
            },
          },
        },
        required: ['claims'],
      },
    },
  })

  const raw = response.text ?? ''

  try {
    const parsed = JSON.parse(raw)
    return normalizeClaims(parsed.claims, label)
  } catch {
    // Fallback: slice to the outermost { }
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1))
        return normalizeClaims(parsed.claims, label)
      } catch {
        // fall through to error
      }
    }
    console.error('[pass1] malformed LLM response:', raw)
    throw new Error('Claim extraction returned malformed data, please retry')
  }
}

function normalizeClaims(claims: unknown, label: string): Claim[] {
  if (!Array.isArray(claims)) {
    throw new Error('Claim extraction returned malformed data, please retry')
  }
  return claims.map((c, i) => ({
    id: `${label}_C${i + 1}`,
    topic: String(c.topic ?? ''),
    text: String(c.text ?? ''),
    raw_quote: String(c.raw_quote ?? ''),
  }))
}
