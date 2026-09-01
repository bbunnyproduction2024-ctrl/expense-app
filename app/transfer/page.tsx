'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/types'
import { format } from 'date-fns'

export default function TransferPage() {
  const router = useRouter()
  const [from, setFrom] = useState<PaymentMethod>('เงินสด')
  const [to, setTo] = useState<PaymentMethod>('KBank')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function swap() {
    setFrom(to)
    setTo(from)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(amount.replace(/,/g, ''))
    if (!amountNum || amountNum <= 0) {
      setError('กรุณาใส่จำนวนเงินที่ถูกต้อง')
      return
    }
    if (from === to) {
      setError('บัญชีต้นทางและปลายทางต้องต่างกัน')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, from, to, amount: amountNum, note }),
      })
      if (!res.ok) throw new Error('Failed')
      router.push('/')
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-[#f7ede4] overflow-x-hidden">
      <div className="px-4 pt-12 pb-6 bg-indigo-700 text-white">
        <h1 className="text-2xl font-bold">โอนเงินระหว่างบัญชี</h1>
        <p className="text-sm opacity-75 mt-1">ย้ายเงินระหว่างช่องทาง ไม่นับเป็นรายรับ/รายจ่าย</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* From / To */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div>
            <label className="block text-sm text-gray-500 mb-2">จากบัญชี</label>
            <div className="flex gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFrom(m)}
                  className={`flex-1 min-w-0 px-1 py-2.5 rounded-xl text-xs font-semibold border transition-all tracking-tight ${
                    from === m ? 'bg-rose-100 border-rose-400 text-rose-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={swap}
              className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg active:bg-indigo-100"
              aria-label="สลับบัญชี"
            >
              ⇅
            </button>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-2">ไปบัญชี</label>
            <div className="flex gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTo(m)}
                  className={`flex-1 min-w-0 px-1 py-2.5 rounded-xl text-xs font-semibold border transition-all tracking-tight ${
                    to === m ? 'bg-sky-100 border-sky-400 text-sky-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {from === to && (
            <p className="text-amber-600 text-xs">เลือกบัญชีต้นทางและปลายทางให้ต่างกัน</p>
          )}
        </div>

        {/* Amount */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">จำนวนเงิน (บาท)</label>
          <div className="flex items-center">
            <span className="text-2xl font-bold text-gray-400 mr-2">฿</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="flex-1 min-w-0 text-3xl font-bold text-gray-800 border-none outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2">วันที่</label>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0,10)) }}
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg flex-shrink-0 active:bg-gray-200">‹</button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              className="flex-1 min-w-0 text-base text-gray-800 border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-indigo-300 cursor-pointer" />
            <button type="button"
              onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0,10)) }}
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg flex-shrink-0 active:bg-gray-200">›</button>
          </div>
        </div>

        {/* Note */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input
            type="text"
            placeholder="เพิ่มรายละเอียด..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent"
          />
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting || from === to}
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-opacity bg-indigo-600 ${
            submitting || from === to ? 'opacity-50' : 'active:opacity-90'
          }`}
        >
          {submitting ? 'กำลังบันทึก...' : 'บันทึกการโอน'}
        </button>
      </form>
    </div>
  )
}
