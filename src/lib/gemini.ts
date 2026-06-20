import 'dotenv/config'
import { GoogleGenAI } from '@google/genai'

let _gemini: GoogleGenAI | null = null

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('Missing GEMINI_API_KEY environment variable')
    _gemini = new GoogleGenAI({ apiKey: key })
  }
  return _gemini
}

export const AI_MODEL = 'gemini-2.5-flash'
