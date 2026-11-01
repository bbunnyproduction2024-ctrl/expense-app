'use client'

import { useRouter } from 'next/navigation'
import BillForm from '@/components/BillForm'

export default function NewBillPage() {
  const router = useRouter()

  return (
    <div className="min-h-full bg-[#f7ede4] overflow-x-hidden">
      <div className="px-4 pt-12 pb-6 bg-slate-700 text-white flex items-center gap-2">
        <button onClick={() => router.push('/bills')} className="text-white/80 text-sm">
          ‹ กลับ
        </button>
        <h1 className="text-xl font-bold">เพิ่มบิลใหม่</h1>
      </div>

      <div className="px-4 py-4">
        <BillForm onDone={() => router.push('/bills')} />
      </div>
    </div>
  )
}
