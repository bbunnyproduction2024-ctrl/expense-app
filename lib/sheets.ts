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
  const header = [['ID', 'Date', 'Type', 'Category', 'Amount', 'PaymentMethod', 'Note', 'Timestamp']]

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:H1`,
  })

  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: header },
    })
  }
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
  const timestamp = new Date().toISOString()
  // Row count as ID
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  })
  const nextId = (existing.data.values?.length ?? 1)

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        nextId,
        input.date,
        input.type,
        input.category,
        input.amount,
        input.paymentMethod,
        input.note,
        timestamp,
      ]],
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

// ---- Products ----

async function ensureProductsSheet() {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PRODUCTS_SHEET}!A1:F1` })
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PRODUCTS_SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['ID', 'Name', 'Category', 'Unit', 'LastPrice', 'UpdatedAt']] },
    })
  }
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

export async function upsertProduct(input: ProductInput): Promise<void> {
  const sheets = getSheets()
  await ensureProductsSheet()
  const existing = await getProducts()
  const found = existing.find(p => p.name.toLowerCase() === input.name.toLowerCase())
  const now = new Date().toISOString()

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
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!A1:J1` })
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PURCHASES_SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['ID', 'Date', 'ProductName', 'Category', 'Qty', 'Unit', 'UnitPrice', 'Total', 'Note', 'Timestamp']] },
    })
  }
}

export async function getPurchases(): Promise<Purchase[]> {
  const sheets = getSheets()
  await ensurePurchasesSheet()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!A2:J` })
  return (res.data.values ?? [])
    .map((row, i) => ({
      id: String(i + 2),
      date: row[1] ?? '',
      productName: row[2] ?? '',
      category: row[3] as Purchase['category'],
      qty: Number(row[4]) || 0,
      unit: row[5] as Purchase['unit'],
      unitPrice: Number(row[6]) || 0,
      total: Number(row[7]) || 0,
      note: row[8] ?? '',
      timestamp: row[9] ?? '',
    }))
    .filter(p => p.date && p.productName)
}

export async function addPurchase(input: PurchaseInput): Promise<void> {
  const sheets = getSheets()
  await ensurePurchasesSheet()
  const all = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${PURCHASES_SHEET}!A:A` })
  const nextId = (all.data.values?.length ?? 1)
  const total = input.qty * input.unitPrice
  const timestamp = new Date().toISOString()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PURCHASES_SHEET}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[nextId, input.date, input.productName, input.category, input.qty, input.unit, input.unitPrice, total, input.note, timestamp]] },
  })
  // Update last price in Products
  await upsertProduct({ name: input.productName, category: input.category, unit: input.unit, lastPrice: input.unitPrice })
}

export async function deletePurchase(rowIndex: number): Promise<void> {
  const sheets = getSheets()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === PURCHASES_SHEET)
  if (!sheet?.properties?.sheetId) throw new Error('Purchases sheet not found')
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex } } }] },
  })
}
