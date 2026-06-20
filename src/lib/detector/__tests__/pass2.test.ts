import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pairClaims, resolvePairs } from '../pass2'
import { Claim, CandidatePair } from '@/types/detector'

vi.mock('@/lib/gemini', () => ({
  getGemini: vi.fn(),
  AI_MODEL: 'gemini-2.5-flash',
}))

import { getGemini } from '@/lib/gemini'

function mockGeminiResponse(text: string) {
  ;(getGemini as ReturnType<typeof vi.fn>).mockReturnValue({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text }),
    },
  })
}

const T1_CLAIMS: Claim[] = [
  { id: 'T1_C1', topic: 'location', text: 'I was at home all evening', raw_quote: 'I was at home all evening.' },
  { id: 'T1_C2', topic: 'sleep_time', text: 'Went to sleep around 10', raw_quote: 'Around 10, maybe 10:30.' },
]

const T2_CLAIMS: Claim[] = [
  { id: 'T2_C1', topic: 'location', text: 'I went out briefly around 7:30', raw_quote: 'I think I went out briefly, maybe around 7:30.' },
  { id: 'T2_C2', topic: 'sleep_time', text: 'Went to sleep around midnight', raw_quote: 'It was late. Midnight maybe.' },
]

const VALID_RESPONSE = JSON.stringify({
  pairs: [
    { topic: 'location', claim_1_id: 'T1_C1', claim_2_id: 'T2_C1', llmType: 'direct', llm_explanation: 'Home all evening vs went out.' },
    { topic: 'sleep_time', claim_1_id: 'T1_C2', claim_2_id: 'T2_C2', llmType: 'inferential', llm_explanation: '10pm vs midnight.' },
  ],
})

describe('pairClaims', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns CandidatePair array with correct shape', async () => {
    mockGeminiResponse(VALID_RESPONSE)
    const pairs = await pairClaims(T1_CLAIMS, T2_CLAIMS)
    expect(pairs).toHaveLength(2)
    expect(pairs[0].claim_1_id).toBe('T1_C1')
    expect(pairs[0].claim_2_id).toBe('T2_C1')
    expect(pairs[0].llmType).toBe('direct')
    expect(pairs[0].llm_explanation).toBeTruthy()
  })

  it('falls back to bracket-slicing when response has surrounding text', async () => {
    const wrapped = `Sure, here you go:\n${VALID_RESPONSE}\nDone.`
    mockGeminiResponse(wrapped)
    const pairs = await pairClaims(T1_CLAIMS, T2_CLAIMS)
    expect(pairs).toHaveLength(2)
  })

  it('throws a clear error on fully malformed response', async () => {
    mockGeminiResponse('not json at all')
    await expect(pairClaims(T1_CLAIMS, T2_CLAIMS)).rejects.toThrow(
      'Candidate pairing returned malformed data, please retry'
    )
  })
})

describe('resolvePairs', () => {
  const RAW_PAIRS: CandidatePair[] = [
    { topic: 'location', claim_1_id: 'T1_C1', claim_2_id: 'T2_C1', llmType: 'direct', llm_explanation: 'Conflict.' },
    { topic: 'sleep_time', claim_1_id: 'T1_C2', claim_2_id: 'T2_C2', llmType: 'inferential', llm_explanation: 'Gap.' },
  ]

  it('joins claim IDs to full Claim objects', () => {
    const resolved = resolvePairs(RAW_PAIRS, T1_CLAIMS, T2_CLAIMS)
    expect(resolved).toHaveLength(2)
    expect(resolved[0].claim_1).toEqual(T1_CLAIMS[0])
    expect(resolved[0].claim_2).toEqual(T2_CLAIMS[0])
    expect(resolved[0].llmType).toBe('direct')
  })

  it('drops pairs where claim_1_id cannot be resolved', () => {
    const bad: CandidatePair[] = [
      { topic: 'x', claim_1_id: 'T1_MISSING', claim_2_id: 'T2_C1', llmType: 'direct', llm_explanation: '' },
    ]
    expect(resolvePairs(bad, T1_CLAIMS, T2_CLAIMS)).toHaveLength(0)
  })

  it('drops pairs where claim_2_id cannot be resolved', () => {
    const bad: CandidatePair[] = [
      { topic: 'x', claim_1_id: 'T1_C1', claim_2_id: 'T2_MISSING', llmType: 'direct', llm_explanation: '' },
    ]
    expect(resolvePairs(bad, T1_CLAIMS, T2_CLAIMS)).toHaveLength(0)
  })

  it('preserves llm_explanation on resolved pairs', () => {
    const resolved = resolvePairs(RAW_PAIRS, T1_CLAIMS, T2_CLAIMS)
    expect(resolved[0].llm_explanation).toBe('Conflict.')
  })
})
