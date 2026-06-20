import { NextRequest, NextResponse } from 'next/server'
import { TranscriptData } from '@/types/transcript'
import { runPipeline } from '@/lib/detector/pipeline'

export async function POST(req: NextRequest) {
  let transcript1: TranscriptData
  let transcript2: TranscriptData

  try {
    const body = await req.json()
    transcript1 = body.transcript1
    transcript2 = body.transcript2
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!transcript1?.text?.trim() || !transcript2?.text?.trim()) {
    return NextResponse.json({ error: 'Both transcripts must have text' }, { status: 400 })
  }

  try {
    const contradictions = await runPipeline(transcript1, transcript2)
    return NextResponse.json({ contradictions })
  } catch (err) {
    const errStr = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('[/api/analyze] pipeline error:', errStr)

    if (errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota')) {
      return NextResponse.json(
        { error: 'Gemini API quota exceeded. Please wait a few minutes and try again, or upgrade your API plan.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    )
  }
}
