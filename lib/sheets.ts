import { google } from 'googleapis'
import { Transaction, TransactionInput, Product, ProductInput, Purchase, PurchaseInput } from './types'

const SHEET_NAME = 'Transactions'
const PRODUCTS_SHEET = 'Products'
const PURCHASES_SHEET = 'Purchases'
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
