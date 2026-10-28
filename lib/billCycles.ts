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

export function addMonths(cycle: string, n: number): string {
  const [y, m] = cycle.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

// ความยาวรอบของบิลรายปี (เดือน) — ปกติรายปีจริงๆคือ 12 แต่บางบิลกำหนดสั้นกว่าได้ผ่านช่อง "เก็บกี่เดือน" (เช่น ซื้อของใช้ซ้ำทุก 3/5 เดือน)
// ไม่ได้กำหนด (months <= 1 ค่าเริ่มต้นเดิม) ถือว่าเป็นรายปีจริง 12 เดือน เพื่อไม่กระทบบิลรายปีเดิมที่มีอยู่แล้ว
export function yearlyPeriodMonths(bill: Bill): number {
  return bill.months && bill.months > 1 ? bill.months : 12
}

// ทุกรอบเก็บเงินรายเดือนในรอบปัจจุบันของบิลรายปี (periodMonths-1 เดือน ตั้งแต่เดือนถัดจากครบกำหนดครั้งล่าสุด จนถึงก่อนครบกำหนดครั้งถัดไป)
// ไม่ว่าจะติ๊กไปแล้วหรือยัง — ใช้นับว่าเหลือกี่เดือนที่ยังไม่ได้เก็บจริง (ไม่ใช่แค่นับถอยหลังจากวันนี้เฉยๆ)
export function yearlyWindowCycles(dueMonth: number, today: Date, periodMonths = 12): string[] {
  const lastDue = yearlyDueCycle(dueMonth, today)
  const nextDue = addMonths(lastDue, periodMonths)
  const out: string[] = []
  let cursor = incrementCycle(lastDue)
  while (cursor < nextDue) {
    out.push(cursor)
    cursor = incrementCycle(cursor)
  }
  return out
}

// จำนวนเดือนในรอบนี้ที่ยังไม่ติ๊กเก็บเงิน (periodMonths-1 เดือน ลบรอบที่ติ๊กไปแล้วไม่ว่าจะติ๊กตอนไหน) — ใช้หารยอดที่เหลือต้องเก็บ
export function yearlyUnpaidWindowCount(bill: Bill, today: Date): number {
  const window = yearlyWindowCycles(bill.dueMonth, today, yearlyPeriodMonths(bill))
  return window.filter((c) => !bill.paidCycles.includes(c)).length
}

// บิลรายปี: รอบครบกำหนดจริง (dueMonth = เดือนของรอบครบกำหนดครั้งล่าสุดที่จ่ายแล้ว หรือจุดเริ่มนับถ้าเพิ่งตั้งบิล) ที่ยังไม่จ่าย
// โผล่เป็นรายการค้างจ่ายจริงเสมอไม่ว่าจะเลยมากี่เดือน บวกรอบครบกำหนดครั้ง*ถัดไป*ถ้าถึงเวลาแล้ว (สำคัญกับบิลรอบสั้นกว่าปี
// ที่ dueMonth เดิมไม่ตรงเดือนจริงที่จะครบกำหนดรอบหน้า) บวกกับทุกรอบเก็บเงินรายเดือนระหว่างทางที่ยังไม่ติ๊ก
// (ค้างได้หลายเดือนไม่เหมือนบิลรายเดือนที่ค้างได้สูงสุดแค่ 1 เดือน) เดือนในอนาคตที่ยังไม่ถึงไม่โชว์ล่วงหน้า
// ยกเว้นไม่มีอะไรค้างเลยถึงโชว์รอบถัดไปเป็นแค่ตัวอย่าง "ahead"
export function yearlyCycleEntries(bill: Bill, today: Date): CycleEntry[] {
  const thisCycle = cyclesOf(today).thisCycle
  const period = yearlyPeriodMonths(bill)
  const lastDue = yearlyDueCycle(bill.dueMonth, today)
  const nextDue = addMonths(lastDue, period)
  const window = yearlyWindowCycles(bill.dueMonth, today, period)
  const out: CycleEntry[] = []
  if (!bill.paidCycles.includes(lastDue)) {
    out.push({ cycle: lastDue, amount: bill.amount, status: lastDue === thisCycle ? 'due' : 'overdue' })
  }
  for (const c of window) {
    if (c > thisCycle) break
    if (!bill.paidCycles.includes(c)) out.push({ cycle: c, amount: bill.amount, status: c === thisCycle ? 'due' : 'overdue' })
  }
  if (nextDue <= thisCycle && !bill.paidCycles.includes(nextDue)) {
    out.push({ cycle: nextDue, amount: bill.amount, status: nextDue === thisCycle ? 'due' : 'overdue' })
  }
  if (out.length === 0) {
    const aheadCycle = window.find((c) => c > thisCycle) ?? (nextDue > thisCycle ? nextDue : undefined)
    if (aheadCycle) out.push({ cycle: aheadCycle, amount: bill.amount, status: 'ahead' })
  }
  return out
}

// รอบครบกำหนดจริงล่าสุดที่จ่ายแล้ว (หรือจุดเริ่มนับ) และรอบครบกำหนดจริงถัดไปของบิลรายปี — ใช้ร่วมกันทั้งเช็กว่ารอบไหนคือ "จ่ายจริง" (expense)
// และคำนวณเดือนที่จะแสดงผล เพราะ dueMonth ที่เก็บไว้เป็นแค่จุดยึดของรอบล่าสุด ไม่ใช่เดือนที่จะจ่ายจริงครั้งหน้าเสมอไป (โดยเฉพาะบิลรอบสั้นกว่าปี)
export function yearlyDueCycles(bill: Bill, today: Date): { lastDue: string; nextDue: string } {
  const lastDue = yearlyDueCycle(bill.dueMonth, today)
  const nextDue = addMonths(lastDue, yearlyPeriodMonths(bill))
  return { lastDue, nextDue }
}

// เดือนครบกำหนดจริงรอบถัดไปของบิลรายปี (ไม่ใช่ dueMonth ดิบๆ ที่เก็บไว้ — ตัวนั้นเป็นแค่จุดยึดคำนวณรอบล่าสุด
// สำหรับบิลรายปีจริง (รอบ 12 เดือน) ค่านี้เท่ากับ dueMonth เสมออยู่แล้ว แต่สำหรับบิลรอบสั้นกว่าปี dueMonth เดิมอาจเป็นแค่เดือนเริ่มนับ ไม่ใช่เดือนที่จะจ่ายจริงครั้งหน้า)
export function yearlyNextDueMonth(bill: Bill, today: Date): number {
  return Number(yearlyDueCycles(bill, today).nextDue.split('-')[1])
}

// ยอดที่โอนเก็บเข้าออมทรัพย์จริงไปแล้วของบิลรายปีนี้ ภายในรอบปัจจุบัน (รวมเฉพาะขาเข้าออมทรัพย์ ไม่นับขาออกของคู่โอน กันนับซ้ำ)
export function yearlyRealSavedInWindow(bill: Bill, txns: Transaction[], today: Date): number {
  const window = yearlyWindowCycles(bill.dueMonth, today, yearlyPeriodMonths(bill))
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
