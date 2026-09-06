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
    const body: BillInput = await request.json()
    if (!body.name || !body.amount || !body.dueDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    await addBill(body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/bills error:', error)
    return NextResponse.json({ error: 'Failed to add bill' }, { status: 500 })
  }
}
