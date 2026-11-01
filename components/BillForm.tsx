'use client'

import { useState } from 'react'
import { Bill, BillType, PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, THAI_MONTHS_SHORT } from '@/lib/types'

const TYPES: BillType[] = ['monthly', 'yearly', 'once']

export default function BillForm({ initialBill, onDone }: { initialBill?: Bill; onDone: () => void }) {
  const [type, setType] = useState<BillType>(initialBill?.type ?? 'monthly')
  const [name, setName] = useState(initialBill?.name ?? '')
  const [amount, setAmount] = useState(initialBill ? String(initialBill.amount) : '')
  const [dueDay, setDueDay] = useState(String(initialBill?.dueDay ?? 1))
  const [dueMonth, setDueMonth] = useState(String(initialBill?.dueMonth || 1))
  const [months, setMonths] = useState(String(initialBill?.months || 1))
  const [account, setAccount] = useState<PaymentMethod>(initialBill?.account ?? 'KBank')
  const [note, setNote] = useState(initialBill?.note ?? '')
  const [savedCredit, setSavedCredit] = useState(String(initialBill?.savedCredit || 0))
  const [busy, setBusy] = useState(false)

  async function save() {
    const amt = parseFloat(amount.replace(/,/g, ''))
    const day = parseInt(dueDay) || 1
    const dmonth = parseInt(dueMonth) || 1
    const mths = Math.max(1, parseInt(months) || 1)
    const credit = Math.max(0, parseFloat(savedCredit.replace(/,/g, '')) || 0)
    if (!name.trim() || !amt || amt <= 0) return
    if (type === 'monthly' && (day < 1 || day > 31)) return
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        amount: amt,
        dueDay: day,
        dueMonth: dmonth,
        months: mths,
        account,
        note: note.trim(),
        type,
        ...(type === 'yearly' ? { savedCredit: credit } : {}),
      }
      if (initialBill) {
        await fetch('/api/bills/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIndex: parseInt(initialBill.id), ...payload }),
        })
      } else {
        await fetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
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
        placeholder={type === 'once' ? 'ชื่อ เช่น เก็บซื้อเมล็ดกาแฟ' : 'ชื่อ เช่น ค่าเช่า, ประกันรายปี'}
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
      {type === 'yearly' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">ทุกกี่เดือน (ว่าง/1 = รายปีปกติ)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              placeholder="12"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">เคยเก็บไว้ก่อนหน้า (ไม่หักเงินจริง)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={savedCredit}
              onChange={(e) => setSavedCredit(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
            />
          </div>
        </div>
      )}
      {type === 'yearly' && amount && (() => {
        const cur = new Date().getMonth() + 1
        const dm = parseInt(dueMonth) || 1
        const period = parseInt(months) > 1 ? parseInt(months) : 12
        const monthsLeft = ((dm - cur - 1 + 12) % 12) + 1
        const annual = parseFloat(amount.replace(/,/g, '')) || 0
        const credit = Math.max(0, parseFloat(savedCredit.replace(/,/g, '')) || 0)
        const remaining = Math.max(0, annual - credit)
        return (
          <p className="text-[11px] text-slate-500">
            จ่าย {THAI_MONTHS_SHORT[dm - 1]} ({period === 12 ? 'รายปี' : `ทุก ${period} เดือน`}) · อีก {monthsLeft} เดือน
            {credit > 0 && ` · เก็บไว้แล้ว ฿${credit.toLocaleString('th-TH')}`} → กันไว้เดือนละ ฿
            {(remaining / monthsLeft).toLocaleString('th-TH', { maximumFractionDigits: 2 })}
          </p>
        )
      })()}
      {type === 'once' && amount && (() => {
        const mths = Math.max(1, parseInt(months) || 1)
        const total = parseFloat(amount.replace(/,/g, '')) || 0
        return (
          <p className="text-[11px] text-slate-500">
            {mths === 1 ? 'กันเต็มจำนวนทันที' : `เก็บ ${mths} เดือน → กันไว้เดือนละ ฿${(total / mths).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`}
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
        <button onClick={onDone} className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg">
          ยกเลิก
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-1.5 bg-slate-600 text-white text-xs rounded-lg font-semibold disabled:opacity-50"
        >
          {busy ? 'กำลังบันทึก...' : initialBill ? 'บันทึกการแก้ไข' : 'เพิ่ม'}
        </button>
      </div>
    </div>
  )
}
