import { NextRequest, NextResponse } from 'next/server'
import { deleteTransaction } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex } = await request.json()
    if (!rowIndex || typeof rowIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })
    }
    await deleteTransaction(rowIndex)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE transaction error:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
