'use client'

import { useEffect, useState } from 'react'
import { Bill, PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/types'
import { format } from 'date-fns'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CYCLE = format(new Date(), 'yyyy-MM')

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // form (เพิ่ม / แก้ไข)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [account, setAccount] = useState<PaymentMethod>('KBank')
  const [note, setNote] = useState('')

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
    setName('')
    setAmount('')
    setDueDay('1')
    setAccount('KBank')
    setNote('')
  }
  function startEdit(b: Bill) {
    setEditId(b.id)
    setName(b.name)
    setAmount(String(b.amount))
    setDueDay(String(b.dueDay))
    setAccount(b.account)
    setNote(b.note)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    const amt = parseFloat(amount.replace(/,/g, ''))
    const day = parseInt(dueDay)
    if (!name.trim() || !amt || amt <= 0 || !day || day < 1 || day > 31) return
    setBusy('save')
    try {
      const payload = { name: name.trim(), amount: amt, dueDay: day, account, note: note.trim() }
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

  async function togglePaid(b: Bill) {
    const paid = b.paidCycles.includes(CYCLE)
    setBusy(b.id)
    try {
      await fetch('/api/bills/paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: parseInt(b.id), cycle: CYCLE, paid: !paid }),
      })
      await fetchData()
    } finally {
      setBusy(null)
    }
  }

  async function remove(b: Bill) {
    if (!confirm(`ลบบิล "${b.name}" ใช่ไหม?`)) return
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

  const sorted = [...bills].sort((a, b) => a.dueDay - b.dueDay)
  const totalMonth = bills.reduce((s, b) => s + b.amount, 0)
  const paidMonth = bills.filter((b) => b.paidCycles.includes(CYCLE)).reduce((s, b) => s + b.amount, 0)

  return (
    <div className="min-h-full bg-[#f7ede4] overflow-x-hidden">
      <div className="px-4 pt-12 pb-6 bg-slate-700 text-white">
        <h1 className="text-2xl font-bold">บิลประจำ</h1>
        <p className="text-sm opacity-75 mt-1">
          รวมเดือนละ ฿{fmt(totalMonth)} · จ่ายแล้วรอบนี้ ฿{fmt(paidMonth)}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ฟอร์มเพิ่ม / แก้ไข */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-600">{editId ? 'แก้ไขบิล' : 'เพิ่มบิลใหม่'}</p>
          <input
            type="text"
            placeholder="ชื่อบิล เช่น ค่าเช่า, เงินเดือนพนักงาน"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">จำนวนเงิน (บาท)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-400"
              />
            </div>
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
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">จ่ายจากบัญชี</label>
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
              {busy === 'save' ? 'กำลังบันทึก...' : editId ? 'บันทึกการแก้ไข' : 'เพิ่มบิล'}
            </button>
          </div>
        </div>

        {/* รายการบิล */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ยังไม่มีบิลประจำ</div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {sorted.map((b) => {
              const paid = b.paidCycles.includes(CYCLE)
              return (
                <div key={b.id} className="flex items-center px-4 py-3">
                  <button
                    onClick={() => togglePaid(b)}
                    disabled={busy === b.id}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-base mr-3 flex-shrink-0 border-2 ${
                      paid ? 'bg-green-100 border-green-400 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-300'
                    }`}
                    aria-label="สลับสถานะจ่ายแล้ว"
                  >
                    {busy === b.id ? '⏳' : paid ? '✓' : '○'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${paid ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {b.name}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                      ครบกำหนดวันที่ {b.dueDay} · {PAYMENT_METHOD_LABELS[b.account] ?? b.account}
                      {b.note ? ` · ${b.note}` : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-700 text-sm mr-2 flex-shrink-0">฿{fmt(b.amount)}</p>
                  <button onClick={() => startEdit(b)} className="text-gray-300 hover:text-blue-400 text-base mr-1 flex-shrink-0">
                    ✏️
                  </button>
                  <button onClick={() => remove(b)} disabled={busy === b.id} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">
                    🗑
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 px-1 leading-relaxed">
          กด ○ ให้เป็น ✓ เมื่อจ่ายบิลของรอบเดือนนี้แล้ว — การ์ด &quot;เงินใช้ได้ต่อวัน&quot; บนหน้าแรกจะคิดใหม่ให้อัตโนมัติ
          (บิลที่ยังไม่กดจ่าย จะถูกกันเงินไว้เรื่อยๆ)
        </p>
      </div>
    </div>
  )
}
