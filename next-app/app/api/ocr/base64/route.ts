import { NextResponse } from 'next/server'
import { processBase64 } from '../../../../lib/services/ocrService'

export async function POST(request){
  try{
    const { imageBase64 } = await request.json()
    if(!imageBase64) return NextResponse.json({ error: 'missing imageBase64' }, { status: 400 })
    const ocrResult = await processBase64(imageBase64)
    return NextResponse.json({ success: true, ocr: ocrResult })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
