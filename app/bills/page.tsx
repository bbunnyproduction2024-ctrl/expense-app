'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bill, BillType, PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, THAI_MONTHS_SHORT, Transaction } from '@/lib/types'
import { billCycleEntries, yearlyCycleEntries, yearlyMonthlyAmount, yearlyUnpaidWindowCount, yearlyPeriodMonths, yearlyNextDueMonth, yearlyDueCycles, cyclesOf, CycleEntry } from '@/lib/billCycles'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const { thisCycle: CYCLE, prevCycle: PREV_CYCLE, nextCycle: NEXT_CYCLE } = cyclesOf(new Date())

function cycleLabel(cycle: string) {
  if (cycle === PREV_CYCLE) return 'เดือนที่แล้ว'
  if (cycle === CYCLE) return 'เดือนนี้'
  if (cycle === NEXT_CYCLE) return 'เดือนหน้า'
  const [y, m] = cycle.split('-').map(Number)
  return `${THAI_MONTHS_SHORT[m - 1]} ${y}`
}

function payingKeyOf(billId: string, cycle: string) {
  return `${billId}:${cycle}`
}

// บิลรายเดือน -> จ่ายจริงเสมอ (expense)
// บิลรายปี รอบที่ตรงกับรอบครบกำหนดจริง (รอบล่าสุดที่ยังไม่จ่าย หรือรอบถัดไปถ้าถึงเวลาแล้ว) -> จ่ายจริงเต็มยอด (expense)
// บิลรายปี รอบอื่นๆ ระหว่างทาง -> โอนเงินจริงเข้าออมทรัพย์ทุกเดือน (transfer) ไม่ใช่แค่เช็กลิสต์อีกต่อไป
// เทียบกับรอบครบกำหนดจริงที่คำนวณสดๆ (ไม่ใช่ b.dueMonth ตรงๆ) เพราะบิลรอบสั้นกว่าปี dueMonth ที่เก็บไว้เป็นแค่จุดยึดรอบล่าสุด ไม่ใช่เดือนครบกำหนดรอบหน้าเสมอไป
function billPayMode(b: Bill, cycle: string): 'expense' | 'transfer' {
  if (b.type !== 'yearly') return 'expense'
  const { lastDue, nextDue } = yearlyDueCycles(b, new Date())
  return cycle === lastDue || cycle === nextDue ? 'expense' : 'transfer'
}

// ค่าเริ่มต้นวันที่จ่าย = วันนี้เสมอ ไม่ว่าจะจ่ายรอบไหน — เงินออกจากบัญชีจริงวันที่กดจ่าย
// ธนาคารไม่ย้อนลงวันที่ให้ ต่อให้เป็นการจ่ายบิลที่ค้างมาจากเดือนก่อนก็ตาม (cycle ใช้แค่ผูกว่าเป็นของรอบไหน) — แก้เองได้ในฟอร์มถ้าต้องการ
function defaultPayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function BillsPage() {
  const router = useRouter()
  const [bills, setBills] = useState<Bill[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // ยืนยันก่อนจ่าย: แก้ยอดจริง + เลือกบัญชีที่จ่ายได้ (ที่กันไว้เป็นแค่ยอดเผื่อ แต่ละเดือนไม่เท่ากัน)
  // คีย์ด้วย "billId:cycle" เพราะบิลเดียวอาจค้างได้หลายเดือน (เดือนที่แล้ว + เดือนนี้) พร้อมกัน
  const [payingKey, setPayingKey] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payAccount, setPayAccount] = useState<PaymentMethod>('KBank')
  const [payDate, setPayDate] = useState('')

  async function fetchData() {
    setLoading(true)
    try {
      const [d, t] = await Promise.all([
        fetch('/api/bills').then((r) => r.json()),
        fetch('/api/transactions').then((r) => r.json()),
      ])
      setBills(Array.isArray(d) ? d : [])
      setTransactions(Array.isArray(t) ? t : [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchData()
  }, [])

  function openPay(b: Bill, cycle: string) {
    const mode = billPayMode(b, cycle)
    setPayingKey(payingKeyOf(b.id, cycle))
    setPayAmount(mode === 'transfer' ? String(Math.round(yearlyMonthlyAmount(b, transactions, new Date()) * 100) / 100) : String(b.amount))
    setPayAccount(mode === 'transfer' && b.account === 'ออมทรัพย์' ? 'KBank' : b.account)
    setPayDate(defaultPayDate())
  }

  // รายเดือน และ รายปีเดือนที่ครบกำหนดจริง = จ่ายจริง บันทึกรายจ่ายอัตโนมัติ (หมวด "ชำระบิล")
  // รายปีเดือนอื่นๆ = โอนเงินจริงเข้าออมทรัพย์ทุกเดือน (เก็บล่วงหน้า สะสมไปเรื่อยๆ)
  async function setPaid(
    b: Bill,
    cycle: string,
    paid: boolean,
    overrideAmount?: number,
    overrideAccount?: string,
    overrideDate?: string
  ) {
    const key = payingKeyOf(b.id, cycle)
    setBusy(key)
    try {
      const mode = billPayMode(b, cycle)
      await fetch('/api/bills/paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: parseInt(b.id),
          cycle,
          paid,
          amount: overrideAmount,
          account: overrideAccount,
          date: overrideDate,
          mode,
        }),
      })
      // จ่ายบิลรายปีจริงตอนครบกำหนดแล้ว -> เลื่อนจุดยึด dueMonth ให้ตรงกับเดือนของรอบที่เพิ่งจ่ายไป
      // (ปกติบิลรอบ 12 เดือนจะได้เดือนเดิม ไม่กระทบอะไร — มีผลจริงเฉพาะบิลที่ตั้งรอบสั้นกว่าปี เช่น ทุก 3/5 เดือน
      // ที่เดือนครบกำหนดหมุนไปเรื่อยๆ ไม่ใช่เดือนเดิมทุกรอบ — ไม่ใช่ "+จำนวนเดือนในรอบ" แต่คือเดือนของ cycle ที่เพิ่งจ่ายจริงนี้เอง)
      if (paid && mode === 'expense' && b.type === 'yearly') {
        const newDueMonth = Number(cycle.split('-')[1])
        if (newDueMonth !== b.dueMonth) {
          await fetch('/api/bills/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rowIndex: parseInt(b.id), dueMonth: newDueMonth }),
          })
        }
      }
      setPayingKey(null)
      await fetchData()
    } finally {
      setBusy(null)
    }
  }

  async function confirmPay(b: Bill, cycle: string) {
    const amt = parseFloat(payAmount.replace(/,/g, ''))
    if (!amt || amt <= 0) return
    await setPaid(b, cycle, true, amt, payAccount, payDate || undefined)
  }

  // กดวงกลม/ชิปของบิลรายเดือน-รายปี: จ่ายแล้ว -> ยกเลิกตรงๆ
  // ยังไม่จ่าย (ไม่ว่ารายเดือนหรือรายปี เดือนไหนก็ตาม) -> เปิดช่องยืนยันยอด/ช่องทาง เพราะมีเงินเข้าออกจริงทุกเดือนแล้ว
  function handleCycleClick(b: Bill, cycle: string, isPaid: boolean) {
    if (isPaid) return setPaid(b, cycle, false)
    const key = payingKeyOf(b.id, cycle)
    return payingKey === key ? setPayingKey(null) : openPay(b, cycle)
  }

  async function toggleDone(b: Bill) {
    setBusy(b.id)
    try {
      await fetch('/api/bills/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: parseInt(b.id), done: !b.done }),
      })
      await fetchData()
    } finally {
      setBusy(null)
    }
  }

  async function remove(b: Bill) {
    if (!confirm(`ลบ "${b.name}" ใช่ไหม?`)) return
    setBusy(b.id)
    try {
      await fetch('/api/bills/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: parseInt(b.id) }),
      })
      await fetchData()
    } finally {
      setBusy(null)
    }
  }

  // ยอดกันไว้รวมต่อเดือน (สำหรับ header) — รายเดือนที่ค้างทั้งเดือนที่แล้ว+เดือนนี้ นับกันไว้ 2 เท่า
  const monthlyReserve = bills.reduce((s, b) => {
    if (b.type === 'yearly') return s + yearlyMonthlyAmount(b, transactions, new Date())
    if (b.type === 'once') return b.done ? s : s + b.amount / Math.max(1, b.months || 1)
    return s + billCycleEntries(b, CYCLE, PREV_CYCLE, NEXT_CYCLE).reduce((sum, e) => sum + e.amount, 0)
  }, 0)

  const order: Record<BillType, number> = { monthly: 0, yearly: 1, once: 2 }
  const sorted = [...bills].sort((a, b) => order[a.type] - order[b.type] || a.dueDay - b.dueDay)

  return (
    <div className="min-h-full bg-[#f7ede4] overflow-x-hidden">
      <div className="px-4 pt-12 pb-6 bg-slate-700 text-white">
        <h1 className="text-2xl font-bold">บิลประจำ / เงินกันไว้</h1>
        <p className="text-sm opacity-75 mt-1">กันเงินไว้รวม ~฿{fmt(monthlyReserve)} ต่อเดือน</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <button
          onClick={() => router.push('/bills/new')}
          className="w-full bg-slate-600 text-white text-sm font-semibold rounded-2xl py-3 shadow-sm"
        >
          ＋ เพิ่มบิลใหม่
        </button>

        {/* รายการ */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ยังไม่มีรายการ</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {sorted.map((b) => {
              const done = b.type === 'once' && b.done
              const monthsLeft = b.type === 'yearly' ? yearlyUnpaidWindowCount(b, new Date()) : 0
              const yearlyPerMonth = yearlyMonthlyAmount(b, transactions, new Date())
              const onceMonths = Math.max(1, b.months || 1)
              const oncePerMonth = b.amount / onceMonths
              const perMonthCol = b.type === 'yearly' ? yearlyPerMonth : b.type === 'once' && onceMonths > 1 ? oncePerMonth : b.amount
              const showPerMonth = b.type === 'yearly' || (b.type === 'once' && onceMonths > 1)

              // รายเดือน/รายปี: รอบที่ยังค้างติ๊ก (เดือนที่แล้ว + เดือนนี้ แยกกันคนละปุ่ม) — ถ้าติ๊กครบถือว่ากำลังกันไว้ล่วงหน้า
              const cycleEntries: CycleEntry[] =
                b.type === 'monthly'
                  ? billCycleEntries(b, CYCLE, PREV_CYCLE, NEXT_CYCLE)
                  : b.type === 'yearly'
                    ? yearlyCycleEntries(b, new Date())
                    : []
              const outstanding = cycleEntries.filter((e) => e.status !== 'ahead')
              const caughtUp = b.type !== 'once' && outstanding.length === 0
              const singleCycle = outstanding.length === 1 ? outstanding[0].cycle : CYCLE
              const singleKey = payingKeyOf(b.id, singleCycle)
              const strike = done // เส้นขีดฆ่าเฉพาะ "เก็บก้อน" ที่ใช้ครบแล้วจริงๆ — รายเดือน/รายปี ยังวนทุกเดือนไม่ถือว่า "จบ"
              const dim = done || caughtUp
              const payingCycleForThisBill = payingKey?.startsWith(`${b.id}:`) ? payingKey.slice(b.id.length + 1) : null

              return (
                <div key={b.id}>
                  <div className="flex items-center px-4 py-3">
                    {b.type === 'once' ? (
                      <button
                        onClick={() => toggleDone(b)}
                        disabled={busy === b.id}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-base mr-3 flex-shrink-0 border-2 ${
                          dim ? 'bg-green-100 border-green-400 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-300'
                        }`}
                        aria-label="สลับสถานะ"
                      >
                        {busy === b.id ? '⏳' : dim ? '✓' : '○'}
                      </button>
                    ) : outstanding.length > 1 ? (
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 bg-red-100 text-red-500">
                        ค้าง {outstanding.length}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          // บิลรายปีที่กันไว้ครบแล้ว (caughtUp) ไม่มีรอบเดียวที่ชัดเจนให้ยกเลิก — singleCycle จะ fallback ไปที่ CYCLE (เดือนนี้ตามปฏิทิน)
                          // ซึ่งอาจไม่ใช่รอบที่บิลนี้ติดตามจริงเลย (เช่น รอบยึดเริ่มต้นที่ตั้งไว้ตรงกับเดือนนี้พอดีโดยบังเอิญ) กดแล้วไม่ควรไปลบสถานะอะไรทิ้ง
                          if (b.type === 'yearly' && caughtUp) return
                          handleCycleClick(b, singleCycle, caughtUp)
                        }}
                        disabled={busy === singleKey}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-base mr-3 flex-shrink-0 border-2 ${
                          dim
                            ? 'bg-green-100 border-green-400 text-green-600'
                            : payingKey === singleKey
                              ? 'bg-blue-100 border-blue-400 text-blue-600'
                              : 'bg-gray-50 border-gray-200 text-gray-300'
                        }`}
                        aria-label="สลับสถานะ"
                      >
                        {busy === singleKey ? '⏳' : dim ? '✓' : '○'}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm break-words ${strike ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {b.name}
                      </p>
                      <p className="text-gray-400 text-xs break-words">
                        {b.type === 'monthly' && `รายเดือน · ครบกำหนดวันที่ ${b.dueDay}${caughtUp ? ' · จ่ายแล้ว' : ''}`}
                        {b.type === 'yearly' &&
                          `${yearlyPeriodMonths(b) === 12 ? 'รายปี' : `ทุก ${yearlyPeriodMonths(b)} เดือน`} ฿${fmt(b.amount)} · จ่าย ${THAI_MONTHS_SHORT[yearlyNextDueMonth(b, new Date()) - 1]} · อีก ${monthsLeft} เดือน${caughtUp ? ' · เก็บเดือนนี้แล้ว ✓' : ''}`}
                        {b.type === 'once' &&
                          (done
                            ? 'เก็บก้อน · ใช้แล้ว'
                            : onceMonths > 1
                              ? `เก็บก้อน ฿${fmt(b.amount)} · เก็บ ${onceMonths} เดือน`
                              : 'เก็บก้อน · กันเต็มจำนวน')}
                        {` · ${PAYMENT_METHOD_LABELS[b.account] ?? b.account}`}
                        {b.note ? ` · ${b.note}` : ''}
                      </p>
                      {outstanding.length > 1 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {outstanding.map((e) => {
                            const key = payingKeyOf(b.id, e.cycle)
                            return (
                              <button
                                key={e.cycle}
                                onClick={() => handleCycleClick(b, e.cycle, false)}
                                disabled={busy === key}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                  payingKey === key
                                    ? 'bg-blue-100 border-blue-400 text-blue-600'
                                    : e.status === 'overdue'
                                      ? 'bg-red-50 border-red-300 text-red-600'
                                      : 'bg-gray-50 border-gray-200 text-gray-500'
                                }`}
                              >
                                {busy === key ? '⏳ ' : e.status === 'overdue' ? '⚠ ' : '○ '}
                                {cycleLabel(e.cycle)}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <p className="font-semibold text-gray-700 text-sm mr-2 flex-shrink-0 text-right">
                      ฿{fmt(perMonthCol)}
                      {showPerMonth && <span className="block text-[10px] font-normal text-gray-400">/เดือน</span>}
                    </p>
                    <button onClick={() => router.push(`/bills/edit/${b.id}`)} className="text-gray-300 hover:text-blue-400 text-base mr-1 flex-shrink-0">
                      ✏️
                    </button>
                    <button onClick={() => remove(b)} disabled={busy === b.id} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">
                      🗑
                    </button>
                  </div>

                  {payingCycleForThisBill &&
                    (() => {
                      const payMode = billPayMode(b, payingCycleForThisBill)
                      const accountChoices = payMode === 'transfer' ? PAYMENT_METHODS.filter((m) => m !== 'ออมทรัพย์') : PAYMENT_METHODS
                      return (
                        <div className="px-4 pb-3 pt-1 bg-blue-50 border-t border-blue-100 space-y-2.5">
                          <p className="text-[11px] text-blue-500">
                            {payMode === 'transfer'
                              ? `ยืนยันยอดเก็บเข้าออมทรัพย์ของ${cycleLabel(payingCycleForThisBill)} (ยอดเฉลี่ยต่อเดือน แก้ได้ถ้าไม่เท่าเดิม)`
                              : `ยืนยันยอดที่จ่ายจริงของ${cycleLabel(payingCycleForThisBill)} (ที่กันไว้เป็นแค่ยอดเผื่อ แก้ได้ถ้าไม่เท่าเดิม)`}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-500 w-16 flex-shrink-0">{payMode === 'transfer' ? 'ยอดเก็บ ฿' : 'ยอดจ่าย ฿'}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-500 w-16 flex-shrink-0">วันที่{payMode === 'transfer' ? 'โอน' : 'จ่าย'}</span>
                            <input
                              type="date"
                              value={payDate}
                              onChange={(e) => setPayDate(e.target.value)}
                              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                              className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-xs text-blue-500 block mb-1">
                              {payMode === 'transfer' ? 'โอนจากบัญชี (เข้าออมทรัพย์)' : 'จ่ายจากบัญชี'}
                            </span>
                            <div className="flex gap-1.5">
                              {accountChoices.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setPayAccount(m)}
                                  className={`flex-1 min-w-0 px-1 py-1.5 rounded-lg text-xs font-semibold border tracking-tight ${
                                    payAccount === m ? 'bg-sky-100 border-sky-400 text-sky-700' : 'bg-white border-gray-200 text-gray-500'
                                  }`}
                                >
                                  {PAYMENT_METHOD_LABELS[m]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setPayingKey(null)} className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded-lg">
                              ยกเลิก
                            </button>
                            <button
                              onClick={() => confirmPay(b, payingCycleForThisBill)}
                              disabled={busy === payingKeyOf(b.id, payingCycleForThisBill)}
                              className="px-4 py-1 bg-green-600 text-white text-xs rounded-lg font-semibold disabled:opacity-50"
                            >
                              {busy === payingKeyOf(b.id, payingCycleForThisBill)
                                ? 'กำลังบันทึก...'
                                : payMode === 'transfer'
                                  ? 'ยืนยันเก็บเงินแล้ว'
                                  : 'ยืนยันจ่ายแล้ว'}
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 px-1 leading-relaxed">
          <b>รายเดือน</b>: กด ○→✓ เมื่อจ่ายบิลรอบนั้นแล้ว — ระบบจะ<b>บันทึกรายจ่ายให้อัตโนมัติ</b>
          (หมวด &quot;ชำระบิล&quot;) แล้วเริ่มกันเงินไว้จ่ายบิลเดือนหน้าต่อทันที <b>ไม่ต้องไปบันทึกรายจ่ายซ้ำเองอีก</b> &nbsp;·&nbsp;
          <b>รายปี</b>: เฉลี่ยยอดต่อปี ÷ เดือนที่เหลือถึงเดือนจ่าย — ติ๊กแต่ละเดือน<b>โอนเงินเข้าออมทรัพย์จริง</b>ตามยอดเฉลี่ย สะสมไว้
          จนถึงเดือนครบกำหนดจะให้<b>จ่ายเต็มยอดจริง</b>แทน &nbsp;·&nbsp;
          <b>เก็บก้อน</b>: เฉลี่ยตาม &quot;เก็บกี่เดือน&quot; · กด ○→✓ เมื่อใช้เงินก้อนแล้ว
          <br />
          ถ้าลืมติ๊กเดือนที่แล้ว จะมีปุ่มแยก <b>&quot;เดือนที่แล้ว&quot; กับ &quot;เดือนนี้&quot;</b> ให้ติ๊กทีละเดือน ไม่รวมเป็นก้อนเดียว
          <br />
          การ์ด &quot;ใช้ได้วันละ&quot; บนหน้าแรกจะคิดใหม่ให้อัตโนมัติ · ดูรายจ่ายที่บันทึกแล้วได้ที่หน้า &quot;รายจ่าย&quot; ในเมนูซื้อของ
        </p>
      </div>
    </div>
  )
}
