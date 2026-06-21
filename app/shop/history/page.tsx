'use client'

import { useEffect, useState } from 'react'
import { Purchase } from '@/lib/types'

const CATEGORY_ICON: Record<string, string> = {
  'วัตถุดิบ ร้าน Hop & Sip': '🧂',
  'อุปกรณ์ เครื่องใช้': '🔧',
  'อาหาร/เครื่องดื่ม': '🍽️',
  'ค่าสัตว์เลี้ยง': '🐾',
  'อื่นๆ (รายจ่าย)': '📦',
}
function catIcon(c: string) { return CATEGORY_ICON[c] ?? '📦' }

type FilterCat = 'ทั้งหมด' | 'วัตถุดิบ ร้าน Hop & Sip' | 'อุปกรณ์ เครื่องใช้' | 'อาหาร/เครื่องดื่ม' | 'ค่าสัตว์เลี้ยง' | 'อื่นๆ (รายจ่าย)'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ShopHistoryPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [filterCat, setFilterCat] = useState<FilterCat>('ทั้งหมด')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const d = await fetch('/api/purchases').then(r => r.json())
      setPurchases(Array.isArray(d) ? d : [])
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  async function handleDelete(p: Purchase) {
    if (!confirm(`ลบ "${p.productName}" ฿${fmt(p.total)} ใช่ไหม?`)) return
    setDeleting(p.id)
    try {
      await fetch('/api/purchases/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowIndex: parseInt(p.id) }) })
      await fetchData()
    } finally { setDeleting(null) }
  }

  const filtered = purchases
    .filter(p => p.date.startsWith(filterMonth) && (filterCat === 'ทั้งหมด' || p.category === filterCat))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalAll = filtered.reduce((s, p) => s + p.total, 0)
  const totalIngredient = filtered.filter(p => p.category === 'วัตถุดิบ ร้าน Hop & Sip').reduce((s, p) => s + p.total, 0)
  const totalEquipment = filtered.filter(p => p.category === 'อุปกรณ์ เครื่องใช้').reduce((s, p) => s + p.total, 0)

  const grouped = filtered.reduce<Record<string, Purchase[]>>((acc, p) => {
    if (!acc[p.date]) acc[p.date] = []
    acc[p.date].push(p)
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
        <span className="text-purple-600">🔧 ฿{fmt(totalEquipment)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(['ทั้งหมด', 'วัตถุดิบ ร้าน Hop & Sip', 'อุปกรณ์ เครื่องใช้', 'อาหาร/เครื่องดื่ม', 'ค่าสัตว์เลี้ยง', 'อื่นๆ (รายจ่าย)'] as FilterCat[]).map(c => (
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
                  {grouped[date].map(p => (
                    <div key={p.id} className="flex items-center px-4 py-3">
                      <span className="text-lg mr-3 flex-shrink-0">{catIcon(p.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{p.productName}</p>
                        <p className="text-gray-400 text-xs">{p.qty.toLocaleString()} {p.unit} × ฿{p.unitPrice.toLocaleString()}{p.note ? ` · ${p.note}` : ''}</p>
                      </div>
                      <p className="font-semibold text-gray-700 text-sm mr-2 flex-shrink-0">฿{fmt(p.total)}</p>
                      <button onClick={() => handleDelete(p)} disabled={deleting === p.id}
                        className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">
                        {deleting === p.id ? '⏳' : '🗑'}
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
