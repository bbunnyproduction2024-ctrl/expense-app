'use client'

import { useEffect, useState } from 'react'
import { Bill, BillType, PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, THAI_MONTHS_SHORT } from '@/lib/types'
import { billCycleEntries, yearlyCycleEntries, cyclesOf, CycleEntry } from '@/lib/billCycles'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const { thisCycle: CYCLE, prevCycle: PREV_CYCLE, nextCycle: NEXT_CYCLE } = cyclesOf(new Date())
const TYPES: BillType[] = ['monthly', 'yearly', 'once']

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

// บิลรายปี: เดือนที่ตรงกับเดือนครบกำหนดจริงของบิลนั้น ถือเป็นการจ่ายเงินจริง (ต้องเลือกช่องทาง/บันทึกรายจ่าย)
// ส่วนเดือนอื่นๆที่ติ๊กไว้ล่วงหน้าเป็นแค่เช็กลิสต์ "เก็บเงินไว้แล้ว" ไม่มีเงินเข้าออกจริง
function yearlyNeedsPayment(b: Bill, cycle: string): boolean {
  return b.type === 'yearly' && Number(cycle.split('-')[1]) === b.dueMonth
}

// ค่าเริ่มต้นวันที่จ่าย = วันนี้เสมอ ไม่ว่าจะจ่ายรอบไหน — เงินออกจากบัญชีจริงวันที่กดจ่าย
// ธนาคารไม่ย้อนลงวันที่ให้ ต่อให้เป็นการจ่ายบิลที่ค้างมาจากเดือนก่อนก็ตาม (cycle ใช้แค่ผูกว่าเป็นของรอบไหน) — แก้เองได้ในฟอร์มถ้าต้องการ
function defaultPayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [type, setType] = useState<BillType>('monthly')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [dueMonth, setDueMonth] = useState('1')
  const [months, setMonths] = useState('1')
  const [account, setAccount] = useState<PaymentMethod>('KBank')
  const [note, setNote] = useState('')

  // ยืนยันก่อนจ่าย: แก้ยอดจริง + เลือกบัญชีที่จ่ายได้ (ที่กันไว้เป็นแค่ยอดเผื่อ แต่ละเดือนไม่เท่ากัน)
  // คีย์ด้วย "billId:cycle" เพราะบิลเดียวอาจค้างได้หลายเดือน (เดือนที่แล้ว + เดือนนี้) พร้อมกัน
  const [payingKey, setPayingKey] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payAccount, setPayAccount] = useState<PaymentMethod>('KBank')
  const [payDate, setPayDate] = useState('')

  async function fetchData() {
    setLoading(true)
    try {
      const d = await fetch('/api/bills').then((r) => r.json())
      setBills(Array.isArray(d) ? d : [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchData()
  }, [])

  function resetForm() {
    setEditId(null)
    setType('monthly')
    setName('')
    setAmount('')
    setDueDay('1')
    setDueMonth('1')
    setMonths('1')
    setAccount('KBank')
    setNote('')
  }
  function startEdit(b: Bill) {
    setPayingKey(null)
    setEditId(b.id)
    setType(b.type)
    setName(b.name)
    setAmount(String(b.amount))
    setDueDay(String(b.dueDay))
    setDueMonth(String(b.dueMonth || 1))
    setMonths(String(b.months || 1))
    setAccount(b.account)
    setNote(b.note)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    const amt = parseFloat(amount.replace(/,/g, ''))
    const day = parseInt(dueDay) || 1
    const dmonth = parseInt(dueMonth) || 1
    const mths = Math.max(1, parseInt(months) || 1)
    if (!name.trim() || !amt || amt <= 0) return
    if (type === 'monthly' && (day < 1 || day > 31)) return
    setBusy('save')
    try {
      const payload = { name: name.trim(), amount: amt, dueDay: day, dueMonth: dmonth, months: mths, account, note: note.trim(), type }
      if (editId) {
        await fetch('/api/bills/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIndex: parseInt(editId), ...payload }),
        })
      } else {
        await fetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      resetForm()
      await fetchData()
    } finally {
      setBusy(null)
    }
  }

  function openPay(b: Bill, cycle: string) {
    setPayingKey(payingKeyOf(b.id, cycle))
    setPayAmount(String(b.amount))
    setPayAccount(b.account)
    setPayDate(defaultPayDate())
  }

  // รายเดือน = จ่ายจริง บันทึกรายจ่ายอัตโนมัติเสมอ
  // รายปี = เดือนที่ครบกำหนดจริงก็บันทึกรายจ่ายจริงเหมือนกัน ส่วนเดือนอื่นเป็นแค่เช็กลิสต์ "เก็บเดือนนี้แล้ว" ไม่บันทึกรายจ่าย
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
          recordExpense: b.type === 'monthly' || yearlyNeedsPayment(b, cycle),
        }),
      })
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
  // ยังไม่จ่าย+รายเดือน หรือ รายปีเดือนที่ครบกำหนดจริง -> เปิดช่องยืนยันยอด/ช่องทางจ่าย
  // ยังไม่จ่าย+รายปีเดือนอื่น -> ติ๊กตรงๆ (แค่เช็กลิสต์ ไม่มีเงินจริง ไม่ต้องเลือกช่องทาง)
  function handleCycleClick(b: Bill, cycle: string, isPaid: boolean) {
    if (isPaid) return setPaid(b, cycle, false)
    if (b.type === 'yearly' && !yearlyNeedsPayment(b, cycle)) return setPaid(b, cycle, true)
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
      if (editId === b.id) resetForm()
      await fetchData()
    } finally {
      setBusy(null)
    }
  }

  // ยอดกันไว้รวมต่อเดือน (สำหรับ header) — รายเดือนที่ค้างทั้งเดือนที่แล้ว+เดือนนี้ นับกันไว้ 2 เท่า
  const curMonthNo = new Date().getMonth() + 1
  const monthlyReserve = bills.reduce((s, b) => {
    if (b.type === 'yearly') return s + b.amount / (((b.dueMonth - curMonthNo - 1 + 12) % 12) + 1)
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
        {/* ฟอร์มเพิ่ม / แก้ไข */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-600">{editId ? 'แก้ไข' : 'เพิ่มใหม่'}</p>

          <div className="flex gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 min-w-0 px-1 py-2 rounded-xl text-xs font-semibold border tracking-tight ${
                  type === t ? 'bg-slate-100 border-slate-400 text-slate-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                {t === 'monthly' ? 'รายเดือน' : t === 'yearly' ? 'รายปี' : 'เก็บก้อน'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">
            {type === 'monthly' && 'จ่ายทุกเดือน — กันเต็มจำนวนจนกว่าจะกดจ่าย'}
            {type === 'yearly' && 'ใส่ยอดต่อปี + เดือนที่จ่าย — ระบบเฉลี่ยกันไว้ให้พอดีวันครบกำหนด'}
            {type === 'once' && 'เก็บก้อนไว้จ่ายทีเดียว — เลือกได้ว่าจะเก็บกี่เดือน กันไว้จนกดว่าใช้แล้ว'}
          </p>

          <input
            type="text"
            placeholder={
              type === 'once' ? 'ชื่อ เช่น เก็บซื้อเมล็ดกาแฟ' : 'ชื่อ เช่น ค่าเช่า, ประกันรายปี'
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">
                {type === 'yearly' ? 'ยอดต่อปี (บาท)' : 'จำนวนเงิน (บาท)'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
              />
            </div>
            {type === 'monthly' && (
              <div className="w-28">
                <label className="block text-xs text-gray-400 mb-1">ครบกำหนดวันที่</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
                />
              </div>
            )}
            {type === 'yearly' && (
              <div className="w-28">
                <label className="block text-xs text-gray-400 mb-1">เดือนที่จ่าย</label>
                <select
                  value={dueMonth}
                  onChange={(e) => setDueMonth(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-2 py-2 outline-none focus:border-slate-400 bg-white"
                >
                  {THAI_MONTHS_SHORT.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {type === 'once' && (
              <div className="w-28">
                <label className="block text-xs text-gray-400 mb-1">เก็บกี่เดือน</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
                />
              </div>
            )}
          </div>
          {type === 'yearly' && amount && (() => {
            const cur = new Date().getMonth() + 1
            const dm = parseInt(dueMonth) || 1
            const monthsLeft = ((dm - cur - 1 + 12) % 12) + 1
            const annual = parseFloat(amount.replace(/,/g, '')) || 0
            return (
              <p className="text-[11px] text-slate-500">
                จ่าย {THAI_MONTHS_SHORT[dm - 1]} · อีก {monthsLeft} เดือน → กันไว้เดือนละ ฿{fmt(annual / monthsLeft)}
              </p>
            )
          })()}
          {type === 'once' && amount && (() => {
            const mths = Math.max(1, parseInt(months) || 1)
            const total = parseFloat(amount.replace(/,/g, '')) || 0
            return (
              <p className="text-[11px] text-slate-500">
                {mths === 1 ? 'กันเต็มจำนวนทันที' : `เก็บ ${mths} เดือน → กันไว้เดือนละ ฿${fmt(total / mths)}`}
              </p>
            )
          })()}
          <div>
            <label className="block text-xs text-gray-400 mb-1">บัญชี</label>
            <div className="flex gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAccount(m)}
                  className={`flex-1 min-w-0 px-1 py-2 rounded-xl text-xs font-semibold border tracking-tight ${
                    account === m ? 'bg-slate-100 border-slate-400 text-slate-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder="หมายเหตุ (ไม่บังคับ)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
          />
          <div className="flex gap-2 justify-end">
            {editId && (
              <button onClick={resetForm} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg">
                ยกเลิก
              </button>
            )}
            <button
              onClick={save}
              disabled={busy === 'save'}
              className="px-4 py-1.5 bg-slate-600 text-white text-xs rounded-lg font-semibold disabled:opacity-50"
            >
              {busy === 'save' ? 'กำลังบันทึก...' : editId ? 'บันทึกการแก้ไข' : 'เพิ่ม'}
            </button>
          </div>
        </div>

        {/* รายการ */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ยังไม่มีรายการ</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {sorted.map((b) => {
              const done = b.type === 'once' && b.done
              const curMonth = new Date().getMonth() + 1
              const monthsLeft = ((b.dueMonth - curMonth - 1 + 12) % 12) + 1
              const yearlyPerMonth = b.amount / monthsLeft
              const onceMonths = Math.max(1, b.months || 1)
              const oncePerMonth = b.amount / onceMonths
              const perMonthCol = b.type === 'yearly' ? yearlyPerMonth : b.type === 'once' && onceMonths > 1 ? oncePerMonth : b.amount
              const showPerMonth = b.type === 'yearly' || (b.type === 'once' && onceMonths > 1)

              // รายเดือน/รายปี: รอบที่ยังค้างติ๊ก (เดือนที่แล้ว + เดือนนี้ แยกกันคนละปุ่ม) — ถ้าติ๊กครบถือว่ากำลังกันไว้ล่วงหน้า
              const cycleEntries: CycleEntry[] =
                b.type === 'monthly'
                  ? billCycleEntries(b, CYCLE, PREV_CYCLE, NEXT_CYCLE)
                  : b.type === 'yearly'
                    ? yearlyCycleEntries(b, new Date(), CYCLE, PREV_CYCLE, NEXT_CYCLE)
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
                        onClick={() => handleCycleClick(b, singleCycle, caughtUp)}
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
                      <p className={`font-medium text-sm truncate ${strike ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {b.name}
                      </p>
                      <p className="text-gray-400 text-xs truncate">
                        {b.type === 'monthly' && `รายเดือน · ครบกำหนดวันที่ ${b.dueDay}${caughtUp ? ' · จ่ายแล้ว' : ''}`}
                        {b.type === 'yearly' &&
                          `รายปี ฿${fmt(b.amount)} · จ่าย ${THAI_MONTHS_SHORT[b.dueMonth - 1]} · อีก ${monthsLeft} เดือน${caughtUp ? ' · เก็บเดือนนี้แล้ว ✓' : ''}`}
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
                    <button onClick={() => startEdit(b)} className="text-gray-300 hover:text-blue-400 text-base mr-1 flex-shrink-0">
                      ✏️
                    </button>
                    <button onClick={() => remove(b)} disabled={busy === b.id} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">
                      🗑
                    </button>
                  </div>

                  {payingCycleForThisBill && (
                    <div className="px-4 pb-3 pt-1 bg-blue-50 border-t border-blue-100 space-y-2.5">
                      <p className="text-[11px] text-blue-500">
                        ยืนยันยอดที่จ่ายจริงของ{cycleLabel(payingCycleForThisBill)} (ที่กันไว้เป็นแค่ยอดเผื่อ แก้ได้ถ้าไม่เท่าเดิม)
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-500 w-16 flex-shrink-0">ยอดจ่าย ฿</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-500 w-16 flex-shrink-0">วันที่จ่าย</span>
                        <input
                          type="date"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                          className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 outline-none focus:border-blue-500 bg-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-blue-500 block mb-1">จ่ายจากบัญชี</span>
                        <div className="flex gap-1.5">
                          {PAYMENT_METHODS.map((m) => (
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
                          {busy === payingKeyOf(b.id, payingCycleForThisBill) ? 'กำลังบันทึก...' : 'ยืนยันจ่ายแล้ว'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 px-1 leading-relaxed">
          <b>รายเดือน</b>: กด ○→✓ เมื่อจ่ายบิลรอบนั้นแล้ว — ระบบจะ<b>บันทึกรายจ่ายให้อัตโนมัติ</b>
          (หมวด &quot;ชำระบิล&quot;) แล้วเริ่มกันเงินไว้จ่ายบิลเดือนหน้าต่อทันที <b>ไม่ต้องไปบันทึกรายจ่ายซ้ำเองอีก</b> &nbsp;·&nbsp;
          <b>รายปี</b>: เฉลี่ยยอดต่อปี ÷ เดือนที่เหลือถึงเดือนจ่าย และมีปุ่มติ๊ก &quot;เก็บเดือนนี้แล้ว&quot; เป็นเช็กลิสต์ (ไม่บันทึกรายจ่าย) &nbsp;·&nbsp;
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
