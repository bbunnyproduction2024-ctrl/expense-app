import { NextRequest, NextResponse } from 'next/server'
import { setBillPaid } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex, cycle, paid, amount, account, mode, date } = await request.json()
    if (!rowIndex || typeof rowIndex !== 'number' || !/^\d{4}-\d{2}$/.test(cycle ?? '')) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const validMode = mode === 'transfer' || mode === 'none' ? mode : 'expense'
    await setBillPaid(rowIndex, cycle, !!paid, amount, account, validMode, date)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/bills/paid error:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}
