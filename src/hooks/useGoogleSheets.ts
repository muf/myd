import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getSpreadsheetInfo,
  getSheetData,
  getCellValue,
  filterMonthlySheets,
  SpreadsheetInfo,
  SheetData,
  ApiErrorType,
} from '../services/sheetsApi'

interface UseGoogleSheetsReturn {
  spreadsheetInfo: SpreadsheetInfo | null
  monthlySheets: { sheetId: number; title: string }[]
  currentSheetData: SheetData | null
  allSheetsData: SheetData[] // 모든 월의 데이터
  totalBudget: number // 총 생활비 예산 (C2 셀)
  selectedMonth: string | null
  hasAccess: boolean | null
  errorType: ApiErrorType | null // 에러 타입
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
  const [allSheetsData, setAllSheetsData] = useState<SheetData[]>([]) // 모든 월의 데이터
  const [totalBudget, setTotalBudget] = useState<number>(0) // 총 생활비 예산
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [errorType, setErrorType] = useState<ApiErrorType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 스프레드시트 정보 로드
  const loadSpreadsheetInfo = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data: info, error: apiError } = await getSpreadsheetInfo(accessToken)
      
      if (apiError || !info) {
        setHasAccess(false)
        setErrorType(apiError?.type || 'unknown')
        setError(apiError?.message || '알 수 없는 오류')
        setSpreadsheetInfo(null)
        setMonthlySheets([])
        return
      }

      setHasAccess(true)
      setErrorType(null)
      setSpreadsheetInfo(info)
      
      const monthly = filterMonthlySheets(info.sheets)
      setMonthlySheets(monthly)

      // 모든 월의 데이터 로드 (순차적으로 - API 할당량 절약)
      if (monthly.length > 0 && accessToken) {
        console.log('Loading all sheets data...')
        const allData: SheetData[] = []
        for (const sheet of monthly) {
          try {
            const data = await getSheetData(accessToken, sheet.title)
            if (data) allData.push(data)
            // API 할당량 보호를 위한 약간의 딜레이
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (e) {
            console.error(`Failed to load sheet ${sheet.title}:`, e)
          }
        }
        setAllSheetsData(allData)
        console.log('All sheets loaded:', allData.length)
      }

      // 현재 월 또는 첫 번째 월 선택
      if (monthly.length > 0) {
        const currentMonth = new Date().getMonth() + 1
        const currentMonthSheet = monthly.find((s) => s.title === `${currentMonth}월`)
        defaultMonth = currentMonthSheet?.title || monthly[0].title
        setSelectedMonth(defaultMonth)

        // C2 셀에서 총 생활비 예산 가져오기
        if (accessToken && defaultMonth) {
          const budgetValue = await getCellValue(accessToken, defaultMonth, 'C2')
          if (budgetValue) {
            const num = parseFloat(budgetValue.replace(/[^\d.,-]/g, '').replace(/,/g, ''))
            if (!isNaN(num)) {
              setTotalBudget(num)
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다')
      setErrorType('unknown')
      setHasAccess(false)
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  // 선택된 월의 데이터 로드
  const loadSheetData = useCallback(async () => {
    if (!accessToken || !selectedMonth) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await getSheetData(accessToken, selectedMonth)
      setCurrentSheetData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '시트 데이터를 불러오는데 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, selectedMonth])

  // 초기 로드
  useEffect(() => {
    loadSpreadsheetInfo()
  }, [loadSpreadsheetInfo])

  // 월 선택 시 데이터 로드
  useEffect(() => {
    if (selectedMonth && hasAccess) {
      loadSheetData()
    }
  }, [selectedMonth, hasAccess, loadSheetData])

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
    errorType,
    isLoading,
    error,
    selectMonth,
    refresh,
  }
}

