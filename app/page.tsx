'use client'

import { useEffect, useState } from 'react'
import { Transaction } from '@/lib/types'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'

function formatBaht(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`))
  const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`))

  const monthTxns = transactions.filter((t) => {
    try {
      return isWithinInterval(parseISO(t.date), { start: monthStart, end: monthEnd })
    } catch {
      return false
    }
  })

  const totalIncome = monthTxns
    .filter((t) => t.type === 'รายรับ')
    .reduce((s, t) => s + t.amount, 0)

  const totalExpense = monthTxns
    .filter((t) => t.type === 'รายจ่าย')
    .reduce((s, t) => s + t.amount, 0)

  const balance = totalIncome - totalExpense

  const recent = [...monthTxns]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5)

  const categoryMap = new Map<string, { amount: number; type: string }>()
  monthTxns.forEach((t) => {
    const existing = categoryMap.get(t.category)
    categoryMap.set(t.category, {
      amount: (existing?.amount ?? 0) + t.amount,
      type: t.type,
    })
  })

  const thaiMonth = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: th })

  return (
    <div className="min-h-full bg-[#f5f5f0]">
      {/* Header */}
      <div className="bg-amber-900 text-white px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-amber-200 text-sm">Hop & Sip</p>
            <h1 className="text-2xl font-bold">รายรับรายจ่าย</h1>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-amber-800 text-white text-sm rounded-lg px-3 py-1.5 border border-amber-700 focus:outline-none"
          />
        </div>

        {/* Balance Card */}
        <div className="bg-amber-800/60 rounded-2xl p-4">
          <p className="text-amber-200 text-sm mb-1">{thaiMonth}</p>
          <p className="text-3xl font-bold mb-3">
            {balance >= 0 ? '+' : ''}฿{formatBaht(balance)}
          </p>
          <div className="flex gap-3">
            <div className="flex-1 bg-green-500/20 rounded-xl p-3">
              <p className="text-green-300 text-xs mb-0.5">รายรับ</p>
              <p className="text-green-300 font-bold text-lg">฿{formatBaht(totalIncome)}</p>
            </div>
            <div className="flex-1 bg-red-500/20 rounded-xl p-3">
              <p className="text-red-300 text-xs mb-0.5">รายจ่าย</p>
              <p className="text-red-300 font-bold text-lg">฿{formatBaht(totalExpense)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Quick add button */}
        <Link
          href="/add"
          className="flex items-center justify-center gap-2 bg-amber-800 text-white rounded-2xl py-3.5 font-semibold text-base shadow-sm active:opacity-90"
        >
          <span className="text-xl leading-none">+</span>
          เพิ่มรายการใหม่
        </Link>

        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : (
          <>
            {/* Recent Transactions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-700">รายการล่าสุด</h2>
                <Link href="/history" className="text-amber-800 text-sm font-medium">ดูทั้งหมด →</Link>
              </div>

              {recent.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 text-center text-gray-400">
                  ยังไม่มีรายการในเดือนนี้
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {recent.map((t) => (
                    <div key={t.id} className="flex items-center px-4 py-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mr-3 flex-shrink-0 ${
                          t.type === 'รายรับ' ? 'bg-green-100' : 'bg-red-100'
                        }`}
                      >
                        {t.type === 'รายรับ' ? '💰' : '💸'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{t.category}</p>
                        <p className="text-gray-400 text-xs">{t.date}{t.note ? ` · ${t.note}` : ''}</p>
                      </div>
                      <p className={`font-semibold ml-2 flex-shrink-0 ${t.type === 'รายรับ' ? 'text-green-600' : 'text-red-500'}`}>
                        {t.type === 'รายรับ' ? '+' : '-'}฿{formatBaht(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            {categoryMap.size > 0 && (
              <div>
                <h2 className="font-semibold text-gray-700 mb-2">หมวดหมู่เดือนนี้</h2>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {[...categoryMap.entries()]
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([cat, { amount, type }]) => (
                      <div key={cat} className="flex items-center px-4 py-3">
                        <p className="flex-1 text-sm text-gray-700">{cat}</p>
                        <p className={`font-medium text-sm ${type === 'รายรับ' ? 'text-green-600' : 'text-red-500'}`}>
                          {type === 'รายรับ' ? '+' : '-'}฿{formatBaht(amount)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
