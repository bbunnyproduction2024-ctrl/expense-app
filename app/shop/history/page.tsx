'use client'

import { useEffect, useState } from 'react'
import { Transaction, PAYMENT_METHOD_LABELS } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

const CATEGORY_ICON: Record<string, string> = {
  'วัตถุดิบร้าน Hop & Sip': '🧂',
  'อุปกรณ์ร้าน Hop & Sip': '🛠️',
  'ค่าใช้จ่ายในครอบครัว': '🔧',
  'อาหาร/เครื่องดื่ม': '🍽️',
  'ค่าสัตว์เลี้ยง': '🐾',
  'อื่นๆ (รายจ่าย)': '📦',
}
function catIcon(c: string) { return CATEGORY_ICON[c] ?? '📦' }

const FILTER_CATS = [
  'ทั้งหมด',
  'วัตถุดิบร้าน Hop & Sip',
  'อุปกรณ์ร้าน Hop & Sip',
  'ค่าใช้จ่ายในครอบครัว',
  'อาหาร/เครื่องดื่ม',
  'ค่าสัตว์เลี้ยง',
  'อื่นๆ (รายจ่าย)',
] as const
type FilterCat = typeof FILTER_CATS[number]

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// "ซื้อ {ชื่อ} {จำนวน}_{หน่วย} @{ร้าน} (ของซื้อ)" -> "ชื่อ จำนวน หน่วย @ร้าน"
function purchaseLabel(note: string) {
  return note
    .replace(/^ซื้อ\s*/, '')
    .replace(/\s*\(ของซื้อ\)\s*$/, '')
    .replace(/(\d+)_(\S+)/, '$1 $2')
    .replace(/(\d+)_(\s|$)/, '$1$2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export default function ShopHistoryPage() {
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [filterCat, setFilterCat] = useState<FilterCat>('ทั้งหมด')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const d = await fetch('/api/transactions').then(r => r.json())
      setTxns(Array.isArray(d) ? d : [])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  async function handleDelete(t: Transaction) {
    if (!confirm(`ลบ "${purchaseLabel(t.note)}" ฿${fmt(t.amount)} ใช่ไหม?`)) return
    setDeleting(t.id)
    try {
      await fetch('/api/purchases/delete-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: parseInt(t.id) }),
      })
      await fetchData()
    } finally { setDeleting(null) }
  }

  const purchases = txns.filter(
    t => t.type === 'รายจ่าย' && (t.note ?? '').includes('(ของซื้อ)')
  )

  const filtered = purchases
    .filter(t => t.date.startsWith(filterMonth) && (filterCat === 'ทั้งหมด' || t.category === filterCat))
    .sort((a, b) => b.date.localeCompare(a.date) || parseInt(b.id) - parseInt(a.id))

  const totalAll = filtered.reduce((s, t) => s + t.amount, 0)
  const totalIngredient = filtered.filter(t => t.category === 'วัตถุดิบร้าน Hop & Sip').reduce((s, t) => s + t.amount, 0)
  const totalShopEquip = filtered.filter(t => t.category === 'อุปกรณ์ร้าน Hop & Sip').reduce((s, t) => s + t.amount, 0)

  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = []
    acc[t.date].push(t)
    return acc
  }, {})

  return (
    <div className="min-h-full bg-[#f7ede4]">
      <div className="bg-[#f7ede4] px-4 pt-12 pb-3">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">ประวัติการซื้อ</h1>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="bg-white/70 text-gray-700 text-sm rounded-lg px-3 py-1.5 border border-purple-200 focus:outline-none" />
      </div>

      {/* Summary bar */}
      <div className="bg-purple-100 px-4 py-2 flex gap-3 text-sm flex-wrap">
        <span className="text-gray-700 font-semibold">฿{fmt(totalAll)}</span>
        <span className="text-gray-300">|</span>
        <span className="text-orange-600">🧂 ฿{fmt(totalIngredient)}</span>
        <span className="text-gray-300">|</span>
        <span className="text-sky-600">🛠️ ฿{fmt(totalShopEquip)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_CATS.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                filterCat === c ? 'bg-purple-200 text-purple-800' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {c === 'ทั้งหมด' ? c : `${catIcon(c)} ${c}`}
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
          : filtered.length === 0 ? <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ไม่มีรายการ</div>
          : Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(date => {
            let displayDate = date
            try { displayDate = format(parseISO(date), 'EEEE d MMMM yyyy', { locale: th }) } catch { /**/ }
            return (
              <div key={date}>
                <p className="text-xs font-semibold text-gray-400 mb-1 px-1">{displayDate}</p>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {grouped[date].map(t => (
                    <div key={t.id} className="flex items-center px-4 py-3">
                      <span className="text-lg mr-3 flex-shrink-0">{catIcon(t.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{purchaseLabel(t.note)}</p>
                        <p className="text-gray-400 text-xs truncate">
                          {PAYMENT_METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-700 text-sm mr-2 flex-shrink-0">฿{fmt(t.amount)}</p>
                      <button onClick={() => handleDelete(t)} disabled={deleting === t.id}
                        className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">
                        {deleting === t.id ? '⏳' : '🗑'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
