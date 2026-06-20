import { describe, it, expect } from 'vitest'
import { extractClaims } from '../pass1'
import { pairClaims, resolvePairs } from '../pass2'

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

const VALID_LLM_TYPES = new Set(['direct', 'inferential', 'false_positive'])

describe.skipIf(!process.env.GEMINI_API_KEY)('pairClaims — integration (real Gemini)', () => {
  it('pairs claims from prototype transcripts and resolves them', async () => {
    const [t1Claims, t2Claims] = await Promise.all([
      extractClaims(TRANSCRIPT_1, 'T1'),
      extractClaims(TRANSCRIPT_2, 'T2'),
    ])

    const pairs = await pairClaims(t1Claims, t2Claims)
    expect(pairs.length).toBeGreaterThan(0)

    for (const p of pairs) {
      expect(p.topic).toBeTruthy()
      expect(p.claim_1_id).toMatch(/^T1_C\d+$/)
      expect(p.claim_2_id).toMatch(/^T2_C\d+$/)
      expect(VALID_LLM_TYPES.has(p.llmType)).toBe(true)
      expect(p.llm_explanation).toBeTruthy()
    }

    const resolved = resolvePairs(pairs, t1Claims, t2Claims)
    expect(resolved.length).toBeGreaterThan(0)

    console.log(`Pairs: ${pairs.length}, resolved: ${resolved.length}`)
    console.log(JSON.stringify(resolved, null, 2))
  }, 60000)
})
