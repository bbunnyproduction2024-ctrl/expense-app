'use client'

import { useEffect, useState } from 'react'
import { Transaction, Bill, TRANSFER_CATEGORY, isShopCategory } from '@/lib/types'
import { cleanNote } from '@/lib/format'
import { format, startOfMonth, endOfMonth, isWithinInterval, isBefore, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import WheelSummary, { WheelSlice } from '@/components/WheelSummary'
import { computeDailyBudget } from '@/lib/dailyBudget'

function groupByCategory(txns: Transaction[]): WheelSlice[] {
  const m = new Map<string, number>()
  txns.forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount))
  return [...m.entries()].map(([label, amount]) => ({ label, amount }))
}

function formatBaht(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// เริ่มยกยอดสะสมตั้งแต่เดือนนี้เป็นต้นไป (yyyy-MM)
// รายการก่อนหน้านี้ (มิ.ย./ก.ค. 2026) ยกยอดด้วยมือแล้ว จึงไม่นำมารวม
const CARRY_OVER_START = '2026-08'

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    Promise.all([
      fetch('/api/transactions').then((r) => r.json()).catch(() => []),
      fetch('/api/bills').then((r) => r.json()).catch(() => []),
    ])
      .then(([tx, bl]) => {
        setTransactions(Array.isArray(tx) ? tx : [])
        setBills(Array.isArray(bl) ? bl : [])
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

  // รายการตั้งแต่ CARRY_OVER_START จนถึงก่อนเดือนที่เลือก — ใช้คำนวณยอดยกมา
  const priorTxns = transactions.filter((t) => {
    try {
      return (
        t.date.slice(0, 7) >= CARRY_OVER_START &&
        isBefore(parseISO(t.date), monthStart)
      )
    } catch {
      return false
    }
  })

  const net = (txns: Transaction[]) =>
    txns.reduce((s, t) => s + (t.type === 'รายรับ' ? t.amount : -t.amount), 0)

  // ยอดยกมาจากเดือนก่อน (สะสมต่อเนื่อง)
  const carryOver = net(priorTxns)
  const carryKbank = net(priorTxns.filter((t) => t.paymentMethod === 'KBank'))
  const carryCash = net(priorTxns.filter((t) => t.paymentMethod === 'เงินสด'))
  const carrySaving = net(priorTxns.filter((t) => t.paymentMethod === 'ออมทรัพย์'))

  // รายการจริง (ไม่รวมการโอนเงินระหว่างบัญชี) ใช้คิดรายรับ/รายจ่าย/หมวด/วงล้อ
  const realMonthTxns = monthTxns.filter((t) => t.category !== TRANSFER_CATEGORY)

  const totalIncome = realMonthTxns
    .filter((t) => t.type === 'รายรับ')
    .reduce((s, t) => s + t.amount, 0)

  const totalExpense = realMonthTxns
    .filter((t) => t.type === 'รายจ่าย')
    .reduce((s, t) => s + t.amount, 0)

  // ยอดคงเหลือ = ยอดยกมา + สุทธิของเดือนนี้
  const balance = carryOver + totalIncome - totalExpense

  const kbankBalance =
    carryKbank + net(monthTxns.filter((t) => t.paymentMethod === 'KBank'))

  const cashBalance =
    carryCash + net(monthTxns.filter((t) => t.paymentMethod === 'เงินสด'))

  const savingBalance =
    carrySaving + net(monthTxns.filter((t) => t.paymentMethod === 'ออมทรัพย์'))

  const recent = [...realMonthTxns]
    .sort((a, b) => b.date.localeCompare(a.date) || parseInt(b.id) - parseInt(a.id))
    .slice(0, 5)

  const categoryMap = new Map<string, { amount: number; type: string }>()
  realMonthTxns.forEach((t) => {
    const existing = categoryMap.get(t.category)
    categoryMap.set(t.category, {
      amount: (existing?.amount ?? 0) + t.amount,
      type: t.type,
    })
  })

  // ---- วงล้อสรุป ----
  const shopIncomeTxns = realMonthTxns.filter((t) => t.type === 'รายรับ' && isShopCategory(t.category))
  const shopExpenseTxns = realMonthTxns.filter((t) => t.type === 'รายจ่าย' && isShopCategory(t.category))

  const shopIncome = shopIncomeTxns.reduce((s, t) => s + t.amount, 0)
  const shopExpense = shopExpenseTxns.reduce((s, t) => s + t.amount, 0)
  // รายรับที่ไม่ใช่ร้าน (วงล้อ "อื่นๆ" แยกรายรับเป็น Hop & Sip กับ อื่นๆ, รายจ่ายรวมทั้งหมด)
  const otherIncome = totalIncome - shopIncome

  const budget = computeDailyBudget(transactions, bills, new Date(), CARRY_OVER_START)

  const thaiMonth = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: th })

  return (
    <div className="min-h-full bg-[#f7ede4]">
      {/* Header */}
      <div className="bg-[#f7ede4] text-gray-800 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-rose-400 text-sm">Hop & Sip</p>
            <h1 className="text-2xl font-bold">รายรับรายจ่าย</h1>
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white/70 text-gray-700 text-sm rounded-lg px-3 py-1.5 border border-rose-200 focus:outline-none"
          />
        </div>

        {/* Balance Card */}
        <div className="bg-white/60 rounded-2xl p-4">
          <p className="text-rose-400 text-sm mb-1">{thaiMonth}</p>
          <p className="text-3xl font-bold mb-1 text-gray-800">
            {balance >= 0 ? '+' : ''}฿{formatBaht(balance)}
          </p>
          {priorTxns.length > 0 ? (
            <p className="text-xs text-gray-500 mb-3">
              ยอดยกมาจากเดือนก่อน: {carryOver >= 0 ? '+' : ''}฿{formatBaht(carryOver)}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mb-3">เริ่มนับยอดสะสมเดือนนี้</p>
          )}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 bg-green-500/20 rounded-xl p-3">
              <p className="text-green-700 text-xs mb-0.5">รายรับ</p>
              <p className="text-green-700 font-bold text-lg">฿{formatBaht(totalIncome)}</p>
            </div>
            <div className="flex-1 bg-red-500/20 rounded-xl p-3">
              <p className="text-red-700 text-xs mb-0.5">รายจ่าย</p>
              <p className="text-red-700 font-bold text-lg">฿{formatBaht(totalExpense)}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-1.5">คงเหลือแต่ละช่องทาง</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-sky-500/10 rounded-xl p-2.5">
              <p className="text-sky-600 text-[11px] mb-0.5">🏦 KBank</p>
              <p className={`font-bold text-sm ${kbankBalance >= 0 ? 'text-sky-700' : 'text-red-500'}`}>
                {kbankBalance >= 0 ? '+' : ''}฿{formatBaht(kbankBalance)}
              </p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-2.5">
              <p className="text-amber-600 text-[11px] mb-0.5">💵 เงินสด</p>
              <p className={`font-bold text-sm ${cashBalance >= 0 ? 'text-amber-700' : 'text-red-500'}`}>
                {cashBalance >= 0 ? '+' : ''}฿{formatBaht(cashBalance)}
              </p>
            </div>
            <div className="bg-pink-500/10 rounded-xl p-2.5">
              <p className="text-pink-600 text-[11px] mb-0.5">🐷 ออมทรัพย์</p>
              <p className={`font-bold text-sm ${savingBalance >= 0 ? 'text-pink-700' : 'text-red-500'}`}>
                {savingBalance >= 0 ? '+' : ''}฿{formatBaht(savingBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Quick actions */}
        <div className="flex gap-3">
          <Link
            href="/add"
            className="flex-1 flex items-center justify-center gap-2 bg-sky-100 text-sky-700 border border-sky-200 rounded-2xl py-3.5 font-semibold text-base shadow-sm active:opacity-90"
          >
            <span className="text-xl leading-none">+</span>
            เพิ่มรายการ
          </Link>
          <Link
            href="/transfer"
            className="flex items-center justify-center gap-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-2xl px-4 py-3.5 font-semibold text-sm shadow-sm active:opacity-90 flex-shrink-0"
          >
            🔄 โอนเงิน
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : (
          <>
            {/* เงินใช้ได้ต่อวัน */}
            <Link href="/bills" className="block bg-white rounded-2xl p-4 shadow-sm active:opacity-90">
              <div className="flex items-baseline justify-between mb-0.5">
                <p className="text-gray-600 text-sm font-semibold">เงินใช้ได้ต่อวัน</p>
                <span className="text-slate-400 text-xs">แก้ไขบิล →</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-1">เงินที่เหลือใช้จ่ายทั่วไป หลังกันบิล + ของร้าน + เก็บออมไว้แล้ว</p>
              <p className={`text-3xl font-bold ${budget.free < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                ฿{formatBaht(budget.perDay)}
                <span className="text-base font-medium text-gray-400"> / วัน</span>
                <span className="text-xs font-normal text-gray-400"> (ถึง {budget.horizon})</span>
              </p>
              {budget.free < 0 && (
                <p className="text-xs text-red-500 mt-0.5">เงินที่มีไม่พอกับบิล + ของที่กันไว้ — รอเงินเข้า หรือปรับลดที่กันไว้</p>
              )}
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>เงินที่มี (KBank + เงินสด)</span>
                  <span className="text-gray-700 font-medium">฿{formatBaht(budget.spendable)}</span>
                </div>
                {budget.billsDueThisMonth.length > 0 ? (
                  <div className="flex justify-between">
                    <span>− บิลเดือนนี้ที่ยังไม่จ่าย ({budget.billsDueThisMonth.map((b) => b.name).join(', ')})</span>
                    <span className="text-red-500 flex-shrink-0 ml-2">
                      −฿{formatBaht(budget.billsDueThisMonth.reduce((s, b) => s + b.amount, 0))}
                    </span>
                  </div>
                ) : bills.some((b) => b.type === 'monthly') ? (
                  <div className="flex justify-between text-green-600">
                    <span>✓ จ่ายบิลเดือนนี้ครบแล้ว</span>
                    <span className="flex-shrink-0 ml-2">฿0.00</span>
                  </div>
                ) : null}
                {budget.billsSavingAhead.length > 0 && (
                  <div className="flex justify-between">
                    <span>− เก็บไว้จ่ายบิลเดือนหน้า ({budget.billsSavingAhead.map((b) => b.name).join(', ')})</span>
                    <span className="text-red-500 flex-shrink-0 ml-2">
                      −฿{formatBaht(budget.billsSavingAhead.reduce((s, b) => s + b.amount, 0))}
                    </span>
                  </div>
                )}
                {budget.savingsReserve > 0 && (
                  <div className="flex justify-between">
                    <span>− เก็บออม รายปี + ก้อน (ต่อเดือน)</span>
                    <span className="text-red-500 flex-shrink-0 ml-2">−฿{formatBaht(budget.savingsReserve)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>− กันไว้ซื้อวัตถุดิบร้าน</span>
                  <span className="text-red-500 flex-shrink-0 ml-2">−฿{formatBaht(budget.ingredientReserve)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-gray-100">
                  <span>เหลือใช้จ่ายทั่วไป ÷ {budget.daysLeft} วัน</span>
                  <span className={`flex-shrink-0 ml-2 ${budget.free < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    ฿{formatBaht(Math.max(0, budget.free))}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {bills.length === 0
                  ? 'แตะเพื่อเพิ่มบิลประจำ / เงินกันไว้ (ค่าเช่า, เงินเดือน, ประกันรายปี, เก็บซื้อเมล็ดกาแฟ ...)'
                  : 'กดจ่ายบิลที่ตัวบิล → บันทึกรายจ่ายให้อัตโนมัติ แล้วเริ่มกันเงินไว้จ่ายบิลเดือนถัดไปทันที (ไม่มีช่วงไม่กันเงินเลย)'}
              </p>
            </Link>

            {/* วงล้อสรุป */}
            <WheelSummary
              title="ร้าน Hop & Sip"
              subtitle={thaiMonth}
              income={shopIncome}
              expense={shopExpense}
              incomeSlices={groupByCategory(shopIncomeTxns)}
              expenseSlices={groupByCategory(shopExpenseTxns)}
              centerCaption="กำไรร้าน"
            />
            <WheelSummary
              title="อื่นๆ"
              subtitle={thaiMonth}
              income={shopIncome + otherIncome}
              expense={totalExpense}
              incomeSlices={[
                { label: 'รายรับ Hop & Sip', amount: shopIncome },
                { label: 'รายรับ อื่นๆ', amount: otherIncome },
              ]}
              expenseSlices={[{ label: 'รายจ่าย', amount: totalExpense }]}
              centerCaption="คงเหลือ"
            />

            {/* Recent Transactions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-700">รายการล่าสุด</h2>
                <Link href="/history" className="text-rose-500 text-sm font-medium">ดูทั้งหมด →</Link>
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
                        <p className="text-gray-400 text-xs">{t.date}{t.note ? ` · ${cleanNote(t.note)}` : ''}</p>
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
