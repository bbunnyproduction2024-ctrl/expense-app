import { NextRequest, NextResponse } from 'next/server'
import { setBillDone } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex, done } = await request.json()
    if (!rowIndex || typeof rowIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })
    }
    await setBillDone(rowIndex, !!done)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/bills/done error:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}
