'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TransactionType, PaymentMethod, INCOME_CATEGORIES, EXPENSE_CATEGORIES, Category } from '@/lib/types'
import { format } from 'date-fns'

export default function AddPage() {
  const router = useRouter()
  const [type, setType] = useState<TransactionType>('รายรับ')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState<Category>(INCOME_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('เงินสด')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const categories = type === 'รายรับ' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function handleTypeChange(t: TransactionType) {
    setType(t)
    setCategory(t === 'รายรับ' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(amount.replace(/,/g, ''))
    if (!amountNum || amountNum <= 0) {
      setError('กรุณาใส่จำนวนเงินที่ถูกต้อง')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, category, amount: amountNum, paymentMethod, note }),
      })

      if (!res.ok) throw new Error('Failed')
      router.push('/')
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSubmitting(false)
    }
  }

  const isIncome = type === 'รายรับ'

  return (
    <div className="min-h-full bg-[#f7ede4]">
      {/* Header */}
      <div className={`px-4 pt-12 pb-6 ${isIncome ? 'bg-green-700' : 'bg-red-700'} text-white`}>
        <h1 className="text-2xl font-bold">เพิ่มรายการ</h1>
        <p className="text-sm opacity-75 mt-1">บันทึกรายรับหรือรายจ่ายใหม่</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Type Toggle */}
        <div className="bg-white rounded-2xl p-1 flex gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => handleTypeChange('รายรับ')}
            className={`flex-1 py-3 rounded-xl font-semibold text-base transition-all ${
              isIncome ? 'bg-green-600 text-white shadow-sm' : 'text-gray-400'
            }`}
          >
            💰 รายรับ
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('รายจ่าย')}
            className={`flex-1 py-3 rounded-xl font-semibold text-base transition-all ${
              !isIncome ? 'bg-red-600 text-white shadow-sm' : 'text-gray-400'
            }`}
          >
            💸 รายจ่าย
          </button>
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
              className="flex-1 text-3xl font-bold text-gray-800 border-none outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2">ช่องทาง</label>
          <div className="flex gap-2">
            {(['เงินสด', 'KBank'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  paymentMethod === m
                    ? 'bg-sky-100 border-sky-400 text-sky-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {m === 'เงินสด' ? '💵 เงินสด' : '🏦 KBank'}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-2">หมวดหมู่</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium text-left transition-all border ${
                  category === cat
                    ? isIncome
                      ? 'bg-green-50 border-green-500 text-green-800'
                      : 'bg-red-50 border-red-500 text-red-800'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm text-gray-500 mb-1">วันที่</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full text-base text-gray-800 border-none outline-none bg-transparent"
          />
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

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-opacity ${
            isIncome ? 'bg-green-600' : 'bg-red-600'
          } ${submitting ? 'opacity-50' : 'active:opacity-90'}`}
        >
          {submitting ? 'กำลังบันทึก...' : `บันทึก${type}`}
        </button>
      </form>
    </div>
  )
}
