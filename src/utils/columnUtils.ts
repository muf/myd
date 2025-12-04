/**
 * 컬럼 관련 유틸리티 함수
 */

import { ColumnName, ColumnConfigMap } from '../types'

/**
 * 컬럼별 기능 설정
 */
export const COLUMN_CONFIG: ColumnConfigMap = {
  '날짜': { sort: true, filter: true },
  '요소': { sort: false, filter: true },
  '지출분류': { sort: false, filter: true },
  '요약': { sort: false, filter: false },
  '금액': { sort: true, filter: false },
  '메모': { sort: false, filter: true },
}

/**
 * 헤더 문자열로부터 컬럼 이름 추출
 * @param header - 헤더 문자열
 * @returns 컬럼 이름 또는 null
 */
export function getColumnName(header: string): ColumnName | null {
  const lower = header.toLowerCase().trim()
  
  if (lower.includes('날짜') || lower.includes('일자') || lower.includes('date')) {
    return '날짜'
  }
  if (lower.includes('요소')) {
    return '요소'
  }
  if (lower.includes('지출분류') || lower.includes('분류')) {
    return '지출분류'
  }
  if (lower.includes('메모')) {
    return '메모'
  }
  if (lower.includes('요약') || lower.includes('내용')) {
    return '요약'
  }
  // 금액 관련 다양한 패턴 매칭
  if (
    lower.includes('금액') ||
    lower.includes('가격') ||
    lower === '수입' ||
    lower === '지출' ||
    lower.includes('원') ||
    lower.includes('money') ||
    lower.includes('amount')
  ) {
    return '금액'
  }
  
  return null
}

