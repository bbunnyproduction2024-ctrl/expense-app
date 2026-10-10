import { Bill, Transaction } from './types'

export interface CycleEntry {
  cycle: string // yyyy-MM
  amount: number
  status: 'overdue' | 'due' | 'ahead'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// รอบเดือนนี้ / เดือนที่แล้ว / เดือนหน้า เทียบกับวันที่ที่กำหนด
export function cyclesOf(today: Date): { thisCycle: string; prevCycle: string; nextCycle: string } {
  const y = today.getFullYear()
  const mo = today.getMonth() // 0-based
  const thisCycle = `${y}-${pad(mo + 1)}`
  const prevCycle = `${mo === 0 ? y - 1 : y}-${pad(mo === 0 ? 12 : mo)}`
  const nextCycle = `${mo === 11 ? y + 1 : y}-${pad(((mo + 1) % 12) + 1)}`
  return { thisCycle, prevCycle, nextCycle }
}

// รอบที่ยัง "ค้างติ๊ก" ของบิล — เดือนที่แล้ว (ถ้ายังไม่ติ๊ก) + เดือนนี้ (ถ้ายังไม่ติ๊ก) แยกเป็นคนละรายการ
// ไม่เอามารวมเป็นปุ่มเดียว เพื่อไม่ให้หลงลืมเดือนที่ค้างไว้ — ถ้าติ๊กครบทั้งคู่แล้ว ถือว่ากำลังกันไว้ล่วงหน้าสำหรับเดือนหน้า
// ใช้ได้ทั้งบิลรายเดือน (มีผลกับเงินที่กันไว้จริง) และบิลรายปี (เป็นแค่เช็กลิสต์เก็บเงินรายเดือน ไม่กระทบยอด)
export function billCycleEntries(bill: Bill, thisCycle: string, prevCycle: string, nextCycle: string): CycleEntry[] {
  const out: CycleEntry[] = []
  if (!bill.paidCycles.includes(prevCycle)) out.push({ cycle: prevCycle, amount: bill.amount, status: 'overdue' })
  if (!bill.paidCycles.includes(thisCycle)) out.push({ cycle: thisCycle, amount: bill.amount, status: 'due' })
  if (out.length === 0 && !bill.paidCycles.includes(nextCycle)) {
    out.push({ cycle: nextCycle, amount: bill.amount, status: 'ahead' })
  }
  return out
}

// รอบครบกำหนดจริงล่าสุดของบิลรายปี (เดือน dueMonth ของปีนี้ ถ้าเลยมาแล้ว / ของปีที่แล้ว ถ้ายังไม่ถึง)
export function yearlyDueCycle(dueMonth: number, today: Date): string {
  const curMonth = today.getMonth() + 1
  const year = curMonth >= dueMonth ? today.getFullYear() : today.getFullYear() - 1
  return `${year}-${pad(dueMonth)}`
}

function incrementCycle(cycle: string): string {
  const [y, m] = cycle.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`
}

// ทุกรอบเก็บเงินรายเดือนในปีปัจจุบันของบิลรายปี (11 เดือน ตั้งแต่เดือนถัดจากครบกำหนดครั้งล่าสุด จนถึงก่อนครบกำหนดครั้งถัดไป)
// ไม่ว่าจะติ๊กไปแล้วหรือยัง — ใช้นับว่าเหลือกี่เดือนที่ยังไม่ได้เก็บจริง (ไม่ใช่แค่นับถอยหลังจากวันนี้เฉยๆ)
export function yearlyWindowCycles(dueMonth: number, today: Date): string[] {
  const lastDue = yearlyDueCycle(dueMonth, today)
  const nextDue = `${Number(lastDue.slice(0, 4)) + 1}-${lastDue.slice(5)}`
  const out: string[] = []
  let cursor = incrementCycle(lastDue)
  while (cursor < nextDue) {
    out.push(cursor)
    cursor = incrementCycle(cursor)
  }
  return out
}

// จำนวนเดือนในปีนี้ที่ยังไม่ติ๊กเก็บเงิน (11 เดือน ลบรอบที่ติ๊กไปแล้วไม่ว่าจะติ๊กตอนไหน) — ใช้หารยอดที่เหลือต้องเก็บ
export function yearlyUnpaidWindowCount(bill: Bill, today: Date): number {
  const window = yearlyWindowCycles(bill.dueMonth, today)
  return window.filter((c) => !bill.paidCycles.includes(c)).length
}

// บิลรายปี: รอบครบกำหนดจริง (ตาม dueMonth) ที่ยังไม่จ่าย โผล่เป็นรายการค้างจ่ายจริงเสมอไม่ว่าจะเลยมากี่เดือน
// บวกกับทุกรอบเก็บเงินรายเดือน ตั้งแต่เดือนถัดจากครบกำหนดครั้งล่าสุด จนถึงเดือนนี้ ที่ยังไม่ติ๊ก (ค้างได้หลายเดือนไม่เหมือนบิลรายเดือนที่ค้างได้สูงสุดแค่ 1 เดือน)
// เดือนในอนาคตที่ยังไม่ถึงไม่โชว์ล่วงหน้า ยกเว้นไม่มีอะไรค้างเลยถึงโชว์รอบถัดไปเป็นแค่ตัวอย่าง "ahead"
export function yearlyCycleEntries(bill: Bill, today: Date): CycleEntry[] {
  const thisCycle = cyclesOf(today).thisCycle
  const dueCycle = yearlyDueCycle(bill.dueMonth, today)
  const window = yearlyWindowCycles(bill.dueMonth, today)
  const out: CycleEntry[] = []
  if (!bill.paidCycles.includes(dueCycle)) {
    out.push({ cycle: dueCycle, amount: bill.amount, status: dueCycle === thisCycle ? 'due' : 'overdue' })
  }
  for (const c of window) {
    if (c > thisCycle) break
    if (!bill.paidCycles.includes(c)) out.push({ cycle: c, amount: bill.amount, status: c === thisCycle ? 'due' : 'overdue' })
  }
  if (out.length === 0) {
    const nextCycle = window.find((c) => c > thisCycle)
    if (nextCycle) out.push({ cycle: nextCycle, amount: bill.amount, status: 'ahead' })
  }
  return out
}

// ยอดที่โอนเก็บเข้าออมทรัพย์จริงไปแล้วของบิลรายปีนี้ ภายในปีปัจจุบัน (รวมเฉพาะขาเข้าออมทรัพย์ ไม่นับขาออกของคู่โอน กันนับซ้ำ)
export function yearlyRealSavedInWindow(bill: Bill, txns: Transaction[], today: Date): number {
  const window = yearlyWindowCycles(bill.dueMonth, today)
  const prefix = `[B${bill.id}:`
  return txns.reduce((sum, t) => {
    if (t.category !== 'โอนเงิน' || t.type !== 'รายรับ' || t.paymentMethod !== 'ออมทรัพย์') return sum
    if (!t.note.includes(prefix)) return sum
    const m = t.note.match(/\[B(\d+):([\d-]+)\]/)
    if (!m || m[1] !== bill.id) return sum
    return window.includes(m[2]) ? sum + t.amount : sum
  }, 0)
}

// ยอดที่ต้องเก็บต่อเดือนของบิลรายปี = (ยอดต่อปี − ที่เคยเก็บไว้ก่อนหน้า(savedCredit) − ที่โอนเก็บจริงไปแล้วปีนี้) ÷ จำนวนเดือนที่ยังไม่ติ๊ก
export function yearlyMonthlyAmount(bill: Bill, txns: Transaction[], today: Date): number {
  const monthsLeft = yearlyUnpaidWindowCount(bill, today)
  if (monthsLeft <= 0) return 0
  const alreadySaved = (bill.savedCredit || 0) + yearlyRealSavedInWindow(bill, txns, today)
  const remaining = Math.max(0, bill.amount - alreadySaved)
  return remaining / monthsLeft
}
