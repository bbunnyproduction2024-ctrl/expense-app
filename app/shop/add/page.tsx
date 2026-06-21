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

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState<ItemCategory>('วัตถุดิบ')
  const [unit, setUnit] = useState<ItemUnit>('ชิ้น/อัน')
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
    if (p.lastPrice > 0) setUnitPrice(String(p.lastPrice))
    setIsNew(false)
  }

  function startNewProduct() {
    setSelected(null)
    setIsNew(true)
    setCategory('วัตถุดิบ')
    setUnit('ชิ้น/อัน')
    setUnitPrice('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qtyNum = parseInt(qty)
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

  const qtyNum = parseInt(qty) || 0
  const priceNum = parseFloat(unitPrice) || 0
  const total = qtyNum * priceNum
  const showForm = selected || isNew

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
            placeholder="เช่น นมเมจิ, น้ำตาล..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null); setIsNew(false) }}
            className="w-full text-lg font-medium text-gray-800 border-none outline-none bg-transparent"
            autoComplete="off"
          />

          {suggestions.length > 0 && (
            <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
              {suggestions.map(p => (
                <button key={p.id} type="button" onClick={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 active:bg-purple-50 flex items-center gap-3">
                  <span className="text-xl">{p.category === 'วัตถุดิบ' ? '🧂' : '🔧'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.category} · {p.unit}
                      {p.lastPrice > 0 ? ` · ราคาล่าสุด ฿${p.lastPrice.toLocaleString()}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showAddNew && (
            <button type="button" onClick={startNewProduct}
              className="mt-2 w-full text-left px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium">
              + เพิ่ม "{search}" เป็นสินค้าใหม่
            </button>
          )}
        </div>

        {showForm && (
          <>
            {/* ประเภท */}
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

            {/* หน่วยของสินค้า */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-0.5">หน่วยของสินค้า</label>
              <p className="text-xs text-gray-400 mb-3">บอกว่าสินค้านี้นับเป็นอะไร เช่น นม 5000g — ไม่เกี่ยวกับราคา</p>
              <div className="grid grid-cols-2 gap-2">
                {UNITS.map(u => (
                  <button key={u} type="button" onClick={() => setUnit(u)}
                    className={`py-2.5 rounded-xl text-sm border transition-all ${
                      unit === u ? 'bg-purple-100 border-purple-400 text-purple-700 font-semibold' : 'border-gray-200 text-gray-600'
                    }`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* จำนวนและราคา */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              {/* จำนวนชิ้น */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">ซื้อมากี่ชิ้น / กี่กล่อง?</label>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setQty(v => String(Math.max(1, (parseInt(v) || 0) - 1)))}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl font-light text-gray-600 flex items-center justify-center flex-shrink-0 active:bg-gray-200">
                    −
                  </button>
                  <input type="number" inputMode="numeric" step="1" min="1" placeholder="0" value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="flex-1 text-4xl font-bold text-gray-800 text-center border-none outline-none bg-transparent" />
                  <button type="button"
                    onClick={() => setQty(v => String((parseInt(v) || 0) + 1))}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl font-light text-gray-600 flex items-center justify-center flex-shrink-0 active:bg-gray-200">
                    +
                  </button>
                </div>
              </div>

              {/* ราคาต่อชิ้น */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm text-gray-500 mb-1">
                  ราคาต่อ 1 ชิ้น (฿)
                  {selected && selected.lastPrice > 0 && (
                    <span className="ml-2 text-purple-400 font-normal">ครั้งก่อน ฿{selected.lastPrice.toLocaleString()}</span>
                  )}
                </label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  className="w-full text-3xl font-bold text-gray-800 border-none outline-none bg-transparent" />
              </div>

              {/* ยอดรวม */}
              {total > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="bg-purple-50 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">{qtyNum} ชิ้น × ฿{priceNum.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 font-medium">ยอดรวม</p>
                    </div>
                    <span className="text-2xl font-bold text-purple-700">
                      ฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* วันที่ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent" />
        </div>

        {/* หมายเหตุ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input type="text" placeholder="เพิ่มรายละเอียด..." value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent" />
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button type="submit" disabled={submitting || !showForm}
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg bg-purple-600 transition-opacity ${
            submitting || !showForm ? 'opacity-40' : 'active:opacity-90'
          }`}>
          {submitting ? 'กำลังบันทึก...' : 'บันทึกการซื้อ'}
        </button>
      </form>
    </div>
  )
}
