'use client'

import { useEffect, useState } from 'react'
import { Bill, Transaction, THAI_MONTHS_SHORT } from '@/lib/types'
import { yearlyRealSavedInWindow } from '@/lib/billCycles'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SavingsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [b, t] = await Promise.all([
        fetch('/api/bills').then((r) => r.json()),
        fetch('/api/transactions').then((r) => r.json()),
      ])
      setBills(Array.isArray(b) ? b : [])
      setTransactions(Array.isArray(t) ? t : [])
      setLoading(false)
    })()
  }, [])

  const today = new Date()
  const items = bills
    .filter((b) => b.type === 'yearly')
    .map((b) => {
      const realSaved = yearlyRealSavedInWindow(b, transactions, today)
      const credit = b.savedCredit || 0
      const saved = credit + realSaved
      const pct = b.amount > 0 ? Math.min(100, (saved / b.amount) * 100) : 0
      return { bill: b, saved, credit, realSaved, pct }
    })
    .sort((a, b) => a.bill.dueMonth - b.bill.dueMonth)

  const totalSaved = items.reduce((s, i) => s + i.saved, 0)

  return (
    <div className="min-h-full bg-[#f7ede4] overflow-x-hidden pb-24">
      <div className="px-4 pt-12 pb-6 bg-slate-700 text-white">
        <h1 className="text-2xl font-bold">🐷 ออมทรัพย์</h1>
        <p className="text-sm opacity-75 mt-1">ยอดสะสมเพื่อบิลรายปี รวม ~฿{fmt(totalSaved)}</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ยังไม่มีบิลรายปี</div>
        ) : (
          items.map(({ bill, saved, credit, realSaved, pct }) => (
            <div key={bill.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-medium text-sm text-gray-800">{bill.name}</p>
                <p className="text-xs text-gray-400">จ่าย {THAI_MONTHS_SHORT[bill.dueMonth - 1]}</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-pink-400" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-pink-600 font-bold text-sm">฿{fmt(saved)}</p>
                <p className="text-gray-400 text-xs">
                  จากเป้า ฿{fmt(bill.amount)} ({pct.toFixed(0)}%)
                </p>
              </div>
              {credit > 0 && (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  เก็บไว้ก่อนหน้า ฿{fmt(credit)} (ไม่ใช่เงินจริงในบัญชี) + โอนเข้าออมทรัพย์จริงแล้ว ฿{fmt(realSaved)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
