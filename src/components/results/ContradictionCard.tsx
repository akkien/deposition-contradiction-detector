'use client'

import { ScoredContradiction } from '@/types/detector'
import { TYPE_COLORS, SEVERITY_COLORS } from '@/lib/colors'

interface ContradictionCardProps {
  contradiction: ScoredContradiction
  isSelected: boolean
  date1: string
  date2: string
  onClick: () => void
}

const TYPE_LABELS: Record<ScoredContradiction['type'], string> = {
  direct:         'DIRECT',
  inferential:    'INFERENTIAL',
  false_positive: 'FALSE POSITIVE',
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ContradictionCard({
  contradiction,
  isSelected,
  date1,
  date2,
  onClick,
}: ContradictionCardProps) {
  const { topic, type, confidence, severity, claim1, claim2, explanation, breakdown } = contradiction
  const typeColor = TYPE_COLORS[type]
  const severityColor = SEVERITY_COLORS[severity]

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: typeColor }}
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="rounded px-2 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: typeColor }}
          >
            {TYPE_LABELS[type]}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold border"
            style={{ color: severityColor, borderColor: severityColor }}
          >
            {severity}
          </span>
          <span className="text-xs text-gray-500 capitalize">{topic.replace(/_/g, ' ')}</span>
          <span className="ml-auto text-xs text-gray-400">
            {Math.round(confidence * 100)}% confidence
          </span>
        </div>

        {/* Claims */}
        <div className="space-y-1.5 text-sm">
          <p className="text-gray-700">
            <span className="font-semibold text-gray-500">{date1 || 'Transcript 1'}:</span>{' '}
            &ldquo;{claim1}&rdquo;
          </p>
          <p className="text-gray-700">
            <span className="font-semibold text-gray-500">{date2 || 'Transcript 2'}:</span>{' '}
            &ldquo;{claim2}&rdquo;
          </p>
        </div>

        {/* Explanation — always visible */}
        <p className="mt-2.5 text-sm text-gray-500 italic">{explanation}</p>

        {/* Expand toggle hint */}
        <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
          <ChevronIcon open={isSelected} />
          <span>{isSelected ? 'Hide' : 'Show'} score breakdown</span>
        </div>
      </div>

      {/* Expanded section — score breakdown */}
      {isSelected && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Score Breakdown</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <span>Lexical overlap</span>
            <span>{Math.round(breakdown.lexicalOverlap * 100)}%</span>
            <span>Assertion strength</span>
            <span>{Math.round(breakdown.assertionMin * 100)}%</span>
            <span>Scope qualifier</span>
            <span>{breakdown.hasScopeWord ? 'Yes' : 'No'}</span>
            {breakdown.numericDelta && (
              <>
                <span>Numeric delta</span>
                <span>{breakdown.numericDelta.value.toFixed(1)} {breakdown.numericDelta.unit}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
