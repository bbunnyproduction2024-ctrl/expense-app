import { NextResponse } from 'next/server'
import { getStores } from '@/lib/sheets'

export async function GET() {
  try {
    const stores = await getStores()
    return NextResponse.json(stores)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
