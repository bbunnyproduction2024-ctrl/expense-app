import { NextRequest, NextResponse } from 'next/server'
import { deleteBill } from '@/lib/sheets'

export async function POST(request: NextRequest) {
  try {
    const { rowIndex } = await request.json()
    if (!rowIndex || typeof rowIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid rowIndex' }, { status: 400 })
    }
    await deleteBill(rowIndex)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/bills/delete error:', error)
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
