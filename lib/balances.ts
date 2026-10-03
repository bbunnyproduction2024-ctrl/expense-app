import { Transaction } from './types'

export interface AccountBalances {
  kbank: number
  cash: number
  saving: number
  total: number
}

// ยอดคงเหลือ "ตอนนี้" แต่ละช่องทาง — นับสุทธิทุกรายการตั้งแต่ sinceCycle จนถึงปัจจุบัน
// ไม่ขึ้นกับเดือนที่เลือกดูในหน้าต่างๆ (ตัวเลขนี้ต้องเหมือนกันทุกที่ที่แสดง ไม่งั้นจะดูเพี้ยน)
export function computeCurrentBalances(txns: Transaction[], sinceCycle = '2026-08'): AccountBalances {
  const net = (method: Transaction['paymentMethod']) =>
    txns
      .filter((t) => t.paymentMethod === method && t.date.slice(0, 7) >= sinceCycle)
      .reduce((s, t) => s + (t.type === 'รายรับ' ? t.amount : -t.amount), 0)

  const kbank = net('KBank')
  const cash = net('เงินสด')
  const saving = net('ออมทรัพย์')
  return { kbank, cash, saving, total: kbank + cash + saving }
}
