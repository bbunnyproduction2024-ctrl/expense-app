import { google } from 'googleapis'
import { Transaction, TransactionInput, TransferInput, Product, ProductInput, Purchase, PurchaseInput, Bill, BillInput } from './types'

const SHEET_NAME = 'Transactions'
const PRODUCTS_SHEET = 'Products'
const PURCHASES_SHEET = 'Purchases'
const BILLS_SHEET = 'Bills'
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getSheets() {
  const auth = getAuth()
  return google.sheets({ version: 'v4', auth })
}

// Ensure header row exists
export async function ensureSheet() {
  const sheets = getSheets()
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['ID', 'Date', 'Type', 'Category', 'Amount', 'PaymentMethod', 'Note', 'Timestamp']] },
  })
}

export async function getTransactions(): Promise<Transaction[]> {
  const sheets = getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H`,
  })

  const rows = res.data.values ?? []
  return rows
    .map((row, index) => ({
      id: String(index + 2),
      date: row[1] ?? '',
      type: row[2] as Transaction['type'],
      category: row[3] as Transaction['category'],
      amount: Number(row[4]) || 0,
      paymentMethod: (row[5] ?? 'เงินสด') as Transaction['paymentMethod'],
      note: row[6] ?? '',
      timestamp: row[7] ?? '',
    }))
    .filter((t) => t.date && t.type)
}

export async function addTransaction(input: TransactionInput): Promise<void> {
  const sheets = getSheets()
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  })
  const nextRow = (existing.data.values?.length ?? 1) + 1
  const nextId = nextRow - 1

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[nextId, input.date, input.type, input.category, input.amount, input.paymentMethod, input.note, input.date]],
    },
  })
}

export async function updateTransaction(rowIndex: number, fields: { date?: string; amount?: number; category?: string; note?: string; paymentMethod?: string }): Promise<void> {
  const sheets = getSheets()
  if (fields.date) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fields.date]] },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!H${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fields.date]] },
    })
  }
  if (fields.amount !== undefined) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fields.amount]] },
    })
  }
  if (fields.category !== undefined) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!D${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fields.category]] },
    })
  }
  if (fields.note !== undefined) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!G${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fields.note]] },
    })
  }
  if (fields.paymentMethod !== undefined) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!F${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[fields.paymentMethod]] },
    })
  }
}

// ---- Transfers (โอนเงินระหว่างบัญชี) ----
// เก็บเป็น 2 แถวใน Transactions: ขาออก (รายจ่าย) + ขาเข้า (รายรับ) หมวด "โอนเงิน"
// ผูกคู่กันด้วย token [T<epoch>] ที่ท้าย Note
export async function addTransfer(input: TransferInput): Promise<void> {
  const token = `T${Date.now()}`
  const memo = (input.note ?? '').trim()
  const suffix = `${memo ? ` · ${memo}` : ''} [${token}]`
  await addTransaction({
    date: input.date,
    type: 'รายจ่าย',
    category: 'โอนเงิน' as TransactionInput['category'],
    amount: input.amount,
    paymentMethod: input.from,
    note: `โอนไป ${input.to}${suffix}`,
  })
  await addTransaction({
    date: input.date,
    type: 'รายรับ',
    category: 'โอนเงิน' as TransactionInput['category'],
    amount: input.amount,
    paymentMethod: input.to,
    note: `โอนจาก ${input.from}${suffix}`,
  })
}

// ลบทั้งคู่ของการโอน โดยดู token จากแถวที่เลือก
export async function deleteTransferByRow(rowIndex: number): Promise<void> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H`,
  })
  const rows = res.data.values ?? []
  const target = rows[rowIndex - 2]
  const note: string = target?.[6] ?? ''
  const m = note.match(/\[T\d+\]/)
  const indices: number[] = []
  if (m) {
    const tok = m[0]
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][6] ?? '').includes(tok)) indices.push(i + 2)
    }
  } else {
    indices.push(rowIndex)
  }
  if (indices.length === 0) return

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME)
  if (!sheet?.properties?.sheetId) throw new Error('Sheet not found')

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: indices
        .sort((a, b) => b - a)
        .map((r) => ({
          deleteDimension: {
            range: {
              sheetId: sheet.properties!.sheetId!,
              dimension: 'ROWS',
              startIndex: r - 1,
              endIndex: r,
            },
          },
        })),
    },
  })
}

export async function deleteTransaction(rowIndex: number): Promise<void> {
  const sheets = getSheets()

  // Get spreadsheet to find sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME
  )
  if (!sheet?.properties?.sheetId) throw new Error('Sheet not found')

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  })
}

// ---- บิลประจำ / เงินกันไว้ (Bills) ----
// A=ID | B=Name | C=Amount | D=DueDay | E=Account | F=Note | G=PaidCycles | H=Type | I=Done | J=DueMonth | K=Months
const BILLS_HEADER = ['ID', 'Name', 'Amount', 'DueDay', 'Account', 'Note', 'PaidCycles', 'Type', 'Done', 'DueMonth', 'Months']

export async function ensureBillsSheet(): Promise<void> {
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const titles = meta.data.sheets?.map((s) => s.properties?.title ?? '') ?? []
  if (!titles.includes(BILLS_SHEET)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: BILLS_SHEET } } }] },
    })
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BILLS_SHEET}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [BILLS_HEADER] },
  })
}

export async function getBills(): Promise<Bill[]> {
  const sheets = getSheets()
  await ensureBillsSheet()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BILLS_SHEET}!A2:K`,
  })
  return (res.data.values ?? [])
    .map((row, i) => {
      const t = String(row[7] ?? 'monthly').trim()
      const type: Bill['type'] = t === 'yearly' || t === 'once' ? t : 'monthly'
      return {
        id: String(i + 2),
        name: row[1] ?? '',
        amount: Number(row[2]) || 0,
        dueDay: Math.min(31, Math.max(1, Number(row[3]) || 1)),
        dueMonth: Math.min(12, Math.max(1, Number(row[9]) || 1)),
        months: Math.max(1, Number(row[10]) || 1),
        account: (row[4] ?? 'KBank') as Bill['account'],
        note: row[5] ?? '',
        paidCycles: String(row[6] ?? '').split(/[\s,]+/).filter(Boolean),
        type,
        done: /^(true|1|yes)$/i.test(String(row[8] ?? '').trim()),
      }
    })
    .filter((b) => b.name)
}

export async function addBill(input: BillInput): Promise<void> {
  const sheets = getSheets()
  await ensureBillsSheet()
  const all = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${BILLS_SHEET}!A:A` })
  const nextRow = (all.data.values?.length ?? 1) + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BILLS_SHEET}!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [nextRow - 1, input.name, input.amount, input.dueDay, input.account, input.note, '', input.type, '', input.dueMonth, input.months],
      ],
    },
  })
}

export async function updateBill(
  rowIndex: number,
  fields: {
    name?: string
    amount?: number
    dueDay?: number
    dueMonth?: number
    months?: number
    account?: string
    note?: string
    type?: string
    done?: boolean
  }
): Promise<void> {
  const sheets = getSheets()
  const set = async (col: string, value: string | number) =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BILLS_SHEET}!${col}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  if (fields.name !== undefined) await set('B', fields.name)
  if (fields.amount !== undefined) await set('C', fields.amount)
  if (fields.dueDay !== undefined) await set('D', fields.dueDay)
  if (fields.dueMonth !== undefined) await set('J', fields.dueMonth)
  if (fields.months !== undefined) await set('K', fields.months)
  if (fields.account !== undefined) await set('E', fields.account)
  if (fields.note !== undefined) await set('F', fields.note)
  if (fields.type !== undefined) await set('H', fields.type)
  if (fields.done !== undefined) await set('I', fields.done ? 'TRUE' : '')
}

// เปิด/ปิดสถานะ "เก็บครบ/ใช้แล้ว" ของเงินก้อน (type = once)
export async function setBillDone(rowIndex: number, done: boolean): Promise<void> {
  await updateBill(rowIndex, { done })
}

// ลบทุกแถวใน Transactions ที่ Note มี tag นี้ (ใช้ลบรายจ่ายที่ผูกกับบิลตอนกดยกเลิก "จ่ายแล้ว")
async function deleteTxnsByTag(tag: string): Promise<void> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A2:H` })
  const rows = res.data.values ?? []
  const indices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][6] ?? '').includes(tag)) indices.push(i + 2)
  }
  if (indices.length === 0) return
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME)
  if (!sheet?.properties?.sheetId) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: indices
        .sort((a, b) => b - a)
        .map((r) => ({
          deleteDimension: {
            range: { sheetId: sheet.properties!.sheetId!, dimension: 'ROWS', startIndex: r - 1, endIndex: r },
          },
        })),
    },
  })
}

// เปิด/ปิดสถานะ "จ่ายแล้ว" ของบิลในรอบ yyyy-MM
// กดจ่ายแล้ว -> บันทึกรายจ่ายจริงให้อัตโนมัติ (หมวด "ชำระบิล") ผูกด้วย tag [B<row>:<cycle>]
//   รับ overrideAmount/overrideAccount ได้ — เผื่อยอดจริงไม่เท่ากับที่กันไว้ หรือจ่ายคนละบัญชีกับที่ตั้งไว้
//   (ไม่แก้ยอด/บัญชีเริ่มต้นของบิลใน sheet — เป็นแค่ยอดที่จ่ายจริงครั้งนี้ครั้งเดียว)
// กดยกเลิก -> ลบรายจ่ายที่ผูกไว้นั้นทิ้ง
export async function setBillPaid(
  rowIndex: number,
  cycle: string,
  paid: boolean,
  overrideAmount?: number,
  overrideAccount?: string
): Promise<void> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BILLS_SHEET}!B${rowIndex}:G${rowIndex}`,
  })
  const row = res.data.values?.[0] ?? []
  const name: string = row[0] ?? ''
  const amount = overrideAmount && overrideAmount > 0 ? overrideAmount : Number(row[1]) || 0
  const account = (overrideAccount || row[3] || 'KBank') as Transaction['paymentMethod']
  const cur = String(row[5] ?? '').split(/[\s,]+/).filter(Boolean)
  const tag = `[B${rowIndex}:${cycle}]`

  const set = new Set(cur)
  if (paid) {
    set.add(cycle)
    if (amount > 0) {
      await addTransaction({
        date: new Date().toISOString().slice(0, 10),
        type: 'รายจ่าย',
        category: 'ชำระบิล' as TransactionInput['category'],
        amount,
        paymentMethod: account,
        note: `ชำระบิล ${name} ${tag}`,
      })
    }
  } else {
    set.delete(cycle)
    await deleteTxnsByTag(tag)
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BILLS_SHEET}!G${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[[...set].sort().join(' ')]] },
  })
}

export async function deleteBill(rowIndex: number): Promise<void> {
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === BILLS_SHEET)
  if (!sheet?.properties?.sheetId) throw new Error('Bills sheet not found')
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        },
      ],
    },
  })
}

// ---- Products + Purchases bootstrap ----

// Purchases sheet structure:
// A=ID | B=Store | C=ProductName | D=Category | E=Unit | F=UnitPrice | [YYYY-MM จำนวน | YYYY-MM รวม] per month...
// One row per unique (productName + unitPrice), monthly columns grow dynamically.
const PURCHASES_BASE_COLS = 6

function colLetter(idx: number): string {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

async function getPurchasesHeaderMap(sheets: ReturnType<typeof google.sheets>) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!1:1` })
  const headers: string[] = (res.data.values?.[0] ?? []) as string[]
  const monthCols = new Map<string, { qty: number; total: number }>()
  for (let i = PURCHASES_BASE_COLS; i + 1 < headers.length; i += 2) {
    const h = headers[i] ?? ''
    if (h.includes(' จำนวน')) {
      const mk = h.replace(' จำนวน', '').trim()
      monthCols.set(mk, { qty: i, total: i + 1 })
    }
  }
  return { headers, monthCols }
}

// Creates both tabs at once (single metadata call) so opening any shop page is enough
async function ensureShopSheets() {
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const titles = meta.data.sheets?.map(s => s.properties?.title ?? '') ?? []

  const toCreate: { title: string }[] = []
  if (!titles.includes(PRODUCTS_SHEET)) toCreate.push({ title: PRODUCTS_SHEET })
  if (!titles.includes(PURCHASES_SHEET)) toCreate.push({ title: PURCHASES_SHEET })

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: toCreate.map(t => ({ addSheet: { properties: { title: t.title } } })) },
    })
  }

  // Products: always rewrite static header
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PRODUCTS_SHEET}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['ID', 'Name', 'Category', 'Unit', 'LastPrice', 'UpdatedAt']] },
  })

  // Purchases: always rewrite base columns A-F (month cols G+ are preserved, grow dynamically)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PURCHASES_SHEET}!A1:F1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['ID', 'Store', 'ProductName', 'Category', 'Unit', 'UnitPrice']] },
  })
}

async function ensureProductsSheet() {
  await ensureShopSheets()
}

export async function getProducts(): Promise<Product[]> {
  const sheets = getSheets()
  await ensureProductsSheet()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PRODUCTS_SHEET}!A2:F` })
  return (res.data.values ?? [])
    .map((row, i) => ({
      id: String(i + 2),
      name: row[1] ?? '',
      category: row[2] as Product['category'],
      unit: row[3] as Product['unit'],
      lastPrice: Number(row[4]) || 0,
      updatedAt: row[5] ?? '',
    }))
    .filter(p => p.name)
}

export async function renameProduct(oldName: string, newName: string): Promise<void> {
  const sheets = getSheets()

  // 1. Products sheet — column B
  const prodRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PRODUCTS_SHEET}!B2:B` })
  const prodRows = prodRes.data.values ?? []
  for (let i = 0; i < prodRows.length; i++) {
    if ((prodRows[i][0] ?? '').toLowerCase() === oldName.toLowerCase()) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PRODUCTS_SHEET}!B${i + 2}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newName]] },
      })
    }
  }

  // 2. Purchases sheet — column C (ProductName)
  const purRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!C2:C` })
  const purRows = purRes.data.values ?? []
  for (let i = 0; i < purRows.length; i++) {
    if ((purRows[i][0] ?? '').toLowerCase() === oldName.toLowerCase()) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PURCHASES_SHEET}!C${i + 2}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newName]] },
      })
    }
  }

  // 3. Transactions sheet — column G (Note) replace "ซื้อ {oldName} " prefix
  const txnRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!G2:G` })
  const txnRows = txnRes.data.values ?? []
  for (let i = 0; i < txnRows.length; i++) {
    const note: string = txnRows[i][0] ?? ''
    if (note.startsWith(`ซื้อ ${oldName} `)) {
      const updated = `ซื้อ ${newName} ` + note.slice(`ซื้อ ${oldName} `.length)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!G${i + 2}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[updated]] },
      })
    }
  }
}

export async function upsertProduct(input: ProductInput): Promise<void> {
  const sheets = getSheets()
  await ensureProductsSheet()
  const existing = await getProducts()
  const found = existing.find(p => p.name.toLowerCase() === input.name.toLowerCase())
  const now = new Date().toISOString().slice(0, 10)

  if (found) {
    // Update lastPrice and updatedAt
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PRODUCTS_SHEET}!E${found.id}:F${found.id}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[input.lastPrice, now]] },
    })
  } else {
    const all = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PRODUCTS_SHEET}!A:A` })
    const nextId = (all.data.values?.length ?? 1)
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PRODUCTS_SHEET}!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[nextId, input.name, input.category, input.unit, input.lastPrice, now]] },
    })
  }
}

// ---- Purchases ----

async function ensurePurchasesSheet() {
  await ensureShopSheets()
}

export async function getStores(): Promise<string[]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!B2:B` })
  const rows = res.data.values ?? []
  const unique = [...new Set(rows.map(r => (r[0] ?? '').trim()).filter(Boolean))]
  return unique.sort((a, b) => a.localeCompare(b, 'th'))
}

export async function getPurchases(): Promise<Purchase[]> {
  const sheets = getSheets()
  await ensurePurchasesSheet()
  const { monthCols } = await getPurchasesHeaderMap(sheets)
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!A2:ZZ` })
  const rows = res.data.values ?? []
  const purchases: Purchase[] = []
  rows.forEach((row, rIdx) => {
    const productName = row[2] ?? ''
    if (!productName) return
    const rowNum = rIdx + 2
    for (const [monthKey, { qty: qIdx, total: tIdx }] of monthCols) {
      const qty = Number(row[qIdx]) || 0
      const total = Number(row[tIdx]) || 0
      if (qty === 0) continue
      purchases.push({
        id: `${rowNum}:${monthKey}`,
        date: `${monthKey}-01`,
        store: row[1] ?? '',
        productName,
        category: row[3] as Purchase['category'],
        qty,
        unit: row[4] ?? '',
        unitPrice: Number(row[5]) || 0,
        total,
        note: '',
        timestamp: monthKey,
      })
    }
  })
  return purchases
}

const PURCHASE_CATEGORY_MAP: Record<string, string> = {
  'วัตถุดิบ ร้าน Hop & Sip': 'วัตถุดิบร้าน Hop & Sip',
  'อุปกรณ์ร้าน Hop & Sip': 'อุปกรณ์ร้าน Hop & Sip',
  'อุปกรณ์ เครื่องใช้': 'ค่าใช้จ่ายในครอบครัว',
  'อาหาร/เครื่องดื่ม': 'อาหาร/เครื่องดื่ม',
  'ค่าสัตว์เลี้ยง': 'ค่าสัตว์เลี้ยง',
  'อื่นๆ (รายจ่าย)': 'อื่นๆ (รายจ่าย)',
}

export async function addPurchase(input: PurchaseInput): Promise<void> {
  const sheets = getSheets()
  await ensurePurchasesSheet()

  const monthKey = input.date.slice(0, 7) // "2026-06"
  const total = +(input.qty * input.unitPrice).toFixed(2)

  let { headers, monthCols } = await getPurchasesHeaderMap(sheets)

  // Add month columns to header if this month is new
  if (!monthCols.has(monthKey)) {
    const qIdx = headers.length
    const tIdx = headers.length + 1
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PURCHASES_SHEET}!${colLetter(qIdx)}1:${colLetter(tIdx)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [[`${monthKey} จำนวน`, `${monthKey} รวม`]] },
    })
    headers = [...headers, `${monthKey} จำนวน`, `${monthKey} รวม`]
    monthCols = new Map(monthCols).set(monthKey, { qty: qIdx, total: tIdx })
  }

  const { qty: qtyCol, total: totalCol } = monthCols.get(monthKey)!

  // Read all product rows
  const allRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!A2:ZZ` })
  const rows = allRes.data.values ?? []

  // Find matching product by name + unitPrice (case-insensitive)
  const matchIdx = rows.findIndex(row =>
    (row[2] ?? '').toLowerCase() === input.productName.toLowerCase() &&
    Number(row[5]) === input.unitPrice
  )

  if (matchIdx !== -1) {
    const actualRow = matchIdx + 2
    const curQty = Number(rows[matchIdx][qtyCol]) || 0
    const curTotal = Number(rows[matchIdx][totalCol]) || 0
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PURCHASES_SHEET}!${colLetter(qtyCol)}${actualRow}:${colLetter(totalCol)}${actualRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[curQty + input.qty, +((curTotal + total).toFixed(2))]] },
    })
  } else {
    // New product row
    const nextRow = rows.length + 2
    const nextId = nextRow - 1
    const newRow: (string | number)[] = [nextId, input.store, input.productName, input.category, input.unit, input.unitPrice]
    for (let i = PURCHASES_BASE_COLS; i <= totalCol; i++) {
      if (i === qtyCol) newRow.push(input.qty)
      else if (i === totalCol) newRow.push(total)
      else newRow.push(0)
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PURCHASES_SHEET}!A${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [newRow] },
    })
  }

  await addTransaction({
    date: input.date,
    type: 'รายจ่าย',
    category: (PURCHASE_CATEGORY_MAP[input.category] ?? 'อื่นๆ (รายจ่าย)') as Transaction['category'],
    amount: total,
    paymentMethod: input.paymentMethod,
    note: `ซื้อ ${input.productName} ${input.qty}_${input.unit}${input.store ? ` @${input.store}` : ''} (ของซื้อ)`,
  })
  await upsertProduct({ name: input.productName, category: input.category, unit: input.unit, lastPrice: input.unitPrice })
}

// ลบรายการซื้อ "รายครั้ง" — ลบ 1 แถวใน Transactions แล้วหักจำนวน/ยอดออกจาก pivot Purchases
export async function deleteShopPurchaseTxn(rowIndex: number): Promise<void> {
  const sheets = getSheets()

  const txnRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H`,
  })
  const txnRows = txnRes.data.values ?? []
  const target = txnRows[rowIndex - 2]
  const note: string = target?.[6] ?? ''
  const date: string = target?.[1] ?? ''
  const amount = Number(target?.[4]) || 0

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const txnSheet = meta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME)
  if (!txnSheet?.properties?.sheetId) throw new Error('Sheet not found')

  // หัก pivot ถ้าแกะชื่อ/จำนวนจาก note ได้
  const m = note.match(/^ซื้อ (.+) (\d+(?:\.\d+)?)_(\S*)/)
  const monthKey = date.slice(0, 7)
  if (m && monthKey) {
    const productName = m[1].trim()
    const qty = Number(m[2]) || 0
    const unitPrice = qty ? amount / qty : 0

    const pivotRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PURCHASES_SHEET}!A2:F`,
    })
    const pivotRows = pivotRes.data.values ?? []
    let idx = pivotRows.findIndex(
      (r) => (r[2] ?? '').toLowerCase() === productName.toLowerCase() && Math.abs(Number(r[5]) - unitPrice) < 0.01
    )
    if (idx === -1) idx = pivotRows.findIndex((r) => (r[2] ?? '').toLowerCase() === productName.toLowerCase())

    const { monthCols } = await getPurchasesHeaderMap(sheets)
    const cols = monthCols.get(monthKey)
    if (idx !== -1 && cols) {
      const pivotRowNum = idx + 2
      const cur = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PURCHASES_SHEET}!${colLetter(cols.qty)}${pivotRowNum}:${colLetter(cols.total)}${pivotRowNum}`,
      })
      const curQty = Number(cur.data.values?.[0]?.[0]) || 0
      const curTotal = Number(cur.data.values?.[0]?.[1]) || 0
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PURCHASES_SHEET}!${colLetter(cols.qty)}${pivotRowNum}:${colLetter(cols.total)}${pivotRowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[Math.max(0, curQty - qty), +Math.max(0, curTotal - amount).toFixed(2)]] },
      })
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: txnSheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  })
}

// id format: "{rowNum}:{monthKey}" e.g. "3:2026-06"
export async function deletePurchase(id: string): Promise<void> {
  const [rowPart, monthKey] = id.split(':')
  const rowNum = parseInt(rowPart)
  const sheets = getSheets()

  // 1. Zero out Purchases pivot for this month
  const { monthCols } = await getPurchasesHeaderMap(sheets)
  const cols = monthCols.get(monthKey)
  if (cols) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PURCHASES_SHEET}!${colLetter(cols.qty)}${rowNum}:${colLetter(cols.total)}${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[0, 0]] },
    })
  }

  // 2. Find product name from Purchases row C
  const purRow = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PURCHASES_SHEET}!C${rowNum}`,
  })
  const productName: string = purRow.data.values?.[0]?.[0] ?? ''
  if (!productName) return

  // 3. Find Transactions rows matching this product + month
  const txnRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H`,
  })
  const txnRows = txnRes.data.values ?? []
  const matchingIndices: number[] = []
  for (let i = 0; i < txnRows.length; i++) {
    const date: string = txnRows[i][1] ?? ''
    const note: string = txnRows[i][6] ?? ''
    if (date.startsWith(monthKey) && note.startsWith(`ซื้อ ${productName} `)) {
      matchingIndices.push(i + 2)
    }
  }
  if (matchingIndices.length === 0) return

  // 4. Delete matching rows (highest index first to avoid shifting)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === SHEET_NAME)
  if (!sheet?.properties?.sheetId) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: matchingIndices.sort((a, b) => b - a).map(rowIdx => ({
        deleteDimension: {
          range: {
            sheetId: sheet.properties!.sheetId!,
            dimension: 'ROWS',
            startIndex: rowIdx - 1,
            endIndex: rowIdx,
          },
        },
      })),
    },
  })
}
