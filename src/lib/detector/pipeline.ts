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

  return resolved.map((pair) => {
    const scored = scoreContradiction(pair, pair.llmType)
    return {
      topic:       pair.topic,
      type:        scored.type,
      confidence:  scored.confidence,
      severity:    deriveSeverity(scored.type, scored.confidence),
      claim1:      pair.claim_1.raw_quote,
      claim2:      pair.claim_2.raw_quote,
      explanation: pair.llm_explanation,
      breakdown:   scored.breakdown,
    }
  })
}
