export type TransactionType = 'รายรับ' | 'รายจ่าย'

export const INCOME_CATEGORIES = [
  'กาแฟ/เครื่องดื่ม',
  'ห้องพัก/Guesthouse',
  'อาหาร',
  'อื่นๆ (รายรับ)',
] as const

export const EXPENSE_CATEGORIES = [
  'ค่าพนักงาน/เงินเดือน',
  'วัตถุดิบกาแฟ/เครื่องดื่ม',
  'วัตถุดิบอาหาร',
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
  id: string        // row index in sheet (1-based)
  date: string      // YYYY-MM-DD
  type: TransactionType
  category: Category
  amount: number
  note: string
  timestamp: string // ISO datetime
}

export interface TransactionInput {
  date: string
  type: TransactionType
  category: Category
  amount: number
  note: string
}

export interface MonthlySummary {
  totalIncome: number
  totalExpense: number
  balance: number
  month: string // YYYY-MM
}
