import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getSpreadsheetInfo,
  getSheetData,
  getBudgetFromSheet,
  filterMonthlySheets,
  SpreadsheetInfo,
  SheetData,
} from '../services/sheetsApi'

interface UseGoogleSheetsReturn {
  spreadsheetInfo: SpreadsheetInfo | null
  monthlySheets: { sheetId: number; title: string }[]
  currentSheetData: SheetData | null
  allSheetsData: SheetData[]
  totalBudget: number
  selectedMonth: string | null
  hasAccess: boolean | null
  isLoading: boolean
  error: string | null
  selectMonth: (month: string) => void
  refresh: () => void
}

export function useGoogleSheets(): UseGoogleSheetsReturn {
  const { accessToken } = useAuth()

  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null)
  const [monthlySheets, setMonthlySheets] = useState<{ sheetId: number; title: string }[]>([])
  const [currentSheetData, setCurrentSheetData] = useState<SheetData | null>(null)
  const [allSheetsData, setAllSheetsData] = useState<SheetData[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load spreadsheet info
  const loadSpreadsheetInfo = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const info = await getSpreadsheetInfo(accessToken)

      if (!info) {
        setHasAccess(false)
        setSpreadsheetInfo(null)
        setMonthlySheets([])
        return
      }

      setHasAccess(true)
      setSpreadsheetInfo(info)

      const monthly = filterMonthlySheets(info.sheets)
      setMonthlySheets(monthly)

      // Select current month or first available
      if (monthly.length > 0 && !selectedMonth) {
        const currentMonth = new Date().getMonth() + 1
        const currentMonthSheet = monthly.find((s) => s.title === `${currentMonth}월`)
        setSelectedMonth(currentMonthSheet?.title || monthly[0].title)
      }

      // Load all sheets data for summary calculations
      if (monthly.length > 0) {
        const allData: SheetData[] = []
        for (const sheet of monthly) {
          const data = await getSheetData(accessToken, sheet.title)
          if (data) allData.push(data)
        }
        setAllSheetsData(allData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다')
      setHasAccess(false)
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, selectedMonth])

  // Load current sheet data when month changes
  useEffect(() => {
    async function loadSheetData() {
      if (!accessToken || !selectedMonth) return

      setIsLoading(true)
      try {
        const data = await getSheetData(accessToken, selectedMonth)
        setCurrentSheetData(data)

        // Load budget from C2
        const budget = await getBudgetFromSheet(accessToken, selectedMonth)
        setTotalBudget(budget)
      } catch (err) {
        setError(err instanceof Error ? err.message : '시트 데이터를 불러오는데 실패했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    loadSheetData()
  }, [accessToken, selectedMonth])

  // Initial load
  useEffect(() => {
    loadSpreadsheetInfo()
  }, [loadSpreadsheetInfo])

  const selectMonth = useCallback((month: string) => {
    setSelectedMonth(month)
  }, [])

  const refresh = useCallback(() => {
    loadSpreadsheetInfo()
  }, [loadSpreadsheetInfo])

  return {
    spreadsheetInfo,
    monthlySheets,
    currentSheetData,
    allSheetsData,
    totalBudget,
    selectedMonth,
    hasAccess,
    isLoading,
    error,
    selectMonth,
    refresh,
  }
}
