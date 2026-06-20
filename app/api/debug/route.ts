import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID
    const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

    if (!sheetId) return NextResponse.json({ error: 'GOOGLE_SHEET_ID missing' }, { status: 500 })
    if (!keyRaw) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY missing' }, { status: 500 })

    let credentials
    try {
      credentials = JSON.parse(keyRaw)
    } catch (e) {
      return NextResponse.json({ error: 'JSON parse failed', detail: String(e) }, { status: 500 })
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const sheetNames = res.data.sheets?.map(s => s.properties?.title)

    return NextResponse.json({ ok: true, spreadsheetTitle: res.data.properties?.title, sheets: sheetNames })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
