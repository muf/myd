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

// Filter monthly sheets (e.g., "1월", "2월", "12월")
export function filterMonthlySheets(sheets: { sheetId: number; title: string }[]) {
  return sheets.filter(sheet => /^\d{1,2}월$/.test(sheet.title))
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
    const range = `'${sheetTitle}'!A28:F`
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
