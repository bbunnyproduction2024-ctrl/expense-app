'use client'

import { useEffect, useState } from 'react'
import { Product } from '@/lib/types'

const CATEGORY_ICON: Record<string, string> = {
  'วัตถุดิบ ร้าน Hop & Sip': '🧂',
  'อุปกรณ์ร้าน Hop & Sip': '🛠️',
  'อุปกรณ์ เครื่องใช้': '🔧',
  'อาหาร/เครื่องดื่ม': '🍽️',
  'ค่าสัตว์เลี้ยง': '🐾',
  'อื่นๆ (รายจ่าย)': '📦',
}

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  async function fetchData() {
    setLoading(true)
    fetch('/api/products').then(r => r.json()).then(d => {
      setProducts(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  async function handleRename(p: Product) {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === p.name) { setEditingId(null); return }
    setSaving(true)
    try {
      await fetch('/api/products/rename', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: p.name, newName: trimmed }),
      })
      setEditingId(null)
      await fetchData()
    } finally { setSaving(false) }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name, 'th'))

  return (
    <div className="min-h-full bg-[#f7ede4]">
      <div className="text-gray-800 px-4 pt-12 pb-4" style={{ background: '#96CFCF' }}>
        <h1 className="text-2xl font-bold">รายการสินค้า</h1>
        <p className="text-sm opacity-70 mt-1">ดูราคา / แก้ไขชื่อสินค้า</p>
      </div>

      <div className="px-4 pt-4 pb-2 sticky top-0 bg-[#f7ede4] z-10">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อสินค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-base text-gray-800 outline-none bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 text-sm">✕</button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            {search ? `ไม่พบ "${search}"` : 'ยังไม่มีสินค้า'}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 px-1">{filtered.length} รายการ</p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
              {filtered.map(p => (
                <div key={p.id}>
                  <div className="flex items-center px-4 py-3">
                    <span className="text-lg mr-3 flex-shrink-0">
                      {CATEGORY_ICON[p.category] ?? '📦'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                      <p className="text-gray-400 text-xs">{p.unit} · {p.category}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-3">
                      <p className="font-semibold text-teal-700 text-sm">฿{fmt(p.lastPrice)}</p>
                      <p className="text-gray-400 text-xs">{p.updatedAt}</p>
                    </div>
                    <button
                      onClick={() => { setEditingId(p.id); setEditName(p.name) }}
                      className="text-gray-300 hover:text-teal-500 text-base flex-shrink-0"
                      aria-label="แก้ไขชื่อ"
                    >✏️</button>
                  </div>
                  {editingId === p.id && (
                    <div className="px-4 pb-3 pt-2 space-y-2 bg-teal-50 border-t border-teal-100">
                      <span className="text-xs text-teal-600 block">แก้ไขชื่อสินค้า</span>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRename(p)}
                        autoFocus
                        className="w-full text-sm border border-teal-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 bg-white"
                      />
                      <p className="text-xs text-gray-400">จะอัปเดตทั้งสต๊อก ประวัติซื้อ และรายการทั้งหมด</p>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg">
                          ยกเลิก
                        </button>
                        <button onClick={() => handleRename(p)} disabled={saving}
                          className="px-4 py-1 bg-teal-500 text-white text-xs rounded-lg font-semibold disabled:opacity-50">
                          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
