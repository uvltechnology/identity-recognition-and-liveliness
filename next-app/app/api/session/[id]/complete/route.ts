import { NextResponse } from 'next/server'
import { updateSession, getSession } from '../../../../../lib/sessionStore'

export async function POST(request, { params }){
  try{
    const { id } = params
    const body = await request.json()
    const s = getSession(id)
    if(!s) return NextResponse.json({ error: 'session not found' }, { status: 404 })

    // Accept updates such as { status: 'completed', result: {...} }
    const updated = updateSession(id, body)
    return NextResponse.json({ success: true, session: updated })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
