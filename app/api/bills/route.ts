import { NextRequest, NextResponse } from 'next/server'
import { getBills, addBill } from '@/lib/sheets'
import { BillInput } from '@/lib/types'

export async function GET() {
  try {
    const bills = await getBills()
    return NextResponse.json(bills)
  } catch (error) {
    console.error('GET /api/bills error:', error)
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const body: BillInput = {
      name: raw.name,
      amount: raw.amount,
      dueDay: raw.dueDay || 1,
      dueMonth: Math.min(12, Math.max(1, Number(raw.dueMonth) || 1)),
      months: Math.max(1, Number(raw.months) || 1),
      account: raw.account || 'KBank',
      note: raw.note || '',
      type: raw.type === 'yearly' || raw.type === 'once' ? raw.type : 'monthly',
    }
    if (!body.name || !body.amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    await addBill(body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/bills error:', error)
    return NextResponse.json({ error: 'Failed to add bill' }, { status: 500 })
  }
}
