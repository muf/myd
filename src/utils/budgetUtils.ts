/**
 * 예산 관련 유틸리티 함수
 */

import type { BudgetPeriod } from '../types'

/**
 * 선택된 월에 따른 예산 기간 계산 (25일 기준)
 * @param selectedMonth - 선택된 월 문자열 (예: "2024년 1월")
 * @returns 예산 기간 정보
 */
export function getBudgetPeriodForMonth(selectedMonth: string | null): BudgetPeriod {
  const now = new Date()
  
  let targetYear = now.getFullYear()
  let targetMonth = now.getMonth() + 1
  
  if (selectedMonth) {
    const match = selectedMonth.match(/(\d{4})년 (\d{1,2})월/)
    if (match) {
      targetYear = parseInt(match[1], 10)
      targetMonth = parseInt(match[2], 10)
    }
  }

  let startYear = targetYear
  let endYear = targetYear
  
  if (targetMonth === 1) {
    startYear = targetYear - 1
  }
  
  const startMonth = targetMonth === 1 ? 11 : targetMonth - 2
  const endMonth = targetMonth - 1

  const start = new Date(startYear, startMonth, 25)
  const end = new Date(endYear, endMonth, 24)

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  elapsedDays = Math.max(0, Math.min(elapsedDays, totalDays))
  const remainingDays = Math.max(1, totalDays - elapsedDays + 1)
  const idealPercent = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0

  return { start, end, totalDays, elapsedDays, remainingDays, idealPercent }
}

