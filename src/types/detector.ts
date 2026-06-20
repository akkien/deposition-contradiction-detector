export interface Claim {
  id: string;
  topic: string;
  text: string;
  raw_quote: string;
}

export type LlmType = 'direct' | 'inferential' | 'false_positive'

export interface CandidatePair {
  topic: string;
  claim_1_id: string;
  claim_2_id: string;
  llmType: LlmType;
  llm_explanation: string;
}

export interface ResolvedPair {
  topic: string;
  claim_1: Claim;
  claim_2: Claim;
  llmType: LlmType;
  llm_explanation: string;
}

export interface NumericDeltaResult {
  unit: 'time' | 'age' | 'distance' | 'weight' | 'height' | 'money' | 'duration' | 'speed' | 'occurrence' | 'percentage';
  value: number;
}

export interface ScoreResult {
  type: LlmType;
  confidence: number;
  breakdown: {
    lexicalOverlap: number;
    numericDelta: NumericDeltaResult | null;
    assertionMin: number;
    hasScopeWord: boolean;
  };
}
