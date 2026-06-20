'use client'

import { useState } from 'react'
import { TranscriptData } from '@/types/transcript'
import { ScoredContradiction } from '@/types/detector'
import { TYPE_COLORS } from '@/lib/colors'
import TranscriptPanel from './TranscriptPanel'
import ContradictionList from '@/components/results/ContradictionList'

const emptyTranscript = (): TranscriptData => ({
  meta: { date: '' },
  text: '',
})

export default function TranscriptInputPage() {
  const [witnessName, setWitnessName] = useState('')
  const [transcript1, setTranscript1] = useState<TranscriptData>(emptyTranscript())
  const [transcript2, setTranscript2] = useState<TranscriptData>(emptyTranscript())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ScoredContradiction[] | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [transcriptsReadOnly, setTranscriptsReadOnly] = useState(false)

  const canAnalyze = transcript1.text.trim().length > 0 && transcript2.text.trim().length > 0
  const selected = transcriptsReadOnly && selectedIdx !== null && results ? results[selectedIdx] : null

  async function handleAnalyze() {
    if (!canAnalyze || loading) return
    setLoading(true)
    setError(null)
    setResults(null)
    setSelectedIdx(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ witnessName, transcript1, transcript2 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Analysis failed. Please try again.')
      } else {
        setResults(data.contradictions)
        setTranscriptsReadOnly(true)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleEdit() {
    setTranscriptsReadOnly(false)
    setSelectedIdx(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Deposition Contradiction Detector
          </h1>
        </header>

        <div className="mb-5 flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-500 whitespace-nowrap">Witness Name</label>
          <input
            type="text"
            value={witnessName}
            onChange={(e) => setWitnessName(e.target.value)}
            disabled={transcriptsReadOnly}
            placeholder="e.g. Marcus Webb"
            className="w-72 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TranscriptPanel
            label="Transcript 1"
            data={transcript1}
            onMetaChange={(meta) => setTranscript1((prev) => ({ ...prev, meta }))}
            onTextChange={(text) => setTranscript1((prev) => ({ ...prev, text }))}
            readOnly={transcriptsReadOnly}
            highlight={selected ? { quote: selected.claim1, color: TYPE_COLORS[selected.type] } : null}
          />
          <TranscriptPanel
            label="Transcript 2"
            data={transcript2}
            onMetaChange={(meta) => setTranscript2((prev) => ({ ...prev, meta }))}
            onTextChange={(text) => setTranscript2((prev) => ({ ...prev, text }))}
            readOnly={transcriptsReadOnly}
            highlight={selected ? { quote: selected.claim2, color: TYPE_COLORS[selected.type] } : null}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {transcriptsReadOnly ? (
            <button
              onClick={handleEdit}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              ← Edit Transcripts
            </button>
          ) : (
            <>
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze || loading}
                className="rounded-md bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Analyzing…' : 'Find Contradictions'}
              </button>
              {!canAnalyze && !loading && (
                <p className="text-xs text-gray-400">Both transcripts must have text to analyze.</p>
              )}
            </>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        {results !== null && (
          <ContradictionList
            contradictions={results}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            date1={transcript1.meta.date || 'Transcript 1'}
            date2={transcript2.meta.date || 'Transcript 2'}
          />
        )}
      </div>
    </div>
  )
}
