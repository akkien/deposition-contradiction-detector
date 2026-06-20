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
