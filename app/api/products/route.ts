import { NextRequest, NextResponse } from 'next/server'
import { getProducts, upsertProduct } from '@/lib/sheets'

export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json(products)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    await upsertProduct(body)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
