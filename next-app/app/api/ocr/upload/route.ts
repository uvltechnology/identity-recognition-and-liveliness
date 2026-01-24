import { NextResponse } from 'next/server'
import { processBuffer } from '../../../../lib/services/ocrService'

export const dynamic = 'force-dynamic'

export async function POST(request){
  try{
    const form = await request.formData()
    const file = form.get('file')
    const sessionId = form.get('sessionId')?.toString()

    if(!file) return NextResponse.json({ error: 'missing file' }, { status: 400 })

    // file is a Blob in the Web Fetch API
    // Convert to Buffer for server-side OCR libs
    // @ts-ignore
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Call OCR service with the buffer
    const ocrResult = await processBuffer(buffer)

    return NextResponse.json({ success: true, sessionId: sessionId || null, ocr: ocrResult })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
