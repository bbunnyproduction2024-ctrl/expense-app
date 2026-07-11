'use client'

import { useEffect, useState } from 'react'
import { Transaction, TransactionType, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

function formatBaht(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<TransactionType | 'ทั้งหมด'>('ทั้งหมด')
  const [filterMonth, setFilterMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editPayment, setEditPayment] = useState('')

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/transactions')
      const data = await res.json()
      setTransactions(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  async function handleEdit(t: Transaction) {
    const dateChanged = editDate && editDate !== t.date
    const amountNum = parseFloat(editAmount)
    const amountChanged = editAmount && !isNaN(amountNum) && amountNum !== t.amount
    const categoryChanged = editCategory && editCategory !== t.category
    const noteChanged = editNote !== t.note
    const paymentChanged = editPayment && editPayment !== t.paymentMethod
    if (!dateChanged && !amountChanged && !categoryChanged && !noteChanged && !paymentChanged) { setEditingId(null); return }
    try {
      await fetch('/api/transactions/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: parseInt(t.id),
          newDate: dateChanged ? editDate : undefined,
          newAmount: amountChanged ? amountNum : undefined,
          newCategory: categoryChanged ? editCategory : undefined,
          newNote: noteChanged ? editNote : undefined,
          newPaymentMethod: paymentChanged ? editPayment : undefined,
        }),
      })
      setEditingId(null)
      await fetchData()
    } catch { setEditingId(null) }
  }

  async function handleDelete(t: Transaction) {
    if (!confirm(`ลบรายการ "${t.category}" ฿${formatBaht(t.amount)} ใช่ไหม?`)) return
    setDeleting(t.id)
    try {
      await fetch('/api/transactions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: parseInt(t.id) }),
      })
      await fetchData()
    } finally {
      setDeleting(null)
    }
  }

  const filtered = transactions.filter((t) => {
    const monthMatch = t.date.startsWith(filterMonth)
    const typeMatch = filterType === 'ทั้งหมด' || t.type === filterType
    return monthMatch && typeMatch
  }).sort((a, b) => b.date.localeCompare(a.date))

  // Group by date
  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, t) => {
    const key = t.date
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const totalIncome = filtered.filter((t) => t.type === 'รายรับ').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter((t) => t.type === 'รายจ่าย').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-full bg-[#f7ede4]">
      {/* Header */}
      <div className="bg-[#f7ede4] text-gray-800 px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold mb-3">ประวัติรายการ</h1>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="bg-white/70 text-gray-700 text-sm rounded-lg px-3 py-1.5 border border-rose-200 focus:outline-none"
        />
      </div>

      {/* Summary bar */}
      <div className="bg-rose-100 px-4 py-2 flex gap-4 text-sm">
        <span className="text-green-600">รายรับ ฿{formatBaht(totalIncome)}</span>
        <span className="text-gray-300">|</span>
        <span className="text-red-500">รายจ่าย ฿{formatBaht(totalExpense)}</span>
        <span className="text-gray-300">|</span>
        <span className={`font-bold ${totalIncome - totalExpense >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
          คงเหลือ ฿{formatBaht(totalIncome - totalExpense)}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Type filter */}
        <div className="flex gap-2">
          {(['ทั้งหมด', 'รายรับ', 'รายจ่าย'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === t
                  ? 'bg-[#FFE4E1] text-rose-700 border border-rose-200'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
            ไม่มีรายการ
          </div>
        ) : (
          sortedDates.map((date) => {
            let displayDate = date
            try {
              displayDate = format(parseISO(date), 'EEEE d MMMM yyyy', { locale: th })
            } catch { /* use raw date */ }

            const dayNet = grouped[date].reduce((s, t) => s + (t.type === 'รายรับ' ? t.amount : -t.amount), 0)

            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-1 px-1">
                  <p className="text-xs font-semibold text-gray-400">{displayDate}</p>
                  <p className={`text-xs font-semibold ${dayNet >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                    {dayNet >= 0 ? '+' : ''}฿{formatBaht(dayNet)}
                  </p>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {grouped[date].map((t) => (
                    <div key={t.id}>
                      <div className="flex items-center px-4 py-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-base mr-3 flex-shrink-0 ${
                            t.type === 'รายรับ' ? 'bg-green-100' : 'bg-red-100'
                          }`}
                        >
                          {t.type === 'รายรับ' ? '💰' : '💸'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{t.category}</p>
                          <p className="text-gray-400 text-xs truncate">
                            {t.paymentMethod === 'KBank' ? '🏦 KBank' : '💵 เงินสด'}
                            {t.note ? ` · ${t.note}` : ''}
                          </p>
                        </div>
                        <p className={`font-semibold text-sm mr-2 flex-shrink-0 ${t.type === 'รายรับ' ? 'text-green-600' : 'text-red-500'}`}>
                          {t.type === 'รายรับ' ? '+' : '-'}฿{formatBaht(t.amount)}
                        </p>
                        <button
                          onClick={() => { setEditingId(t.id); setEditDate(t.date); setEditAmount(String(t.amount)); setEditCategory(t.category); setEditNote(t.note ?? ''); setEditPayment(t.paymentMethod) }}
                          className="text-gray-300 hover:text-blue-400 text-base mr-1 flex-shrink-0"
                          aria-label="แก้ไขวันที่"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={deleting === t.id}
                          className="text-gray-300 hover:text-red-400 active:text-red-600 text-lg flex-shrink-0 transition-colors"
                          aria-label="ลบ"
                        >
                          {deleting === t.id ? '⏳' : '🗑'}
                        </button>
                      </div>
                      {editingId === t.id && (
                        <div className="px-4 pb-3 pt-2 space-y-2.5 bg-blue-50 border-t border-blue-100">
                          <div className="space-y-1.5">
                            <span className="text-xs text-blue-500">วันที่</span>
                            <div className="flex items-center gap-1.5">
                              <button type="button"
                                onClick={() => { const d = new Date(editDate); d.setDate(d.getDate() - 1); setEditDate(d.toISOString().slice(0,10)) }}
                                className="w-8 h-8 rounded-full bg-white border border-blue-200 text-gray-500 flex items-center justify-center text-base flex-shrink-0">‹</button>
                              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                                className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white cursor-pointer"
                              />
                              <button type="button"
                                onClick={() => { const d = new Date(editDate); d.setDate(d.getDate() + 1); setEditDate(d.toISOString().slice(0,10)) }}
                                className="w-8 h-8 rounded-full bg-white border border-blue-200 text-gray-500 flex items-center justify-center text-base flex-shrink-0">›</button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-500 w-14 flex-shrink-0">ราคา ฿</span>
                            <input type="number" inputMode="decimal" value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <span className="text-xs text-blue-500 block mb-1">ช่องทางชำระ</span>
                            <div className="flex gap-2">
                              {(['KBank', 'เงินสด'] as const).map(m => (
                                <button key={m} type="button" onClick={() => setEditPayment(m)}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    editPayment === m ? 'bg-sky-100 border-sky-400 text-sky-700' : 'bg-white border-gray-200 text-gray-500'
                                  }`}>
                                  {m === 'KBank' ? '🏦 KBank' : '💵 เงินสด'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-blue-500 block mb-1">หมวดหมู่</span>
                            <div className="flex flex-wrap gap-1.5">
                              {(t.type === 'รายรับ' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                                <button key={c} type="button" onClick={() => setEditCategory(c)}
                                  className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                                    editCategory === c
                                      ? 'bg-blue-500 border-blue-500 text-white font-semibold'
                                      : 'bg-white border-gray-200 text-gray-600'
                                  }`}>
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-500 w-14 flex-shrink-0">หมายเหตุ</span>
                            <input type="text" value={editNote}
                              onChange={e => setEditNote(e.target.value)}
                              placeholder="เพิ่มหมายเหตุ..."
                              className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg">
                              ยกเลิก
                            </button>
                            <button onClick={() => handleEdit(t)}
                              className="px-4 py-1 bg-blue-500 text-white text-xs rounded-lg font-semibold">
                              บันทึก
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
