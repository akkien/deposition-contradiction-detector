import { TranscriptData } from '@/types/transcript'
import { LlmType, ScoredContradiction, Severity } from '@/types/detector'
import { extractClaims } from './pass1'
import { pairClaims, resolvePairs } from './pass2'
import { scoreContradiction } from './scoring'

function deriveSeverity(type: LlmType, confidence: number): Severity {
  if (type === 'false_positive') return 'LOW'
  if (confidence >= 0.7) return 'HIGH'
  if (confidence >= 0.4) return 'MEDIUM'
  return 'LOW'
}

function humanizeExplanation(text: string, label1: string, label2: string): string {
  return text
    .replace(/\bT1(?:_C\d+)?\b/g, label1)
    .replace(/\bT2(?:_C\d+)?\b/g, label2)
}

export async function runPipeline(
  t1: TranscriptData,
  t2: TranscriptData
): Promise<ScoredContradiction[]> {
  const [t1Claims, t2Claims] = await Promise.all([
    extractClaims(t1.text, 'T1'),
    extractClaims(t2.text, 'T2'),
  ])

  const candidatePairs = await pairClaims(t1Claims, t2Claims)
  const resolved = resolvePairs(candidatePairs, t1Claims, t2Claims)

  const label1 = t1.meta.date || 'Transcript 1'
  const label2 = t2.meta.date || 'Transcript 2'

  return resolved.map((pair) => {
    const scored = scoreContradiction(pair, pair.llmType)
    return {
      topic:       pair.topic,
      type:        scored.type,
      confidence:  scored.confidence,
      severity:    deriveSeverity(scored.type, scored.confidence),
      claim1:      pair.claim_1.raw_quote,
      claim2:      pair.claim_2.raw_quote,
      explanation: humanizeExplanation(pair.llm_explanation, label1, label2),
      breakdown:   scored.breakdown,
    }
  })
}
