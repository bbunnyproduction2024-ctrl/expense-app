export type TransactionType = 'รายรับ' | 'รายจ่าย'
export type PaymentMethod = 'เงินสด' | 'KBank'

export const INCOME_CATEGORIES = [
  'ร้าน Hop & Sip',
  'ห้องพัก/Guesthouse',
  'Mom_Jay',
  'อื่นๆ (รายรับ)',
] as const

export const EXPENSE_CATEGORIES = [
  'ค่าพนักงาน/เงินเดือน',
  'วัตถุดิบร้าน Hop & Sip',
  'อาหาร/เครื่องดื่ม',
  'ค่าสัตว์เลี้ยง',
  'ค่าน้ำมันรถ',
  'ค่าใช้จ่ายในครอบครัว',
  'ค่าสาธารณูปโภค',
  'อื่นๆ (รายจ่าย)',
] as const

export type IncomeCategory = typeof INCOME_CATEGORIES[number]
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
export type Category = IncomeCategory | ExpenseCategory

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

// ---- Purchase tracker ----
export type ItemCategory = 'วัตถุดิบ ร้าน Hop & Sip' | 'อุปกรณ์ เครื่องใช้' | 'อาหาร/เครื่องดื่ม' | 'ค่าสัตว์เลี้ยง' | 'อื่นๆ (รายจ่าย)'
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
  note: string
}

export interface ProductInput {
  name: string
  category: ItemCategory
  unit: ItemUnit
  lastPrice: number
}
