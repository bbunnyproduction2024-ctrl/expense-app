import { Bill, Transaction } from './types'

export interface OutstandingBill {
  name: string
  amount: number
  due: string // yyyy-MM-dd
  cycle: string // yyyy-MM
}

export interface DailyBudget {
  spendable: number // ยอดคงเหลือ KBank + เงินสด (สุทธิทั้งหมด)
  billsDue: number // บิลค้างจ่าย (งวดถัดไปของแต่ละบิล)
  ingredientReserve: number // กันไว้ซื้อวัตถุดิบร้าน
  free: number // เหลือหลังหักบิล + วัตถุดิบ
  daysLeft: number
  perDay: number
  horizon: string // yyyy-MM-dd วันสิ้นสุดที่ใช้หาร
  avgIngredient: number
  spentIngredientThisMonth: number
  outstanding: OutstandingBill[]
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function clampDueDate(cycle: string, day: number): string {
  const [y, m] = cycle.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${cycle}-${String(Math.min(day, last)).padStart(2, '0')}`
}

export function computeDailyBudget(
  txns: Transaction[],
  bills: Bill[],
  today: Date = new Date()
): DailyBudget {
  const net = (f: (t: Transaction) => boolean) =>
    txns.filter(f).reduce((s, t) => s + (t.type === 'รายรับ' ? t.amount : -t.amount), 0)

  const spendable = net((t) => t.paymentMethod === 'KBank') + net((t) => t.paymentMethod === 'เงินสด')

  const y = today.getFullYear()
  const mo = today.getMonth() // 0-based
  const thisCycle = `${y}-${String(mo + 1).padStart(2, '0')}`
  const nextCycle = `${mo === 11 ? y + 1 : y}-${String(((mo + 1) % 12) + 1).padStart(2, '0')}`

  // ---- งบวัตถุดิบร้าน: เฉลี่ยจากเดือนก่อนๆ − ที่ซื้อไปแล้วเดือนนี้ ----
  const rawByMonth = new Map<string, number>()
  txns.forEach((t) => {
    if (t.type === 'รายจ่าย' && t.category === 'วัตถุดิบร้าน Hop & Sip') {
      const m = t.date.slice(0, 7)
      rawByMonth.set(m, (rawByMonth.get(m) ?? 0) + t.amount)
    }
  })
  const past = [...rawByMonth.entries()].filter(([m]) => m < thisCycle).map(([, v]) => v)
  const avgIngredient = past.length
    ? past.reduce((s, v) => s + v, 0) / past.length
    : rawByMonth.get(thisCycle) ?? 0
  const spentIngredientThisMonth = rawByMonth.get(thisCycle) ?? 0
  const ingredientReserve = Math.max(0, avgIngredient - spentIngredientThisMonth)

  // ---- บิลค้างจ่าย: งวดถัดไปของแต่ละบิล ----
  // ยังไม่จ่ายเดือนนี้ -> ค้าง (งวดเดือนนี้) ; จ่ายเดือนนี้แล้ว -> กันงวดเดือนหน้า
  const outstanding: OutstandingBill[] = []
  for (const b of bills) {
    if (!b.paidCycles.includes(thisCycle)) {
      outstanding.push({ name: b.name, amount: b.amount, due: clampDueDate(thisCycle, b.dueDay), cycle: thisCycle })
    } else if (!b.paidCycles.includes(nextCycle)) {
      outstanding.push({ name: b.name, amount: b.amount, due: clampDueDate(nextCycle, b.dueDay), cycle: nextCycle })
    }
  }
  const billsDue = outstanding.reduce((s, b) => s + b.amount, 0)

  // ---- วันที่เหลือ: ถึงสิ้นเดือนนี้ หรือบิลค้างที่ไกลสุด (แล้วแต่อันไหนช้ากว่า) ----
  const startOfToday = new Date(y, mo, today.getDate())
  let horizon = new Date(y, mo + 1, 0) // สิ้นเดือนนี้
  for (const b of outstanding) {
    const d = new Date(`${b.due}T00:00:00`)
    if (d > horizon) horizon = d
  }
  const daysLeft = Math.max(1, Math.ceil((horizon.getTime() - startOfToday.getTime()) / 86400000))

  const free = spendable - billsDue - ingredientReserve
  const perDay = Math.max(0, free) / daysLeft

  return {
    spendable,
    billsDue,
    ingredientReserve,
    free,
    daysLeft,
    perDay,
    horizon: ymd(horizon),
    avgIngredient,
    spentIngredientThisMonth,
    outstanding,
  }
}
