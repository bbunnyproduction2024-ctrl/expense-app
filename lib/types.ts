export type TransactionType = 'รายรับ' | 'รายจ่าย'
export type PaymentMethod = 'KBank' | 'เงินสด' | 'ออมทรัพย์'

export const PAYMENT_METHODS: PaymentMethod[] = ['KBank', 'เงินสด', 'ออมทรัพย์']

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  KBank: '🏦 KBank',
  เงินสด: '💵 เงินสด',
  ออมทรัพย์: '🐷 ออมทรัพย์',
}

export const INCOME_CATEGORIES = [
  'ร้าน Hop & Sip',
  'ห้องพัก/Guesthouse',
  'Mom_Jay',
  'Entertainment',
  'อื่นๆ (รายรับ)',
] as const

export const EXPENSE_CATEGORIES = [
  'ค่าพนักงาน/เงินเดือน',
  'วัตถุดิบร้าน Hop & Sip',
  'อุปกรณ์ร้าน Hop & Sip',
  'อาหาร/เครื่องดื่ม',
  'ค่าสัตว์เลี้ยง',
  'ค่าน้ำมันรถ',
  'ค่าใช้จ่ายในครอบครัว',
  'ค่าสาธารณูปโภค',
  'Entertainment',
  'ออมเงิน',
  'อื่นๆ (รายจ่าย)',
] as const

// หมวดพิเศษสำหรับการโอนเงินระหว่างบัญชี — ไม่นับเป็นรายรับ/รายจ่ายจริง
export const TRANSFER_CATEGORY = 'โอนเงิน' as const

export type IncomeCategory = typeof INCOME_CATEGORIES[number]
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
export type Category = IncomeCategory | ExpenseCategory | typeof TRANSFER_CATEGORY

// วงล้อที่ 1 = เฉพาะร้าน Hop & Sip / วงล้อที่ 2 = อื่นๆ ที่เหลือ
export const SHOP_INCOME_CATEGORIES: string[] = ['ร้าน Hop & Sip']
export const SHOP_EXPENSE_CATEGORIES: string[] = ['วัตถุดิบร้าน Hop & Sip', 'อุปกรณ์ร้าน Hop & Sip']

export function isShopCategory(cat: string): boolean {
  return SHOP_INCOME_CATEGORIES.includes(cat) || SHOP_EXPENSE_CATEGORIES.includes(cat)
}

export interface TransferInput {
  date: string
  from: PaymentMethod
  to: PaymentMethod
  amount: number
  note: string
}

export interface Transaction {
  id: string
  date: string
  type: TransactionType
  category: Category
  amount: number
  paymentMethod: PaymentMethod
  note: string
  timestamp: string
}

export interface TransactionInput {
  date: string
  type: TransactionType
  category: Category
  amount: number
  paymentMethod: PaymentMethod
  note: string
}

export interface MonthlySummary {
  totalIncome: number
  totalExpense: number
  balance: number
  month: string
}

// ---- บิลประจำ / เงินกันไว้ (สำหรับคำนวณเงินใช้ได้ต่อวัน) ----
// monthly = จ่ายทุกเดือน | yearly = จ่ายรายปี เก็บเดือนละ amount/12 | once = เก็บก้อนไว้จ่ายทีเดียว
export type BillType = 'monthly' | 'yearly' | 'once'

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  monthly: 'รายเดือน',
  yearly: 'รายปี (เก็บต่อเดือน)',
  once: 'เก็บก้อน',
}

export interface Bill {
  id: string            // เลขแถวใน sheet
  name: string
  amount: number        // monthly/once = ยอดเต็ม, yearly = ยอดต่อปี
  dueDay: number        // วันของเดือนที่ครบกำหนด (1-31) — ใช้เฉพาะ monthly
  account: PaymentMethod
  note: string
  type: BillType
  paidCycles: string[]  // รอบ "yyyy-MM" ที่กดจ่ายแล้ว (monthly)
  done: boolean         // เก็บครบ/ใช้แล้ว (once)
}

export interface BillInput {
  name: string
  amount: number
  dueDay: number
  account: PaymentMethod
  note: string
  type: BillType
}

// ---- Purchase tracker ----
export type ItemCategory = 'วัตถุดิบ ร้าน Hop & Sip' | 'อุปกรณ์ร้าน Hop & Sip' | 'อุปกรณ์ เครื่องใช้' | 'อาหาร/เครื่องดื่ม' | 'ค่าสัตว์เลี้ยง' | 'อื่นๆ (รายจ่าย)'
export type ItemUnit = string  // e.g. "5000g", "500ml", "30ชิ้น/อัน"

export interface Product {
  id: string
  name: string
  category: ItemCategory
  unit: ItemUnit
  lastPrice: number
  updatedAt: string
}

export interface Purchase {
  id: string
  date: string
  productName: string
  category: ItemCategory
  qty: number
  unit: ItemUnit
  unitPrice: number
  total: number
  store: string
  note: string
  timestamp: string
}

export interface PurchaseInput {
  date: string
  productName: string
  category: ItemCategory
  qty: number
  unit: ItemUnit
  unitPrice: number
  paymentMethod: PaymentMethod
  store: string
  note: string
}

export interface ProductInput {
  name: string
  category: ItemCategory
  unit: ItemUnit
  lastPrice: number
}
