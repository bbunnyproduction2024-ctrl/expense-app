import { NextRequest, NextResponse } from 'next/server'
import { deleteShopPurchaseTxn } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex } = await request.json()
    if (!rowIndex || typeof rowIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })
    }
    await deleteShopPurchaseTxn(rowIndex)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE purchase (one) error:', error)
    return NextResponse.json({ error: 'Failed to delete purchase' }, { status: 500 })
  }
}
