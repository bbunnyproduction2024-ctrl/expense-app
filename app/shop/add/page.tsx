'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Product, ItemCategory, ItemUnit, PurchaseInput } from '@/lib/types'
import { format } from 'date-fns'

const UNITS: ItemUnit[] = ['g', 'ml', 'ชิ้น/อัน', 'กล่อง/ถุง/แพ็ค']

export default function ShopAddPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [isNew, setIsNew] = useState(false)

  // form fields
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState<ItemCategory>('วัตถุดิบ')
  const [unit, setUnit] = useState<ItemUnit>('g')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []))
  }, [])

  const suggestions = search.length >= 1
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : []

  const showAddNew = search.length >= 1 && !products.find(p => p.name.toLowerCase() === search.toLowerCase())

  function selectProduct(p: Product) {
    setSelected(p)
    setSearch(p.name)
    setCategory(p.category)
    setUnit(p.unit)
    setUnitPrice(String(p.lastPrice))
    setIsNew(false)
  }

  function startNewProduct() {
    setSelected(null)
    setIsNew(true)
    setCategory('วัตถุดิบ')
    setUnit('g')
    setUnitPrice('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qtyNum = parseFloat(qty)
    const priceNum = parseFloat(unitPrice)
    if (!search.trim() || !qtyNum || !priceNum) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const body: PurchaseInput = {
        date, productName: search.trim(), category, qty: qtyNum, unit, unitPrice: priceNum, note
      }
      const res = await fetch('/api/purchases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Failed')
      router.push('/shop')
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSubmitting(false)
    }
  }

  const total = (parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0)

  return (
    <div className="min-h-full bg-[#f7ede4]">
      <div className="bg-purple-700 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">บันทึกการซื้อ</h1>
        <p className="text-sm opacity-75 mt-1">ค้นหาสินค้าหรือเพิ่มใหม่</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Search */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">ค้นหาสินค้า</label>
          <input
            type="text"
            placeholder="เช่น นมเมจิ รสจืด..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null); setIsNew(false) }}
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent"
            autoComplete="off"
          />

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
              {suggestions.map(p => (
                <button key={p.id} type="button" onClick={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2">
                  <span>{p.category === 'วัตถุดิบ' ? '🧂' : '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">฿{p.lastPrice.toLocaleString()} / {p.unit} · {p.category}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Add new */}
          {showAddNew && (
            <button type="button" onClick={startNewProduct}
              className="mt-2 w-full text-left px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
              + เพิ่ม "{search}" เป็นสินค้าใหม่
            </button>
          )}
        </div>

        {/* Category & Unit — แสดงเมื่อเลือกหรือเพิ่มใหม่ */}
        {(selected || isNew) && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-2">ประเภท</label>
              <div className="flex gap-2">
                {(['วัตถุดิบ', 'อุปกรณ์'] as ItemCategory[]).map(c => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      category === c ? 'bg-purple-100 border-purple-400 text-purple-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {c === 'วัตถุดิบ' ? '🧂 วัตถุดิบ' : '🔧 อุปกรณ์'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-2">หน่วย</label>
              <div className="grid grid-cols-2 gap-2">
                {UNITS.map(u => (
                  <button key={u} type="button" onClick={() => setUnit(u)}
                    className={`py-2 rounded-xl text-sm border transition-all ${
                      unit === u ? 'bg-purple-100 border-purple-400 text-purple-700 font-semibold' : 'border-gray-200 text-gray-600'
                    }`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Qty & Price */}
        {(selected || isNew) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">จำนวน ({unit})</label>
              <input type="number" inputMode="decimal" placeholder="0" value={qty}
                onChange={e => setQty(e.target.value)} required
                className="w-full text-2xl font-bold text-gray-800 border-none outline-none bg-transparent" />
            </div>
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-sm text-gray-500 mb-1">ราคาต่อหน่วย (฿)</label>
              <input type="number" inputMode="decimal" placeholder="0.00" value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)} required
                className="w-full text-2xl font-bold text-gray-800 border-none outline-none bg-transparent" />
            </div>
            {total > 0 && (
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">ยอดรวม</span>
                <span className="text-xl font-bold text-purple-700">฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        )}

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent" />
        </div>

        {/* Note */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input type="text" placeholder="เพิ่มรายละเอียด..." value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent" />
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button type="submit" disabled={submitting || (!selected && !isNew)}
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-opacity bg-purple-600 ${
            submitting || (!selected && !isNew) ? 'opacity-40' : 'active:opacity-90'
          }`}>
          {submitting ? 'กำลังบันทึก...' : 'บันทึกการซื้อ'}
        </button>
      </form>
    </div>
  )
}
