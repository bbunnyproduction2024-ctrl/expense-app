import { NextRequest, NextResponse } from 'next/server'
import { addTransfer, ensureSheet } from '@/lib/sheets'
import { TransferInput } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body: TransferInput = await request.json()

    if (!body.date || !body.from || !body.to || !body.amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (body.from === body.to) {
      return NextResponse.json({ error: 'บัญชีต้นทางและปลายทางต้องต่างกัน' }, { status: 400 })
    }
    if (body.amount <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 })
    }

    await ensureSheet()
    await addTransfer(body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/transfers error:', error)
    return NextResponse.json({ error: 'Failed to add transfer' }, { status: 500 })
  }
}
