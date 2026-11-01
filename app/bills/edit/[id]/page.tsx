'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Bill } from '@/lib/types'
import BillForm from '@/components/BillForm'

export default function EditBillPage() {
  const router = useRouter()
  const params = useParams()
  const id = String(params.id)

  const [bill, setBill] = useState<Bill | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch('/api/bills')
      .then((r) => r.json())
      .then((d: Bill[]) => {
        const found = (Array.isArray(d) ? d : []).find((b) => b.id === id)
        if (found) setBill(found)
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="min-h-full bg-[#f7ede4] overflow-x-hidden">
      <div className="px-4 pt-12 pb-6 bg-slate-700 text-white flex items-center gap-2">
        <button onClick={() => router.push('/bills')} className="text-white/80 text-sm">
          ‹ กลับ
        </button>
        <h1 className="text-xl font-bold">แก้ไขบิล</h1>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : notFound || !bill ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400">ไม่พบบิลนี้</div>
        ) : (
          <BillForm initialBill={bill} onDone={() => router.push('/bills')} />
        )}
      </div>
    </div>
  )
}
