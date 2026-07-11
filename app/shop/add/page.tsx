'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Product, ItemCategory, PaymentMethod, PurchaseInput } from '@/lib/types'
import { format } from 'date-fns'

const UNIT_TYPES = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'ชิ้น/อัน', label: 'ชิ้น/อัน' },
  { value: 'กล่อง/ถุง/แพ็ค', label: 'กล่อง' },
  { value: 'cm.', label: 'cm.' },
  { value: 'inch.', label: 'inch.' },
  { value: 'อื่นๆ', label: 'อื่นๆ' },
]

const ITEM_CATEGORIES: ItemCategory[] = [
  'วัตถุดิบ ร้าน Hop & Sip',
  'อุปกรณ์ร้าน Hop & Sip',
  'อุปกรณ์ เครื่องใช้',
  'อาหาร/เครื่องดื่ม',
  'ค่าสัตว์เลี้ยง',
  'อื่นๆ (รายจ่าย)',
]

const CATEGORY_ICONS: Record<ItemCategory, string> = {
  'วัตถุดิบ ร้าน Hop & Sip': '🧂',
  'อุปกรณ์ร้าน Hop & Sip': '🛠️',
  'อุปกรณ์ เครื่องใช้': '🔧',
  'อาหาร/เครื่องดื่ม': '🍽️',
  'ค่าสัตว์เลี้ยง': '🐾',
  'อื่นๆ (รายจ่าย)': '📦',
}

export default function ShopAddPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [isNew, setIsNew] = useState(false)

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState<ItemCategory>('วัตถุดิบ ร้าน Hop & Sip')
  const [unitSize, setUnitSize] = useState('')
  const [unitType, setUnitType] = useState('')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('KBank')
  const [store, setStore] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [savedStores, setSavedStores] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []))
    fetch('/api/stores').then(r => r.json()).then(d => { if (Array.isArray(d)) setSavedStores(d) })
  }, [])

  const unitValue = unitSize ? `${unitSize}${unitType}` : unitType

  function parseStoredUnit(unit: string) {
    const match = unit.match(/^(\d+\.?\d*)(.+)$/)
    if (match) return { size: match[1], type: match[2] }
    return { size: '', type: unit }
  }

  const suggestions = search.length >= 1
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : []

  const showAddNew = search.length >= 1 && !products.find(p => p.name.toLowerCase() === search.toLowerCase())

  function selectProduct(p: Product) {
    setSelected(p)
    setSearch(p.name)
    setCategory(p.category as ItemCategory)
    const parsed = parseStoredUnit(p.unit)
    setUnitSize(parsed.size)
    setUnitType(UNIT_TYPES.find(u => u.value === parsed.type) ? parsed.type : '')
    if (p.lastPrice > 0) setUnitPrice(String(p.lastPrice))
    setIsNew(false)
  }

  function startNewProduct() {
    setSelected(null)
    setIsNew(true)
    setCategory('วัตถุดิบ ร้าน Hop & Sip')
    setUnitSize('')
    setUnitType('')
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
        date, productName: search.trim(), category, qty: qtyNum, unit: unitValue, unitPrice: priceNum, paymentMethod, store, note
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
      <div className="text-gray-800 px-4 pt-12 pb-6" style={{background: '#96CFCF'}}>
        <h1 className="text-2xl font-bold">บันทึกการซื้อ</h1>
        <p className="text-sm opacity-70 mt-1">ค้นหาสินค้าหรือเพิ่มใหม่</p>
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
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 active:bg-teal-50 flex items-center gap-3">
                  <span className="text-xl">{CATEGORY_ICONS[p.category as ItemCategory] ?? '📦'}</span>
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
              className="mt-2 w-full text-left px-3 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-medium">
              + เพิ่ม "{search}" เป็นสินค้าใหม่
            </button>
          )}
        </div>

        {/* สินค้าที่เลือก — แสดงข้อมูลอย่างเดียว แก้ได้แค่ราคา */}
        {selected && (
          <>
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
              <p className="text-xs text-teal-400 mb-1">ข้อมูลสินค้า</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{CATEGORY_ICONS[selected.category as ItemCategory] ?? '📦'}</span>
                <div>
                  <p className="font-bold text-gray-800">{selected.name}</p>
                  <p className="text-sm text-gray-500">{selected.category} · หน่วย {selected.unit}</p>
                </div>
              </div>
            </div>

            {/* ช่องทางชำระเงิน */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-2">ช่องทางชำระเงิน</label>
              <div className="flex gap-2">
                {(['KBank', 'เงินสด'] as PaymentMethod[]).map(m => (
                  <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      paymentMethod === m ? 'bg-sky-100 border-sky-400 text-sky-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {m === 'เงินสด' ? '💵 เงินสด' : '🏦 KBank'}
                  </button>
                ))}
              </div>
            </div>

            {/* จำนวนและราคา */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">จำนวน</label>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setQty(v => String(Math.max(1, (parseInt(v) || 0) - 1)))}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl text-gray-600 flex items-center justify-center flex-shrink-0 active:bg-gray-200">
                    −
                  </button>
                  <input type="number" inputMode="numeric" step="1" min="1" placeholder="0" value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="flex-1 min-w-0 text-4xl font-bold text-gray-800 text-center border-none outline-none bg-transparent" />
                  <button type="button"
                    onClick={() => setQty(v => String((parseInt(v) || 0) + 1))}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl text-gray-600 flex items-center justify-center flex-shrink-0 active:bg-gray-200">
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm text-gray-500 mb-1">
                  ราคาต่อ 1 ชิ้น (฿)
                  {selected.lastPrice > 0 && (
                    <span className="ml-2 text-teal-400 font-normal">ครั้งก่อน ฿{selected.lastPrice.toLocaleString()}</span>
                  )}
                </label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  className="w-full text-3xl font-bold text-gray-800 border-none outline-none bg-transparent" />
              </div>

              {total > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="bg-teal-50 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">{qtyNum} ชิ้น × ฿{priceNum.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 font-medium">ยอดรวม</p>
                    </div>
                    <span className="text-2xl font-bold text-teal-700">
                      ฿{total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* สินค้าใหม่ — แสดงฟอร์มเต็ม */}
        {isNew && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-2">หมวดหมู่</label>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_CATEGORIES.map(c => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-all text-left px-3 ${
                      category === c ? 'bg-teal-100 border-teal-400 text-teal-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {CATEGORY_ICONS[c]} {c}
                  </button>
                ))}
              </div>
            </div>

            {/* ช่องทางชำระเงิน */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-2">ช่องทางชำระเงิน</label>
              <div className="flex gap-2">
                {(['KBank', 'เงินสด'] as PaymentMethod[]).map(m => (
                  <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      paymentMethod === m ? 'bg-sky-100 border-sky-400 text-sky-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {m === 'เงินสด' ? '💵 เงินสด' : '🏦 KBank'}
                  </button>
                ))}
              </div>
            </div>

            {/* หน่วยของสินค้า */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm text-gray-500 mb-0.5">ขนาด / หน่วยของสินค้า</label>
              <p className="text-xs text-gray-400 mb-3">เช่น นม 5000g — ไม่เกี่ยวกับราคา</p>
              <div className="flex items-center gap-2 mb-3 w-full">
                <input
                  type="text" placeholder="เช่น 5000, Large"
                  value={unitSize} onChange={e => setUnitSize(e.target.value)}
                  className="flex-1 min-w-0 text-xl font-bold text-gray-800 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-teal-400"
                />
                <input
                  type="text" placeholder="หน่วย"
                  value={unitType} onChange={e => setUnitType(e.target.value)}
                  className="w-20 flex-shrink-0 text-base font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-2 py-2 outline-none focus:border-teal-400 text-center"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {UNIT_TYPES.map(u => (
                  <button key={u.value} type="button" onClick={() => setUnitType(u.value)}
                    className={`py-2 px-3 rounded-xl text-xs border transition-all ${
                      unitType === u.value ? 'bg-teal-100 border-teal-400 text-teal-700 font-semibold' : 'border-gray-200 text-gray-600'
                    }`}>
                    {u.label}
                  </button>
                ))}
              </div>
              {(unitSize || unitType) && (
                <p className="mt-2 text-sm text-gray-500">
                  หน่วยที่บันทึก: <span className="font-semibold text-teal-700">{unitValue}</span>
                </p>
              )}
            </div>

            {/* จำนวนและราคา */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-2">จำนวน</label>
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setQty(v => String(Math.max(1, (parseInt(v) || 0) - 1)))}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl text-gray-600 flex items-center justify-center flex-shrink-0 active:bg-gray-200">
                    −
                  </button>
                  <input type="number" inputMode="numeric" step="1" min="1" placeholder="0" value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="flex-1 min-w-0 text-4xl font-bold text-gray-800 text-center border-none outline-none bg-transparent" />
                  <button type="button"
                    onClick={() => setQty(v => String((parseInt(v) || 0) + 1))}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl text-gray-600 flex items-center justify-center flex-shrink-0 active:bg-gray-200">
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm text-gray-500 mb-1">ราคาต่อ 1 ชิ้น (฿)</label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  className="w-full text-3xl font-bold text-gray-800 border-none outline-none bg-transparent" />
              </div>

              {total > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="bg-teal-50 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">{qtyNum} ชิ้น × ฿{priceNum.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 font-medium">ยอดรวม</p>
                    </div>
                    <span className="text-2xl font-bold text-teal-700">
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
          <label className="block text-sm text-gray-500 mb-2">วันที่</label>
          <div className="flex items-center gap-2 mb-2">
            <button type="button"
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0,10)) }}
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg flex-shrink-0 active:bg-gray-200">‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="flex-1 text-base text-gray-800 border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-teal-300 cursor-pointer" />
            <button type="button"
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0,10)) }}
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg flex-shrink-0 active:bg-gray-200">›</button>
          </div>
          <div className="flex gap-2">
            {[['วันนี้', 0], ['เมื่อวาน', -1], ['2 วันก่อน', -2]].map(([label, diff]) => (
              <button key={label} type="button"
                onClick={() => { const d = new Date(); d.setDate(d.getDate() + Number(diff)); setDate(d.toISOString().slice(0,10)) }}
                className={`px-3 py-1 rounded-lg text-xs border transition-all ${
                  date === (() => { const d = new Date(); d.setDate(d.getDate() + Number(diff)); return d.toISOString().slice(0,10) })()
                    ? 'bg-teal-100 border-teal-300 text-teal-700 font-semibold' : 'border-gray-200 text-gray-500'
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {/* สถานที่ซื้อ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2">🏪 ซื้อจากที่ไหน</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {[...new Set(['Makro', 'โลตัส', '7-11', 'BigC', 'ตลาด', ...savedStores])].map(s => (
              <button key={s} type="button" onClick={() => setStore(s)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  store === s ? 'bg-teal-100 border-teal-400 text-teal-700 font-semibold' : 'border-gray-200 text-gray-600'
                }`}>
                {s}
              </button>
            ))}
          </div>
          <input type="text" placeholder="หรือพิมพ์เอง..." value={store}
            onChange={e => setStore(e.target.value)}
            className="w-full text-base text-gray-700 border-none outline-none bg-transparent" />
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
          style={{background: '#96CFCF'}}
          className={`w-full py-4 rounded-2xl font-bold text-gray-800 text-lg transition-opacity ${
            submitting || !showForm ? 'opacity-40' : 'active:opacity-90'
          }`}>
          {submitting ? 'กำลังบันทึก...' : 'บันทึกการซื้อ'}
        </button>
      </form>
    </div>
  )
}
