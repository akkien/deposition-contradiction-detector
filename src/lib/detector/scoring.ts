import * as chrono from 'chrono-node'
import natural from 'natural'
import { LlmType, NumericDeltaResult, ResolvedPair, ScoreResult } from '@/types/detector'

const stemmer = natural.PorterStemmer

type Pair = Pick<ResolvedPair, 'claim_1' | 'claim_2'>

export const UNIT_THRESHOLDS: Record<NumericDeltaResult['unit'], { small: number; medium: number }> = {
  time:       { small: 15,  medium: 60  },
  age:        { small: 1,   medium: 3   },
  distance:   { small: 0.5, medium: 5   },
  weight:     { small: 1,   medium: 5   },
  height:     { small: 1,   medium: 3   },
  money:      { small: 50,  medium: 500 },
  duration:   { small: 5,   medium: 30  },
  speed:      { small: 5,   medium: 20  },
  occurrence: { small: 1,   medium: 3   },
  percentage: { small: 2,   medium: 10  },
}

const UNIT_TYPE_MAP: Record<string, NumericDeltaResult['unit']> = {
  'years old': 'age', year: 'age', years: 'age',
  km: 'distance', kilometer: 'distance', kilometers: 'distance',
  mile: 'distance', miles: 'distance', meter: 'distance', meters: 'distance',
  kg: 'weight', kilogram: 'weight', kilograms: 'weight',
  lb: 'weight', lbs: 'weight', pound: 'weight', pounds: 'weight',
  cm: 'height', ft: 'height', feet: 'height', foot: 'height', inch: 'height', inches: 'height',
  dollar: 'money', dollars: 'money', '$': 'money', usd: 'money',
  minute: 'duration', minutes: 'duration', min: 'duration', mins: 'duration',
  hour: 'duration', hours: 'duration', hr: 'duration', hrs: 'duration',
  mph: 'speed', kmh: 'speed', 'km/h': 'speed', kph: 'speed',
  times: 'occurrence', time: 'occurrence', occasion: 'occurrence', occasions: 'occurrence',
  percent: 'percentage', '%': 'percentage',
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\b\d+(?:\.\d+)?\b/g)
  return matches ? matches.map(Number).filter((n) => !isNaN(n)) : []
}

function extractQuantity(text: string): { value: number; unitType: NumericDeltaResult['unit'] } | null {
  const numbers = extractNumbers(text)
  if (numbers.length === 0) return null

  const lower = text.toLowerCase()
  // longest match first to prefer "years old" over "years"
  const unitWords = Object.keys(UNIT_TYPE_MAP).sort((a, b) => b.length - a.length)
  for (const unitWord of unitWords) {
    if (lower.includes(unitWord)) {
      return { value: numbers[0], unitType: UNIT_TYPE_MAP[unitWord] }
    }
  }
  return null
}

export function calcLexicalOverlap(pair: Pair): number {
  const stem = (text: string) =>
    new Set(stemmer.tokenizeAndStem(text.toLowerCase()))

  const stems1 = stem(pair.claim_1.text)
  const stems2 = stem(pair.claim_2.text)
  if (stems1.size === 0 && stems2.size === 0) return 0
  const intersection = [...stems1].filter((s) => stems2.has(s))
  return intersection.length / Math.max(stems1.size, stems2.size, 1)
}

export function calcNumericDelta(pair: Pair): NumericDeltaResult | null {
  const t1 = chrono.parse(pair.claim_1.text)[0]
  const t2 = chrono.parse(pair.claim_2.text)[0]
  if (t1 && t2) {
    const minutes = Math.abs(t1.start.date().getTime() - t2.start.date().getTime()) / 60000
    return { unit: 'time', value: minutes }
  }

  const q1 = extractQuantity(pair.claim_1.text)
  const q2 = extractQuantity(pair.claim_2.text)
  if (q1 && q2 && q1.unitType === q2.unitType) {
    return { unit: q1.unitType, value: Math.abs(q1.value - q2.value) }
  }

  return null
}

const HEDGE_WORDS = ['think', 'maybe', 'might', 'perhaps', 'probably', 'i guess', 'not sure']
const STRONG_WORDS = ['never', 'always', 'definitely', 'certainly', 'all']

export function calcAssertionStrength(text: string): number {
  const lower = text.toLowerCase()
  const hedgeCount = HEDGE_WORDS.filter((w) => lower.includes(w)).length
  const strongCount = STRONG_WORDS.filter((w) => lower.includes(w)).length
  return Math.max(0, Math.min(1, 0.5 + strongCount * 0.25 - hedgeCount * 0.2))
}

const SCOPE_WORDS = ['all', 'every', 'never', 'always', 'only', 'none', 'nobody', 'everyone']

export function detectScopeQualifier(text: string): boolean {
  const lower = text.toLowerCase()
  return SCOPE_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower))
}

export function scoreContradiction(pair: ResolvedPair, llmType: LlmType): ScoreResult {
  const lexicalOverlap = calcLexicalOverlap(pair)
  const numericDelta = calcNumericDelta(pair)
  const assertionMin = Math.min(
    calcAssertionStrength(pair.claim_1.text),
    calcAssertionStrength(pair.claim_2.text)
  )
  const hasScopeWord =
    detectScopeQualifier(pair.claim_1.text) ||
    detectScopeQualifier(pair.claim_2.text)

  const breakdown = { lexicalOverlap, numericDelta, assertionMin, hasScopeWord }

  if (numericDelta !== null) {
    const thresholds = UNIT_THRESHOLDS[numericDelta.unit]
    if (numericDelta.value < thresholds.small) {
      return { type: 'false_positive', confidence: 0.9, breakdown }
    }
    if (numericDelta.value < thresholds.medium) {
      return { type: 'inferential', confidence: 0.7, breakdown }
    }
  }

  if (hasScopeWord) {
    return {
      type: 'direct',
      confidence: Math.max(0, Math.min(1, assertionMin * 0.9 + 0.1)),
      breakdown,
    }
  }

  return {
    type: llmType,
    confidence: Math.max(0, Math.min(1, assertionMin * 0.6 + lexicalOverlap * 0.4)),
    breakdown,
  }
}
