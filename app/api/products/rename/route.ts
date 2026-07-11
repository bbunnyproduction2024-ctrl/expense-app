import { NextRequest, NextResponse } from 'next/server'
import { renameProduct } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { oldName, newName } = await request.json()
    if (!oldName || !newName) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    await renameProduct(oldName.trim(), newName.trim())
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
