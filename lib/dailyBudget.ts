import { Bill, Transaction } from './types'

export interface OutstandingBill {
  name: string
  amount: number
  due: string // yyyy-MM-dd
  cycle: string // yyyy-MM
}

export interface SavingsItem {
  name: string
  monthly: number // ยอดที่กันไว้ต่อเดือน (yearly = amount ÷ เดือนที่เหลือถึงกำหนด, once = amount เต็ม)
  kind: 'yearly' | 'once'
  annual?: number // ยอดต่อปี (yearly)
  dueMonth?: number // 1-12 (yearly)
  monthsUntilDue?: number // (yearly)
}

export interface DailyBudget {
  spendable: number // ยอดคงเหลือ KBank + เงินสด (สุทธิทั้งหมด)
  monthlyBillsDue: number // บิลรายเดือน งวดถัดไป
  savingsReserve: number // เก็บออม (รายปี ÷12 + เป้าหมายก้อน)
  ingredientReserve: number // กันไว้ซื้อวัตถุดิบร้าน
  free: number // เหลือหลังหักทุกอย่าง
  daysLeft: number
  perDay: number
  horizon: string // yyyy-MM-dd วันสิ้นสุดที่ใช้หาร
  avgIngredient: number
  spentIngredientThisMonth: number
  monthlyOutstanding: OutstandingBill[]
  savingsItems: SavingsItem[]
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

  // ---- บิล / เงินกันไว้ ----
  const monthlyOutstanding: OutstandingBill[] = []
  const savingsItems: SavingsItem[] = []

  const curMonth = mo + 1 // 1-12
  for (const b of bills) {
    if (b.type === 'yearly') {
      const dm = Math.min(12, Math.max(1, b.dueMonth || 1))
      // จำนวนเดือนจากตอนนี้ถึงเดือนที่ต้องจ่าย (1-12); ถ้าอยู่ในเดือนที่จ่ายพอดี = 12 (เก็บสำหรับปีหน้า)
      const monthsUntilDue = ((dm - curMonth - 1 + 12) % 12) + 1
      const monthly = b.amount / monthsUntilDue
      if (monthly > 0)
        savingsItems.push({ name: b.name, monthly, kind: 'yearly', annual: b.amount, dueMonth: dm, monthsUntilDue })
      continue
    }
    if (b.type === 'once') {
      if (!b.done && b.amount > 0) savingsItems.push({ name: b.name, monthly: b.amount, kind: 'once' })
      continue
    }
    // monthly: ยังไม่จ่ายเดือนนี้ -> ค้าง (งวดนี้) ; จ่ายแล้ว -> กันงวดเดือนหน้า
    if (!b.paidCycles.includes(thisCycle)) {
      monthlyOutstanding.push({ name: b.name, amount: b.amount, due: clampDueDate(thisCycle, b.dueDay), cycle: thisCycle })
    } else if (!b.paidCycles.includes(nextCycle)) {
      monthlyOutstanding.push({ name: b.name, amount: b.amount, due: clampDueDate(nextCycle, b.dueDay), cycle: nextCycle })
    }
  }

  const monthlyBillsDue = monthlyOutstanding.reduce((s, b) => s + b.amount, 0)
  const savingsReserve = savingsItems.reduce((s, x) => s + x.monthly, 0)

  // ---- วันที่เหลือ: ถึงสิ้นเดือนนี้ หรือบิลรายเดือนที่ค้างไกลสุด ----
  const startOfToday = new Date(y, mo, today.getDate())
  let horizon = new Date(y, mo + 1, 0)
  for (const b of monthlyOutstanding) {
    const d = new Date(`${b.due}T00:00:00`)
    if (d > horizon) horizon = d
  }
  const daysLeft = Math.max(1, Math.ceil((horizon.getTime() - startOfToday.getTime()) / 86400000))

  const free = spendable - monthlyBillsDue - savingsReserve - ingredientReserve
  const perDay = Math.max(0, free) / daysLeft

  return {
    spendable,
    monthlyBillsDue,
    savingsReserve,
    ingredientReserve,
    free,
    daysLeft,
    perDay,
    horizon: ymd(horizon),
    avgIngredient,
    spentIngredientThisMonth,
    monthlyOutstanding,
    savingsItems,
  }
}
