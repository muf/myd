const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export interface SpreadsheetInfo {
  title: string
  sheets: { sheetId: number; title: string }[]
}

export interface SheetData {
  sheetTitle: string
  headers: string[]
  rows: string[][]
}

// Filter monthly sheets (e.g., "2024년 12월", "2025년 1월")
export function filterMonthlySheets(sheets: { sheetId: number; title: string }[]) {
  return sheets
    .filter(sheet => /^\d{4}년 \d{1,2}월$/.test(sheet.title))
    .sort((a, b) => {
      // 날짜순 정렬 (최신순)
      const matchA = a.title.match(/(\d{4})년 (\d{1,2})월/)
      const matchB = b.title.match(/(\d{4})년 (\d{1,2})월/)
      if (!matchA || !matchB) return 0
      const dateA = parseInt(matchA[1]) * 100 + parseInt(matchA[2])
      const dateB = parseInt(matchB[1]) * 100 + parseInt(matchB[2])
      return dateB - dateA // 최신순
    })
}

// Get spreadsheet info
export async function getSpreadsheetInfo(accessToken: string): Promise<SpreadsheetInfo | null> {
  try {
    console.log('Fetching spreadsheet info...')
    const response = await fetch(
      `${SHEETS_API_BASE}/${SPREADSHEET_ID}?fields=properties.title,sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    console.log('Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log('Spreadsheet loaded:', data.properties?.title)
    
    return {
      title: data.properties.title,
      sheets: data.sheets.map((sheet: { properties: { sheetId: number; title: string } }) => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
      })),
    }
  } catch (error) {
    console.error('Failed to get spreadsheet info:', error)
    return null
  }
}

// Get sheet data (A28:F onwards, excluding column G)
export async function getSheetData(accessToken: string, sheetTitle: string): Promise<SheetData | null> {
  try {
    const range = `'${sheetTitle}'!A28:G`
    const response = await fetch(
      `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error('Failed to get sheet data:', response.status)
      return null
    }

    const data = await response.json()
    const values = data.values || []

    if (values.length === 0) {
      return { sheetTitle, headers: [], rows: [] }
    }

    return {
      sheetTitle,
      headers: values[0] || [],
      rows: values.slice(1) || [],
    }
  } catch (error) {
    console.error('Failed to get sheet data:', error)
    return null
  }
}

// Get budget from C2 cell
export async function getBudgetFromSheet(accessToken: string, sheetTitle: string): Promise<number> {
  try {
    const range = `'${sheetTitle}'!C2`
    const response = await fetch(
      `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) return 0

    const data = await response.json()
    const value = data.values?.[0]?.[0] || '0'
    return parseFloat(value.replace(/[^\d.-]/g, '')) || 0
  } catch {
    return 0
  }
}

// Get living expense details from B10:F20
export async function getLivingExpenseDetails(accessToken: string, sheetTitle: string): Promise<string[][]> {
  try {
    const range = `'${sheetTitle}'!B10:F20`
    const response = await fetch(
      `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.values || []
  } catch {
    return []
  }
}

// Get monthly fixed expense from "정보" sheet D23
export async function getMonthlyFixedExpense(accessToken: string): Promise<number> {
  try {
    const range = `'정보'!D23`
    const response = await fetch(
      `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) return 0

    const data = await response.json()
    const value = data.values?.[0]?.[0] || '0'
    return parseFloat(value.replace(/[^\d.-]/g, '')) || 0
  } catch {
    return 0
  }
}
