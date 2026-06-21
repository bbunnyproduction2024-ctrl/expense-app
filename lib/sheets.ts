import { google } from 'googleapis'
import { Transaction, TransactionInput } from './types'

const SHEET_NAME = 'Transactions'
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
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex,
          },
        },
      }],
    },
  })
}
