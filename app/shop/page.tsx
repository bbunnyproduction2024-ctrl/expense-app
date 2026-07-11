'use client'

import { useEffect, useState } from 'react'
import { Purchase } from '@/lib/types'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'

const CATEGORY_ICON: Record<string, string> = {
  'วัตถุดิบ ร้าน Hop & Sip': '🧂',
  'อุปกรณ์ร้าน Hop & Sip': '🛠️',
  'อุปกรณ์ เครื่องใช้': '🔧',
  'อาหาร/เครื่องดื่ม': '🍽️',
  'ค่าสัตว์เลี้ยง': '🐾',
  'อื่นๆ (รายจ่าย)': '📦',
}
function catIcon(c: string) { return CATEGORY_ICON[c] ?? '📦' }

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ShopDashboard() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    fetch('/api/purchases').then(r => r.json()).then(d => {
      setPurchases(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const monthStart = startOfMonth(parseISO(`${month}-01`))
  const monthEnd = endOfMonth(parseISO(`${month}-01`))
  const filtered = purchases.filter(p => {
    try { return isWithinInterval(parseISO(p.date), { start: monthStart, end: monthEnd }) }
    catch { return false }
  })

  const totalAll = filtered.reduce((s, p) => s + p.total, 0)
  const totalIngredient = filtered.filter(p => p.category === 'วัตถุดิบ ร้าน Hop & Sip').reduce((s, p) => s + p.total, 0)
  const totalShopEquip = filtered.filter(p => p.category === 'อุปกรณ์ร้าน Hop & Sip').reduce((s, p) => s + p.total, 0)
  const FAMILY_CATS = ['อุปกรณ์ เครื่องใช้', 'อาหาร/เครื่องดื่ม', 'ค่าสัตว์เลี้ยง', 'อื่นๆ (รายจ่าย)']
  const totalEquipment = filtered.filter(p => FAMILY_CATS.includes(p.category)).reduce((s, p) => s + p.total, 0)

  // Top items this month
  const itemMap = new Map<string, { total: number; qty: number; unit: string; category: string }>()
  filtered.forEach(p => {
    const e = itemMap.get(p.productName)
    itemMap.set(p.productName, { total: (e?.total ?? 0) + p.total, qty: (e?.qty ?? 0) + p.qty, unit: p.unit, category: p.category })
  })
  const topItems = [...itemMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5)

  const recent = [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5)
  const thaiMonth = format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: th })

  return (
    <div className="min-h-full bg-[#f7ede4]">
      <div className="bg-[#f7ede4] px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-purple-400 text-sm">สต๊อก & ซื้อของ</p>
            <h1 className="text-2xl font-bold text-gray-800">รายการซื้อ</h1>
          </div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-white/70 text-gray-700 text-sm rounded-lg px-3 py-1.5 border border-purple-200 focus:outline-none" />
        </div>
      </div>

      <div className="px-4 space-y-3 pb-4">
        {/* Summary cards */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-gray-400 text-sm mb-1">{thaiMonth} — รวมทั้งหมด</p>
          <p className="text-3xl font-bold text-gray-800 mb-3">฿{fmt(totalAll)}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-orange-500 text-xs mb-0.5">🧂 วัตถุดิบร้าน</p>
              <p className="text-orange-600 font-bold text-sm">฿{fmt(totalIngredient)}</p>
            </div>
            <div className="bg-sky-50 rounded-xl p-3">
              <p className="text-sky-500 text-xs mb-0.5">🛠️ อุปกรณ์ร้าน</p>
              <p className="text-sky-600 font-bold text-sm">฿{fmt(totalShopEquip)}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-purple-500 text-xs mb-0.5">🔧 ครอบครัว</p>
              <p className="text-purple-600 font-bold text-sm">฿{fmt(totalEquipment)}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/shop/add"
            style={{background: '#96CFCF'}}
            className="flex-1 flex items-center justify-center gap-2 text-gray-800 rounded-2xl py-3.5 font-semibold text-base shadow-sm active:opacity-90">
            <span className="text-xl leading-none">+</span> บันทึกการซื้อ
          </Link>
          <Link href="/shop/products"
            className="flex items-center justify-center gap-1.5 bg-white text-teal-600 border border-teal-200 rounded-2xl px-4 py-3.5 font-semibold text-sm shadow-sm active:opacity-90 flex-shrink-0">
            🔍 ราคาสินค้า
          </Link>
        </div>

        {loading ? <div className="text-center py-8 text-gray-400">กำลังโหลด...</div> : (
          <>
            {/* Top items */}
            {topItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-gray-700">ซื้อมากสุดเดือนนี้</h2>
                  <Link href="/shop/history" className="text-purple-500 text-sm font-medium">ดูทั้งหมด →</Link>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {topItems.map(([name, { total, qty, unit, category }]) => (
                    <div key={name} className="flex items-center px-4 py-3">
                      <span className="text-lg mr-3">{catIcon(category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{name}</p>
                        <p className="text-gray-400 text-xs">{qty.toLocaleString()} {unit}</p>
                      </div>
                      <p className="font-semibold text-gray-700 text-sm">฿{fmt(total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent */}
            {recent.length > 0 && (
              <div>
                <h2 className="font-semibold text-gray-700 mb-2">รายการล่าสุด</h2>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {recent.map(p => (
                    <div key={p.id} className="flex items-center px-4 py-3">
                      <span className="text-lg mr-3">{catIcon(p.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{p.productName}</p>
                        <p className="text-gray-400 text-xs">{p.date} · {p.qty} {p.unit}</p>
                      </div>
                      <p className="font-semibold text-gray-700 text-sm">฿{fmt(p.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ยังไม่มีรายการเดือนนี้</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
