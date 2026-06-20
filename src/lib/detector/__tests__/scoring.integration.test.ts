import { describe, it, expect } from 'vitest'
import { extractClaims } from '../pass1'
import { pairClaims, resolvePairs } from '../pass2'
import { scoreContradiction, UNIT_THRESHOLDS } from '../scoring'

const TRANSCRIPT_1 = `
Deposition of Marcus Webb — March 14, 2023

Q: Where were you on the evening of November 3rd?
A: I was at home all evening. I ordered pizza around 7pm and watched TV.

Q: Did you speak to anyone that night?
A: No, I was alone. My wife was visiting her sister in Portland.

Q: What time did you go to sleep?
A: Around 10, maybe 10:30. I had work the next morning.

Q: Have you ever been to the Hargrove Street warehouse?
A: No, never. I don't even know where that is.

Q: Do you own a grey Honda Civic?
A: I did at the time, yes. I sold it in January.

Q: Had you met Daniel Cho before November 3rd?
A: No. I'd never heard of him before this whole thing started.
`

const TRANSCRIPT_2 = `
Deposition of Marcus Webb — September 9, 2023

Q: Walk me through the evening of November 3rd again.
A: I was home. I think I went out briefly to get some groceries, maybe around 7:30, but came right back.

Q: You mentioned last time you ordered pizza. Now you're saying groceries?
A: I might have done both. I don't remember exactly, it was almost a year ago.

Q: Did anyone see you that evening?
A: My neighbor, Tom, might have seen me. We waved or something in the parking lot.

Q: What time did you go to sleep?
A: It was late. Midnight maybe. I had trouble sleeping.

Q: Had you ever visited the Hargrove Street area?
A: I mean, I've driven through that part of town. I didn't say I'd never been in that general area.

Q: And Daniel Cho — did you know him?
A: I knew of him. We had mutual friends. I don't think I'd met him face to face.
`

const VALID_TYPES = new Set(['direct', 'inferential', 'false_positive'])
const VALID_UNITS = new Set(Object.keys(UNIT_THRESHOLDS))

describe.skipIf(!process.env.GEMINI_API_KEY)('scoreContradiction — integration (full pipeline)', () => {
  it('scores all resolved pairs from prototype transcripts', async () => {
    const [t1Claims, t2Claims] = await Promise.all([
      extractClaims(TRANSCRIPT_1, 'T1'),
      extractClaims(TRANSCRIPT_2, 'T2'),
    ])

    const pairs = await pairClaims(t1Claims, t2Claims)
    const resolved = resolvePairs(pairs, t1Claims, t2Claims)
    expect(resolved.length).toBeGreaterThan(0)

    for (const pair of resolved) {
      const result = scoreContradiction(pair, pair.llmType)

      expect(VALID_TYPES.has(result.type)).toBe(true)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)

      expect(typeof result.breakdown.lexicalOverlap).toBe('number')
      expect(result.breakdown.lexicalOverlap).toBeGreaterThanOrEqual(0)
      expect(result.breakdown.lexicalOverlap).toBeLessThanOrEqual(1)

      expect(typeof result.breakdown.assertionMin).toBe('number')
      expect(result.breakdown.assertionMin).toBeGreaterThanOrEqual(0)
      expect(result.breakdown.assertionMin).toBeLessThanOrEqual(1)

      expect(typeof result.breakdown.hasScopeWord).toBe('boolean')

      if (result.breakdown.numericDelta !== null) {
        expect(VALID_UNITS.has(result.breakdown.numericDelta.unit)).toBe(true)
        expect(result.breakdown.numericDelta.value).toBeGreaterThanOrEqual(0)
      }
    }

    console.log(`Scored ${resolved.length} pairs:`)
    for (const pair of resolved) {
      const result = scoreContradiction(pair, pair.llmType)
      console.log(
        `  [${pair.topic}] llmType=${pair.llmType} → type=${result.type} confidence=${result.confidence.toFixed(2)}` +
        (result.breakdown.numericDelta
          ? ` numericDelta=${result.breakdown.numericDelta.value}${result.breakdown.numericDelta.unit}`
          : '')
      )
    }
  }, 90000)
})
