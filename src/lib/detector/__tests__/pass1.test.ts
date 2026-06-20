import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractClaims } from '../pass1'

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

const VALID_RESPONSE = JSON.stringify({
  claims: [
    { id: 'X', topic: 'location', text: 'I was at home', raw_quote: 'I was at home all evening.' },
    { id: 'X', topic: 'sleep_time', text: 'Went to sleep around 10', raw_quote: 'Around 10, maybe 10:30.' },
  ],
})

describe('extractClaims', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns typed Claim array with correct label-prefixed ids', async () => {
    mockGeminiResponse(VALID_RESPONSE)
    const claims = await extractClaims('some transcript', 'T1')
    expect(claims).toHaveLength(2)
    expect(claims[0].id).toBe('T1_C1')
    expect(claims[1].id).toBe('T1_C2')
    expect(claims[0].topic).toBe('location')
    expect(claims[0].text).toBe('I was at home')
  })

  it('uses the provided label as prefix', async () => {
    mockGeminiResponse(VALID_RESPONSE)
    const claims = await extractClaims('some transcript', 'T2')
    expect(claims[0].id).toBe('T2_C1')
  })

  it('falls back to bracket-slicing when response has surrounding text', async () => {
    const wrapped = `Here is the result:\n${VALID_RESPONSE}\nEnd.`
    mockGeminiResponse(wrapped)
    const claims = await extractClaims('some transcript', 'T1')
    expect(claims).toHaveLength(2)
  })

  it('throws a clear error on fully malformed response', async () => {
    mockGeminiResponse('not json at all')
    await expect(extractClaims('some transcript', 'T1')).rejects.toThrow(
      'Claim extraction returned malformed data, please retry'
    )
  })

  it('throws a clear error when claims is not an array', async () => {
    mockGeminiResponse(JSON.stringify({ claims: 'oops' }))
    await expect(extractClaims('some transcript', 'T1')).rejects.toThrow(
      'Claim extraction returned malformed data, please retry'
    )
  })
})
