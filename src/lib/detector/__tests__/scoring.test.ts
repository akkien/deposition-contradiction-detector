import { describe, it, expect } from 'vitest'
import {
  calcLexicalOverlap,
  calcNumericDelta,
  calcAssertionStrength,
  detectScopeQualifier,
  scoreContradiction,
  UNIT_THRESHOLDS,
} from '../scoring'
import { ResolvedPair } from '@/types/detector'

function makePair(text1: string, text2: string): ResolvedPair {
  return {
    topic: 'test',
    claim_1: { id: 'T1_C1', topic: 'test', text: text1, raw_quote: text1 },
    claim_2: { id: 'T2_C1', topic: 'test', text: text2, raw_quote: text2 },
    llmType: 'direct',
    llm_explanation: '',
  }
}

// ─── calcLexicalOverlap ────────────────────────────────────────────────────

describe('calcLexicalOverlap', () => {
  it('returns 1 for identical texts', () => {
    const pair = makePair('I was at home all evening', 'I was at home all evening')
    expect(calcLexicalOverlap(pair)).toBeCloseTo(1)
  })

  it('returns 0 for completely different texts', () => {
    const pair = makePair('apple banana cherry', 'dog elephant fox')
    expect(calcLexicalOverlap(pair)).toBe(0)
  })

  it('handles stemming (drive/drove/driving count as same)', () => {
    const pair = makePair('I was driving to the store', 'I drove to the store')
    const overlap = calcLexicalOverlap(pair)
    expect(overlap).toBeGreaterThan(0.4)
  })

  it('returns 0 for empty strings', () => {
    const pair = makePair('', '')
    expect(calcLexicalOverlap(pair)).toBe(0)
  })

  it('returns partial overlap for partially matching texts', () => {
    const pair = makePair('The car was parked outside the store', 'A car was parked near the building')
    const overlap = calcLexicalOverlap(pair)
    expect(overlap).toBeGreaterThan(0)
    expect(overlap).toBeLessThan(1)
  })
})

// ─── calcNumericDelta ──────────────────────────────────────────────────────

describe('calcNumericDelta', () => {
  it('returns null when no numeric values present', () => {
    const pair = makePair('I was at home', 'I was out briefly')
    expect(calcNumericDelta(pair)).toBeNull()
  })

  it('returns null when only one claim has a numeric value', () => {
    const pair = makePair('I was 30 years old', 'I was a young adult')
    expect(calcNumericDelta(pair)).toBeNull()
  })

  it('detects time expressions (chrono) and returns unit=time in minutes', () => {
    const pair = makePair('I left around 7pm', 'I left around 8pm')
    const result = calcNumericDelta(pair)
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('time')
    expect(result!.value).toBeCloseTo(60, 0)
  })

  it('detects age expressions (compromise) and returns unit=age', () => {
    const pair = makePair('I was 30 years old at the time', 'I was 22 years old at the time')
    const result = calcNumericDelta(pair)
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('age')
    expect(result!.value).toBe(8)
  })

  it('detects distance expressions and returns unit=distance', () => {
    const pair = makePair('The store was 1 km away', 'The store was 10 km away')
    const result = calcNumericDelta(pair)
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('distance')
    expect(result!.value).toBe(9)
  })

  it('detects weight expressions and returns unit=weight', () => {
    const pair = makePair('I weighed 70 kg', 'I weighed 80 kg')
    const result = calcNumericDelta(pair)
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('weight')
    expect(result!.value).toBe(10)
  })

  it('returns null when unit types differ between claims', () => {
    const pair = makePair('I was 30 years old', 'It was 10 km away')
    expect(calcNumericDelta(pair)).toBeNull()
  })
})

// ─── calcAssertionStrength ─────────────────────────────────────────────────

describe('calcAssertionStrength', () => {
  it('returns 0.5 baseline for neutral text', () => {
    expect(calcAssertionStrength('I was at the store')).toBeCloseTo(0.5)
  })

  it('lowers score with hedge words', () => {
    expect(calcAssertionStrength('I think I maybe went out')).toBeLessThan(0.5)
  })

  it('raises score with strong words', () => {
    expect(calcAssertionStrength('I definitely never went there')).toBeGreaterThan(0.5)
  })

  it('clamps to 0 minimum', () => {
    expect(calcAssertionStrength('maybe perhaps probably i guess might think')).toBeGreaterThanOrEqual(0)
  })

  it('clamps to 1 maximum', () => {
    expect(calcAssertionStrength('always definitely certainly never all')).toBeLessThanOrEqual(1)
  })
})

// ─── detectScopeQualifier ─────────────────────────────────────────────────

describe('detectScopeQualifier', () => {
  it('detects "never"', () => {
    expect(detectScopeQualifier('I never went there')).toBe(true)
  })

  it('detects "all"', () => {
    expect(detectScopeQualifier('I was home all evening')).toBe(true)
  })

  it('detects "always"', () => {
    expect(detectScopeQualifier('I always told the truth')).toBe(true)
  })

  it('detects "only"', () => {
    expect(detectScopeQualifier('I only saw him once')).toBe(true)
  })

  it('detects "none"', () => {
    expect(detectScopeQualifier('None of them were there')).toBe(true)
  })

  it('returns false for plain statements', () => {
    expect(detectScopeQualifier('I went to the store yesterday')).toBe(false)
  })

  it('is word-boundary matched (does not match "finally" for "all")', () => {
    expect(detectScopeQualifier('I finally arrived')).toBe(false)
  })
})

// ─── scoreContradiction ───────────────────────────────────────────────────

describe('scoreContradiction', () => {
  it('returns false_positive with confidence 0.9 when numeric delta < small threshold', () => {
    // 5-minute gap is below time.small=15
    const pair = makePair('I left around 7:00pm', 'I left around 7:05pm')
    const result = scoreContradiction(pair, 'direct')
    expect(result.type).toBe('false_positive')
    expect(result.confidence).toBeCloseTo(0.9)
    expect(result.breakdown.numericDelta).not.toBeNull()
    expect(result.breakdown.numericDelta!.unit).toBe('time')
  })

  it('returns inferential with confidence 0.7 when numeric delta is between small and medium', () => {
    // 30-minute gap is between time.small=15 and time.medium=60
    const pair = makePair('I arrived around 7:00pm', 'I arrived around 7:30pm')
    const result = scoreContradiction(pair, 'direct')
    expect(result.type).toBe('inferential')
    expect(result.confidence).toBeCloseTo(0.7)
  })

  it('falls through to scope check when no numeric delta and scope word present', () => {
    const pair = makePair('I never went to that location', 'I went there occasionally')
    const result = scoreContradiction(pair, 'inferential')
    expect(result.type).toBe('direct')
    expect(result.breakdown.hasScopeWord).toBe(true)
  })

  it('returns direct via scope path regardless of llmType hint', () => {
    const pair = makePair('I never met that man', 'I met that man at the conference')
    const result = scoreContradiction(pair, 'false_positive')
    expect(result.type).toBe('direct')
    expect(result.breakdown.hasScopeWord).toBe(true)
  })

  it('falls back to llmType when no numeric delta and no scope word', () => {
    const pair = makePair('I think I went to the store', 'I might have been at the mall')
    const result = scoreContradiction(pair, 'inferential')
    expect(result.type).toBe('inferential')
    expect(result.breakdown.hasScopeWord).toBe(false)
    expect(result.breakdown.numericDelta).toBeNull()
  })

  it('confidence is always within 0–1', () => {
    const pairs = [
      makePair('I was 30 years old', 'I was 22 years old'),
      makePair('I never left the house', 'I went out briefly'),
      makePair('I think maybe I went', 'I might have possibly gone'),
    ]
    for (const pair of pairs) {
      const result = scoreContradiction(pair, 'direct')
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('includes full breakdown in result', () => {
    const pair = makePair('I was at home', 'I went out briefly')
    const result = scoreContradiction(pair, 'direct')
    expect(result.breakdown).toHaveProperty('lexicalOverlap')
    expect(result.breakdown).toHaveProperty('numericDelta')
    expect(result.breakdown).toHaveProperty('assertionMin')
    expect(result.breakdown).toHaveProperty('hasScopeWord')
  })

  it('UNIT_THRESHOLDS is exported and covers all unit types', () => {
    const units: Array<keyof typeof UNIT_THRESHOLDS> = [
      'time', 'age', 'distance', 'weight', 'height',
      'money', 'duration', 'speed', 'occurrence', 'percentage',
    ]
    for (const unit of units) {
      expect(UNIT_THRESHOLDS[unit]).toHaveProperty('small')
      expect(UNIT_THRESHOLDS[unit]).toHaveProperty('medium')
    }
  })
})
