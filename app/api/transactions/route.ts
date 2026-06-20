import { NextRequest, NextResponse } from 'next/server'
import { addTransaction, ensureSheet, getTransactions } from '@/lib/sheets'
import { TransactionInput } from '@/lib/types'

export async function GET() {
  try {
    await ensureSheet()
    const transactions = await getTransactions()
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('GET /api/transactions error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TransactionInput = await request.json()

    if (!body.date || !body.type || !body.category || !body.amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await ensureSheet()
    await addTransaction(body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/transactions error:', error)
    return NextResponse.json({ error: 'Failed to add transaction' }, { status: 500 })
  }
}
