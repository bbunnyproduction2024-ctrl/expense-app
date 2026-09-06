import { NextRequest, NextResponse } from 'next/server'
import { updateBill } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex, name, amount, dueDay, dueMonth, account, note, type, done } = await request.json()
    if (!rowIndex || typeof rowIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })
    }
    await updateBill(rowIndex, { name, amount, dueDay, dueMonth, account, note, type, done })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/bills/update error:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}
