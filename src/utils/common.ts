/**
 * 공통 유틸리티 함수 모음
 */

/**
 * 금액 문자열을 숫자로 파싱
 * @param value - 파싱할 문자열 (예: "1,234원", "-500")
 * @returns 파싱된 숫자 또는 null (파싱 실패 시)
 */
export function parseAmount(value: string): number | null {
  if (!value || value.trim() === '' || value === '-') return null
  // 숫자, 콤마, 마이너스, 소수점만 남기고 제거
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * 날짜 문자열을 Date 객체로 파싱
 * @param dateStr - 파싱할 날짜 문자열 (예: "1/5", "2024. 1. 5")
 * @returns 파싱된 Date 객체 또는 null (파싱 실패 시)
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  
  // "M/D" 형식
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10)
    const day = parseInt(slashMatch[2], 10)
    const year = new Date().getFullYear()
    return new Date(year, month - 1, day)
  }
  
  // "M-D" 형식
  const dashMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})$/)
  if (dashMatch) {
    const month = parseInt(dashMatch[1], 10)
    const day = parseInt(dashMatch[2], 10)
    const year = new Date().getFullYear()
    return new Date(year, month - 1, day)
  }
  
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * 금액을 천단위 콤마 형식으로 포맷
 * @param amount - 포맷할 금액
 * @returns 포맷된 문자열 (예: "1,234")
 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR')
}

/**
 * 금액을 만원 단위로 변환
 * @param amount - 변환할 금액
 * @returns 만원 단위 금액 (반올림)
 */
export function toManwon(amount: number): number {
  return Math.round(amount / 10000)
}

/**
 * 카테고리가 수입인지 확인
 * @param category - 확인할 카테고리 문자열
 * @returns 수입 여부
 */
export function isIncomeCategory(category: string): boolean {
  return category.toLowerCase().includes('수입')
}

/**
 * 카테고리가 지출인지 확인
 * @param category - 확인할 카테고리 문자열
 * @returns 지출 여부
 */
export function isExpenseCategory(category: string): boolean {
  const lower = category.toLowerCase()
  return lower.includes('지출') || lower.includes('여행')
}

/**
 * 카테고리에 따른 색상 반환
 * @param category - 카테고리 문자열
 * @returns 텍스트 색상과 배경 색상 객체 또는 null
 */
export function getCategoryColor(category: string): { text: string; bg: string } | null {
  if (!category) return null
  const lower = category.toLowerCase()
  
  // 수입 카테고리: 파란색
  if (lower.includes('수입')) {
    return { text: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' }
  }
  
  // 지출/여행 카테고리: 붉은색
  if (lower.includes('지출') || lower.includes('여행')) {
    return { text: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' }
  }
  
  return null
}

