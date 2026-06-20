'use client'

import { TranscriptData, TranscriptMeta } from '@/types/transcript'

interface TranscriptPanelProps {
  label: string;
  data: TranscriptData;
  onMetaChange: (meta: TranscriptMeta) => void;
  onTextChange: (text: string) => void;
}

export default function TranscriptPanel({
  label,
  data,
  onMetaChange,
  onTextChange,
}: TranscriptPanelProps) {
  const { meta, text } = data

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">{label}</h2>

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-500 whitespace-nowrap">Date</label>
        <input
          type="date"
          value={meta.date}
          onChange={(e) => onMetaChange({ ...meta, date: e.target.value })}
          className="w-48 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Paste transcript here..."
        className="h-80 resize-none rounded-md border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
      />
    </div>
  )
}
