'use client'

import { useState } from 'react'
import { LlmType, ScoredContradiction, Severity } from '@/types/detector'
import { TYPE_COLORS, SEVERITY_COLORS } from '@/lib/colors'
import ContradictionCard from './ContradictionCard'

interface ContradictionListProps {
  contradictions: ScoredContradiction[]
  selectedIdx: number | null
  onSelect: (idx: number | null) => void
  date1: string
  date2: string
}

type FilterType = LlmType | 'all'
type FilterSeverity = Severity | 'all'
type SortBy = 'confidence' | 'topic'

const TYPE_FILTER_LABELS: { value: FilterType; label: string }[] = [
  { value: 'all',           label: 'All' },
  { value: 'direct',        label: 'Direct' },
  { value: 'inferential',   label: 'Inferential' },
  { value: 'false_positive', label: 'False Positive' },
]

const SEVERITY_FILTER_LABELS: { value: FilterSeverity; label: string }[] = [
  { value: 'all',    label: 'All' },
  { value: 'HIGH',   label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW',    label: 'Low' },
]

export default function ContradictionList({
  contradictions,
  selectedIdx,
  onSelect,
  date1,
  date2,
}: ContradictionListProps) {
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all')
  const [sortBy, setSortBy] = useState<SortBy>('confidence')

  const filtered = contradictions
    .map((c, i) => ({ contradiction: c, originalIdx: i }))
    .filter(({ contradiction: c }) => {
      if (filterType !== 'all' && c.type !== filterType) return false
      if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'confidence') return b.contradiction.confidence - a.contradiction.confidence
      return a.contradiction.topic.localeCompare(b.contradiction.topic)
    })

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {contradictions.length === 0
            ? 'No contradictions found'
            : `Results (${contradictions.length} found${filtered.length !== contradictions.length ? `, ${filtered.length} shown` : ''})`}
        </h2>
        {contradictions.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span>Sort:</span>
            <button
              onClick={() => setSortBy('confidence')}
              className={`px-2 py-0.5 rounded ${sortBy === 'confidence' ? 'bg-gray-200 text-gray-700' : 'hover:text-gray-600'}`}
            >
              Confidence
            </button>
            <button
              onClick={() => setSortBy('topic')}
              className={`px-2 py-0.5 rounded ${sortBy === 'topic' ? 'bg-gray-200 text-gray-700' : 'hover:text-gray-600'}`}
            >
              Topic
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {contradictions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">Type:</span>
            {TYPE_FILTER_LABELS.map(({ value, label }) => {
              const active = filterType === value
              const color = value !== 'all' ? TYPE_COLORS[value as LlmType] : undefined
              return (
                <button
                  key={value}
                  onClick={() => setFilterType(value)}
                  className="rounded px-2 py-0.5 text-xs font-medium border transition-colors"
                  style={
                    active && color
                      ? { backgroundColor: color, borderColor: color, color: '#fff' }
                      : active
                      ? { backgroundColor: '#e5e7eb', borderColor: '#e5e7eb', color: '#374151' }
                      : { borderColor: '#d1d5db', color: '#6b7280' }
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">Severity:</span>
            {SEVERITY_FILTER_LABELS.map(({ value, label }) => {
              const active = filterSeverity === value
              const color = value !== 'all' ? SEVERITY_COLORS[value as Severity] : undefined
              return (
                <button
                  key={value}
                  onClick={() => setFilterSeverity(value)}
                  className="rounded px-2 py-0.5 text-xs font-medium border transition-colors"
                  style={
                    active && color
                      ? { backgroundColor: color, borderColor: color, color: '#fff' }
                      : active
                      ? { backgroundColor: '#e5e7eb', borderColor: '#e5e7eb', color: '#374151' }
                      : { borderColor: '#d1d5db', color: '#6b7280' }
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(({ contradiction, originalIdx }) => (
          <ContradictionCard
            key={originalIdx}
            contradiction={contradiction}
            isSelected={selectedIdx === originalIdx}
            date1={date1}
            date2={date2}
            onClick={() => onSelect(selectedIdx === originalIdx ? null : originalIdx)}
          />
        ))}
        {filtered.length === 0 && contradictions.length > 0 && (
          <p className="text-sm text-gray-400">No contradictions match the current filters.</p>
        )}
      </div>
    </div>
  )
}
