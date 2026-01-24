import { NextResponse } from 'next/server'
import { extractIdentity } from '../../../../lib/services/identityExtractor'
import { callGemini } from '../../../../lib/services/geminiService'

export async function POST(request){
  try{
    const body = await request.json()
    // body may contain sessionId and/or ocrResult
    const { ocr } = body
    if(!ocr) return NextResponse.json({ error: 'missing ocr payload' }, { status: 400 })

    // run identity extraction heuristics
    const extracted = await extractIdentity(ocr)

    // optionally call generative model to clean/validate (mocked)
    const ai = await callGemini(`Validate identity fields: ${JSON.stringify(extracted)}`)

    const result = { verified: true, details: extracted, ai }
    return NextResponse.json({ success: true, result })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
