'use client'

/**
 * วงล้อสรุป — วงนอก = รายรับ vs รายจ่าย, วงใน = แยกตามหมวด
 * สีของหมวดคงที่ (map ตามชื่อหมวด) เพื่อไม่ให้สลับสีเมื่อยอดเปลี่ยน
 */

export interface WheelSlice {
  label: string
  amount: number
}

const CATEGORY_COLORS: Record<string, string> = {
  // กลุ่มรวม (วงล้อ "อื่นๆ")
  'รายรับ Hop & Sip': '#16a34a',
  'รายรับ อื่นๆ': '#0891b2',
  รายจ่าย: '#b91c1c',
  // รายรับ
  'ร้าน Hop & Sip': '#16a34a',
  'ห้องพัก/Guesthouse': '#14b8a6',
  Mom_Jay: '#65a30d',
  'อื่นๆ (รายรับ)': '#0891b2',
  // รายจ่าย
  'ค่าพนักงาน/เงินเดือน': '#dc2626',
  'วัตถุดิบร้าน Hop & Sip': '#d97706',
  'อุปกรณ์ร้าน Hop & Sip': '#b45309',
  'อาหาร/เครื่องดื่ม': '#db2777',
  'ค่าสัตว์เลี้ยง': '#f97316',
  'ค่าน้ำมันรถ': '#a16207',
  'ค่าใช้จ่ายในครอบครัว': '#2563eb',
  'ค่าสาธารณูปโภค': '#0d9488',
  ออมเงิน: '#7c3aed',
  Entertainment: '#9333ea',
  'อื่นๆ (รายจ่าย)': '#64748b',
  'อื่นๆ': '#94a3b8',
}
const FALLBACK = '#94a3b8'
const INCOME_RING = '#15803d'
const EXPENSE_RING = '#b91c1c'

function colorFor(label: string) {
  return CATEGORY_COLORS[label] ?? FALLBACK
}

function baht(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// รวมหมวดเล็กๆ เป็น "อื่นๆ" ให้เหลือไม่เกิน maxN ชิ้น
function collapse(slices: WheelSlice[], maxN = 5): WheelSlice[] {
  const sorted = [...slices].filter((s) => s.amount > 0).sort((a, b) => b.amount - a.amount)
  if (sorted.length <= maxN) return sorted
  const head = sorted.slice(0, maxN - 1)
  const rest = sorted.slice(maxN - 1).reduce((s, x) => s + x.amount, 0)
  return [...head, { label: 'อื่นๆ', amount: rest }]
}

const SIZE = 168
const CX = SIZE / 2
const RING_W = 17

function Arc({
  r,
  startFrac,
  frac,
  color,
}: {
  r: number
  startFrac: number
  frac: number
  color: string
}) {
  const c = 2 * Math.PI * r
  const gap = frac > 0.025 ? 0.006 : 0
  const len = Math.max((frac - gap) * c, 0.0001)
  return (
    <circle
      cx={CX}
      cy={CX}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={RING_W}
      strokeDasharray={`${len} ${c - len}`}
      strokeDashoffset={-startFrac * c}
      transform={`rotate(-90 ${CX} ${CX})`}
    />
  )
}

function LegendRow({ label, amount, grand }: { label: string; amount: number; grand: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: colorFor(label) }} />
      <span className="text-gray-600 flex-1 min-w-0 truncate">{label}</span>
      <span className="text-gray-400">{grand ? Math.round((amount / grand) * 100) : 0}%</span>
      <span className="text-gray-700 font-medium w-20 text-right">฿{baht(amount)}</span>
    </div>
  )
}

export default function WheelSummary({
  title,
  subtitle,
  income,
  expense,
  incomeSlices,
  expenseSlices,
  centerCaption,
}: {
  title: string
  subtitle?: string
  income: number
  expense: number
  incomeSlices: WheelSlice[]
  expenseSlices: WheelSlice[]
  centerCaption: string
}) {
  const grand = income + expense
  const net = income - expense
  const incCol = collapse(incomeSlices)
  const expCol = collapse(expenseSlices)

  // วงใน: หมวดรายรับเรียงในช่วง [0, income/grand], หมวดรายจ่ายต่อจากนั้น
  const innerArcs: { r: number; startFrac: number; frac: number; color: string }[] = []
  let cursor = 0
  for (const s of incCol) {
    const frac = grand ? s.amount / grand : 0
    innerArcs.push({ r: 52, startFrac: cursor, frac, color: colorFor(s.label) })
    cursor += frac
  }
  cursor = grand ? income / grand : 0
  for (const s of expCol) {
    const frac = grand ? s.amount / grand : 0
    innerArcs.push({ r: 52, startFrac: cursor, frac, color: colorFor(s.label) })
    cursor += frac
  }

  const incFrac = grand ? income / grand : 0

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        {subtitle && <span className="text-gray-400 text-xs">{subtitle}</span>}
      </div>

      {grand === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลเดือนนี้</div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                {/* วงนอก: รับ / จ่าย */}
                <Arc r={74} startFrac={0} frac={incFrac} color={INCOME_RING} />
                <Arc r={74} startFrac={incFrac} frac={1 - incFrac} color={EXPENSE_RING} />
                {/* วงใน: หมวด */}
                {innerArcs.map((a, i) => (
                  <Arc key={i} {...a} />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-gray-400">{centerCaption}</span>
                <span
                  className={`text-base font-bold ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}
                >
                  {net >= 0 ? '+' : '-'}฿{baht(Math.abs(net))}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: INCOME_RING }} />
                <span className="text-gray-500 flex-1">รายรับ</span>
                <span className="text-gray-700 font-semibold">฿{baht(income)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: EXPENSE_RING }} />
                <span className="text-gray-500 flex-1">รายจ่าย</span>
                <span className="text-gray-700 font-semibold">฿{baht(expense)}</span>
              </div>
            </div>
          </div>

          {/* legend หมวด — แยกกลุ่มรายรับ / รายจ่าย */}
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {incCol.length > 0 && (
              <p className="text-[11px] font-semibold text-green-700/70">รายรับ</p>
            )}
            {incCol.map((s, i) => (
              <LegendRow key={`i${i}`} label={s.label} amount={s.amount} grand={grand} />
            ))}
            {expCol.length > 0 && (
              <p className="text-[11px] font-semibold text-red-700/70 pt-1">รายจ่าย</p>
            )}
            {expCol.map((s, i) => (
              <LegendRow key={`e${i}`} label={s.label} amount={s.amount} grand={grand} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
