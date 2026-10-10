'use client'

import Link from 'next/link'
import { Transaction } from '@/lib/types'
import { computeCurrentBalances } from '@/lib/balances'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ยอดคงเหลือ "ตอนนี้" แต่ละช่องทาง — เลขเดียวกันทุกหน้าที่ใช้ component นี้ (ไม่ขึ้นกับเดือนที่เลือกดู)
export default function CurrentBalanceCard({
  transactions,
  size = 'full',
}: {
  transactions: Transaction[]
  size?: 'full' | 'compact'
}) {
  const bal = computeCurrentBalances(transactions)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className={size === 'full' ? 'text-rose-400 text-sm' : 'text-gray-400 text-xs'}>ยอดคงเหลือตอนนี้</p>
      </div>
      <p className={`font-bold text-gray-800 ${size === 'full' ? 'text-3xl mb-3' : 'text-xl mb-2'}`}>
        {bal.total >= 0 ? '+' : ''}฿{fmt(bal.total)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-sky-500/10 rounded-xl p-2.5">
          <p className="text-sky-600 text-[11px] mb-0.5">🏦 KBank</p>
          <p className={`font-bold text-sm ${bal.kbank >= 0 ? 'text-sky-700' : 'text-red-500'}`}>
            {bal.kbank >= 0 ? '+' : ''}฿{fmt(bal.kbank)}
          </p>
        </div>
        <div className="bg-amber-500/10 rounded-xl p-2.5">
          <p className="text-amber-600 text-[11px] mb-0.5">💵 เงินสด</p>
          <p className={`font-bold text-sm ${bal.cash >= 0 ? 'text-amber-700' : 'text-red-500'}`}>
            {bal.cash >= 0 ? '+' : ''}฿{fmt(bal.cash)}
          </p>
        </div>
        <Link href="/savings" className="bg-pink-500/10 rounded-xl p-2.5 active:bg-pink-500/20">
          <p className="text-pink-600 text-[11px] mb-0.5">🐷 ออมทรัพย์</p>
          <p className={`font-bold text-sm ${bal.saving >= 0 ? 'text-pink-700' : 'text-red-500'}`}>
            {bal.saving >= 0 ? '+' : ''}฿{fmt(bal.saving)}
          </p>
        </Link>
      </div>
    </div>
  )
}
