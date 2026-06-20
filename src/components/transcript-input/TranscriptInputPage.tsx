'use client'

import { useState } from 'react'
import { TranscriptData } from '@/types/transcript'
import TranscriptPanel from './TranscriptPanel'

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

  const canAnalyze =
    transcript1.text.trim().length > 0 && transcript2.text.trim().length > 0

  function handleAnalyze() {
    if (!canAnalyze || loading) return
    setLoading(true)
    setError(null)
    // TODO: call /api/analyze
    console.log('Analyzing...', { witnessName, transcript1, transcript2 })
    setTimeout(() => setLoading(false), 1500)
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
            placeholder="e.g. Marcus Webb"
            className="w-72 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TranscriptPanel
            label="Transcript 1"
            data={transcript1}
            onMetaChange={(meta) => setTranscript1((prev) => ({ ...prev, meta }))}
            onTextChange={(text) => setTranscript1((prev) => ({ ...prev, text }))}
          />
          <TranscriptPanel
            label="Transcript 2"
            data={transcript2}
            onMetaChange={(meta) => setTranscript2((prev) => ({ ...prev, meta }))}
            onTextChange={(text) => setTranscript2((prev) => ({ ...prev, text }))}
          />
        </div>

        <div className="mt-6 flex flex-col items-start gap-3">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || loading}
            className="rounded-md bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Analyzing...' : 'Find Contradictions'}
          </button>

          {!canAnalyze && !loading && (
            <p className="text-xs text-gray-400">
              Both transcripts must have text to analyze.
            </p>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
