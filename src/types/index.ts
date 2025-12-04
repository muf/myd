/**
 * 공통 타입 정의
 */

/**
 * 데이터 행 타입
 */
export interface DataRow {
  key: string
  [key: string]: string
}

/**
 * 컬럼 이름 타입
 */
export type ColumnName = '날짜' | '요소' | '지출분류' | '요약' | '금액' | '메모'

/**
 * 컬럼 설정 타입
 */
export interface ColumnConfig {
  sort: boolean
  filter: boolean
}

/**
 * 컬럼 설정 맵
 */
export type ColumnConfigMap = Record<ColumnName, ColumnConfig>

/**
 * 카테고리 합계 타입
 */
export interface CategoryTotals {
  all: Record<string, number>
  livingExpense: number
  fixedExpense: number
  otherExpense: number
  travelExpense: number
  savings: number
  payments: number
  totalIncome: number
  actualRemaining: number
}

/**
 * 정렬 설정 타입
 */
export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

/**
 * 예산 기간 정보 타입
 */
export interface BudgetPeriod {
  start: Date
  end: Date
  totalDays: number
  elapsedDays: number
  remainingDays: number
  idealPercent: number
}

