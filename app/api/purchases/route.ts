import { NextRequest, NextResponse } from 'next/server'
import { getPurchases, addPurchase } from '@/lib/sheets'

export async function GET() {
  try {
    const purchases = await getPurchases()
    return NextResponse.json(purchases)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.date || !body.productName || !body.qty || !body.unitPrice) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await addPurchase(body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
