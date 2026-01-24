import { NextResponse } from 'next/server'
import { getSession } from '../../../../../lib/sessionStore'

export async function GET(request, { params }){
  try{
    const { id } = params
    const s = getSession(id)
    if(!s) return NextResponse.json({ error: 'session not found' }, { status: 404 })
    return NextResponse.json({ success: true, session: s })
  }catch(err){
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
