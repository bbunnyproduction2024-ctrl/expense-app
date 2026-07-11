import { NextRequest, NextResponse } from 'next/server'
import { updateTransaction } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex, newDate, newAmount, newCategory, newNote, newPaymentMethod } = await request.json()
    if (!rowIndex) return NextResponse.json({ error: 'Missing rowIndex' }, { status: 400 })
    await updateTransaction(rowIndex, {
      date: newDate,
      amount: newAmount !== undefined ? Number(newAmount) : undefined,
      category: newCategory,
      note: newNote,
      paymentMethod: newPaymentMethod,
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
