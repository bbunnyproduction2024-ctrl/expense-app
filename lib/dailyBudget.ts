import { Bill, Transaction } from './types'
import { computeCurrentBalances } from './balances'
import { billCycleEntries, cyclesOf } from './billCycles'

export interface OutstandingBill {
  name: string
  amount: number
  due: string // yyyy-MM-dd
  cycle: string // yyyy-MM
  status: 'overdue' | 'due' | 'ahead'
}

export interface SavingsItem {
  name: string
  monthly: number // ยอดที่กันไว้ต่อเดือน (yearly = amount ÷ เดือนที่เหลือถึงกำหนด, once = amount ÷ จำนวนเดือน)
  kind: 'yearly' | 'once'
  total?: number // ยอดเต็ม (yearly = ต่อปี, once = ยอดก้อน)
  dueMonth?: number // 1-12 (yearly)
  monthsUntilDue?: number // (yearly)
  months?: number // จำนวนเดือนที่เก็บ (once)
}

export interface DailyBudget {
  spendable: number // ยอดคงเหลือ KBank + เงินสด (สุทธิทั้งหมด)
  monthlyBillsDue: number // บิลรายเดือน รวมทั้งที่ค้างเดือนนี้ + กันไว้ล่วงหน้าเดือนหน้า
  savingsReserve: number // เก็บออม (รายปี ÷เดือนที่เหลือ + เป้าหมายก้อน)
  ingredientReserve: number // กันไว้ซื้อวัตถุดิบร้าน
  free: number // เหลือหลังหักทุกอย่าง
  daysLeft: number
  perDay: number
  horizon: string // yyyy-MM-dd วันสิ้นสุดที่ใช้หาร (เสมอวันสุดท้ายของเดือนนี้)
  avgIngredient: number
  spentIngredientThisMonth: number
  monthlyOutstanding: OutstandingBill[] // รวมทั้งสามกลุ่มด้านล่าง (ไว้เผื่อใช้เดิม)
  billsOverdue: OutstandingBill[] // ค้างจ่ายเดือนที่แล้ว ยังไม่ได้ติ๊ก
  billsDueThisMonth: OutstandingBill[] // ยังไม่จ่าย ครบกำหนดเดือนนี้ — ค้างอยู่
  billsSavingAhead: OutstandingBill[] // จ่ายครบ (เดือนที่แล้ว+เดือนนี้) แล้ว กำลังกันไว้ล่วงหน้าสำหรับเดือนหน้า
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
  today: Date = new Date(),
  // นับ "เงินที่มี" จากรายการตั้งแต่เดือนนี้เป็นต้นไป (ให้ตรงกับการ์ดคงเหลือหน้าแรก)
  sinceCycle = '2026-08'
): DailyBudget {
  // เงินที่ใช้ได้ = ยอดคงเหลือ KBank + เงินสด "ตอนนี้" (เลขเดียวกับการ์ดยอดคงเหลือทุกหน้า — ไม่รวม มิ.ย./ก.ค. ที่ยกยอดเอง)
  const currentBalances = computeCurrentBalances(txns, sinceCycle)
  const spendable = currentBalances.kbank + currentBalances.cash

  const y = today.getFullYear()
  const mo = today.getMonth() // 0-based
  const { thisCycle, prevCycle, nextCycle } = cyclesOf(today)

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
      // ถ้าเดือนนี้โอนเก็บ/จ่ายไปจริงแล้ว (thisCycle อยู่ใน paidCycles) เงินก็หักออกจาก spendable ไปแล้วจริงๆ
      // ไม่ต้องกันสำรองซ้อนอีกชั้นในตัวเลขคาดการณ์นี้
      if (monthly > 0 && !b.paidCycles.includes(thisCycle))
        savingsItems.push({ name: b.name, monthly, kind: 'yearly', total: b.amount, dueMonth: dm, monthsUntilDue })
      continue
    }
    if (b.type === 'once') {
      const months = Math.max(1, b.months || 1)
      if (!b.done && b.amount > 0)
        savingsItems.push({ name: b.name, monthly: b.amount / months, kind: 'once', total: b.amount, months })
      continue
    }
    // monthly: เดือนที่แล้ว + เดือนนี้ ที่ยังไม่ติ๊ก นับเป็นค้างแยกกันคนละรายการ (ไม่รวมเป็นก้อนเดียว)
    // ถ้าติ๊กครบทั้งคู่แล้ว ถือว่ากำลังกันไว้ล่วงหน้าสำหรับเดือนหน้า ต่อเนื่องไปเรื่อยๆ ไม่มีช่วงที่ไม่ได้กันเงินเลย
    for (const e of billCycleEntries(b, thisCycle, prevCycle, nextCycle)) {
      monthlyOutstanding.push({ name: b.name, amount: e.amount, due: clampDueDate(e.cycle, b.dueDay), cycle: e.cycle, status: e.status })
    }
  }

  const billsOverdue = monthlyOutstanding.filter((b) => b.status === 'overdue')
  const billsDueThisMonth = monthlyOutstanding.filter((b) => b.status === 'due')
  const billsSavingAhead = monthlyOutstanding.filter((b) => b.status === 'ahead')
  const monthlyBillsDue = monthlyOutstanding.reduce((s, b) => s + b.amount, 0)
  const savingsReserve = savingsItems.reduce((s, x) => s + x.monthly, 0)

  // ---- วันที่เหลือ: ถึงสิ้นเดือนนี้เสมอ (ไม่ขยับตามบิลที่กันไว้ล่วงหน้า) ----
  const startOfToday = new Date(y, mo, today.getDate())
  const horizon = new Date(y, mo + 1, 0)
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
    billsOverdue,
    billsDueThisMonth,
    billsSavingAhead,
    savingsItems,
  }
}
