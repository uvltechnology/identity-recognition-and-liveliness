import { NextResponse } from 'next/server'

export async function POST(request){
  try{
    const body = await request.json()
    // TODO: validate body, create session, sign short-lived token
    const sessionId = 'session_' + Date.now()
    const iframeUrl = `/identity/embed?session=${sessionId}`
    return NextResponse.json({ sessionId, iframeUrl })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
