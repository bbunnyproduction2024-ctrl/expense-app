import { NextRequest, NextResponse } from 'next/server'
import { deletePurchase } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json()
    await deletePurchase(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
