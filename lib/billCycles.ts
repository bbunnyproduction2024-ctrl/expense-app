import { Bill } from './types'

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
