'use client'

import { TranscriptData, TranscriptMeta } from '@/types/transcript'

interface Highlight {
  quote: string
  color: string
}

interface TranscriptPanelProps {
  label: string
  data: TranscriptData
  onMetaChange?: (meta: TranscriptMeta) => void
  onTextChange?: (text: string) => void
  readOnly?: boolean
  highlight?: Highlight | null
}

function HighlightedText({ text, quote, color }: { text: string; quote: string; color: string }) {
  const idx = quote ? text.indexOf(quote) : -1
  if (idx === -1) {
    return <>{text}</>
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: color + '33', borderRadius: 2 }}>
        {quote}
      </mark>
      {text.slice(idx + quote.length)}
    </>
  )
}

export default function TranscriptPanel({
  label,
  data,
  onMetaChange,
  onTextChange,
  readOnly = false,
  highlight = null,
}: TranscriptPanelProps) {
  const { meta, text } = data

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">{label}</h2>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-500 whitespace-nowrap">Date</label>
        {readOnly ? (
          <span className="text-sm text-gray-700">{meta.date || '—'}</span>
        ) : (
          <input
            type="date"
            value={meta.date}
            onChange={(e) => onMetaChange?.({ ...meta, date: e.target.value })}
            className="w-48 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        )}
      </div>

      {readOnly ? (
        <pre className="h-80 overflow-y-auto rounded-md border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed text-gray-800 whitespace-pre-wrap wrap-break-word">
          <HighlightedText
            text={text}
            quote={highlight?.quote ?? ''}
            color={highlight?.color ?? ''}
          />
        </pre>
      ) : (
        <textarea
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          placeholder="Paste transcript here..."
          className="h-80 resize-none rounded-md border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        />
      )}
    </div>
  )
}
