import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getSpreadsheetInfo,
  getSheetData,
  getBudgetFromSheet,
  getLivingExpenseDetails,
  getMonthlyFixedExpense,
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
  livingExpenseDetails: string[][]
  monthlyFixedExpense: number
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
  const [livingExpenseDetails, setLivingExpenseDetails] = useState<string[][]>([])
  const [monthlyFixedExpense, setMonthlyFixedExpense] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  const initialLoadDone = useRef(false)

  // Load spreadsheet info (initial load only)
  useEffect(() => {
    if (!accessToken || initialLoadDone.current) return

    async function loadInitialData() {
      setIsLoading(true)
      setError(null)

      try {
        const info = await getSpreadsheetInfo(accessToken)

        if (!info) {
          setHasAccess(false)
          setSpreadsheetInfo(null)
          setMonthlySheets([])
          setIsLoading(false)
          return
        }

        setHasAccess(true)
        setSpreadsheetInfo(info)

        const monthly = filterMonthlySheets(info.sheets)
        setMonthlySheets(monthly)

        // Select current month or first available
        if (monthly.length > 0) {
          const now = new Date()
          const currentYear = now.getFullYear()
          const currentMonth = now.getMonth() + 1
          const currentMonthSheet = monthly.find((s) => s.title === `${currentYear}년 ${currentMonth}월`)
          setSelectedMonth(currentMonthSheet?.title || monthly[0].title)
        }

        // Load monthly fixed expense from "정보" sheet D23
        const fixedExp = await getMonthlyFixedExpense(accessToken)
        setMonthlyFixedExpense(fixedExp)

        // Note: allSheetsData는 선택된 월의 데이터로만 업데이트됨 (429 에러 방지)
        initialLoadDone.current = true
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다')
        setHasAccess(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [accessToken])

  // Load current sheet data when month changes or refresh triggered
  useEffect(() => {
    if (!accessToken || !selectedMonth) return

    async function loadSheetData() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getSheetData(accessToken, selectedMonth!)
        setCurrentSheetData(data)
        
        // allSheetsData에 현재 시트 데이터 추가/업데이트
        if (data) {
          setAllSheetsData(prev => {
            const filtered = prev.filter(s => s.sheetTitle !== data.sheetTitle)
            return [...filtered, data]
          })
        }

        // Load budget from C2
        const budget = await getBudgetFromSheet(accessToken, selectedMonth!)
        setTotalBudget(budget)

        // Load living expense details from B10:F20
        const details = await getLivingExpenseDetails(accessToken, selectedMonth!)
        setLivingExpenseDetails(details)
      } catch (err) {
        setError(err instanceof Error ? err.message : '시트 데이터를 불러오는데 실패했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    loadSheetData()
  }, [accessToken, selectedMonth, refreshTrigger])

  const selectMonth = useCallback((month: string) => {
    setSelectedMonth(month)
  }, [])

  // 현재 선택된 월의 데이터만 새로고침 (429 에러 방지)
  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  return {
    spreadsheetInfo,
    monthlySheets,
    currentSheetData,
    allSheetsData,
    totalBudget,
    livingExpenseDetails,
    monthlyFixedExpense,
    selectedMonth,
    hasAccess,
    isLoading,
    error,
    selectMonth,
    refresh,
  }
}
