import { LlmType, Severity } from '@/types/detector'

export const TYPE_COLORS: Record<LlmType, string> = {
  direct:         '#ef4444',
  inferential:    '#f59e0b',
  false_positive: '#9ca3af',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  HIGH:   '#1b5e20',
  MEDIUM: '#2e7d32',
  LOW:    '#4caf50',
}
