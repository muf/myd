import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Input, Empty, Select, Button, Spin, Card } from 'antd'
import { SearchOutlined, LoadingOutlined } from '@ant-design/icons'
import { SheetData } from '../services/sheetsApi'
import { useTheme } from '../contexts/ThemeContext'

interface DataTableProps {
  data: SheetData | null
  isLoading: boolean
}

interface DataRow {
  key: string
  [key: string]: string
}

// 컬럼 이름 매핑 (헤더 텍스트 기준)
type ColumnName = '날짜' | '요소' | '지출분류' | '요약' | '금액'

// 컬럼별 기능 정의
const COLUMN_CONFIG: Record<ColumnName, { sort: boolean; filter: boolean }> = {
  '날짜': { sort: true, filter: true },
  '요소': { sort: false, filter: true },
  '지출분류': { sort: false, filter: true },
  '요약': { sort: false, filter: false },
  '금액': { sort: true, filter: false },
}

// 날짜 파싱 함수
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10)
    const day = parseInt(slashMatch[2], 10)
    const year = new Date().getFullYear()
    return new Date(year, month - 1, day)
  }
  
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

// 숫자 파싱 함수
function parseNumber(value: string): number | null {
  if (!value || value.trim() === '' || value === '-') return null
  // 숫자, 콤마, 마이너스, 소수점만 남기고 제거
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// 컬럼 타입 확인
function getColumnName(header: string): ColumnName | null {
  const lower = header.toLowerCase().trim()
  if (lower.includes('날짜') || lower.includes('일자') || lower.includes('date')) return '날짜'
  if (lower.includes('요소')) return '요소'
  if (lower.includes('지출분류') || lower.includes('분류')) return '지출분류'
  if (lower.includes('요약') || lower.includes('내용') || lower.includes('메모')) return '요약'
  // 금액 관련 다양한 패턴 매칭
  if (lower.includes('금액') || lower.includes('가격') || lower === '수입' || lower === '지출' || lower.includes('원') || lower.includes('money') || lower.includes('amount')) return '금액'
  return null
}

// 카테고리에 따른 행 색상 결정
function getRowColorByCategory(category: string): { text: string; bg: string } | null {
  if (!category) return null
  const lower = category.toLowerCase()
  
  // 수입 카테고리: 파스텔 파란색
  if (lower.includes('수입')) {
    return { text: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' }
  }
  
  // 지출, 여행 카테고리: 파스텔 붉은색
  if (lower.includes('지출') || lower.includes('여행')) {
    return { text: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' }
  }
  
  return null
}

const ITEMS_PER_PAGE = 20

export function DataTable({ data, isLoading }: DataTableProps) {
  const { isDark } = useTheme()
  const [searchText, setSearchText] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  // 데이터 변환
  const allData = useMemo(() => {
    if (!data || data.rows.length === 0) return []

    const rows: DataRow[] = data.rows.map((row, index) => {
      const rowData: DataRow = { key: `row-${index}` }
      data.headers.forEach((_, colIndex) => {
        rowData[`col_${colIndex}`] = row[colIndex] || ''
      })
      return rowData
    })

    return rows
  }, [data])

  // 정렬 적용
  const sortedData = useMemo(() => {
    let result = [...allData]
    
    // 날짜 컬럼 찾기
    const dateColIndex = data?.headers.findIndex((h) => getColumnName(h) === '날짜') ?? -1
    
    if (sortConfig) {
      const colIndex = parseInt(sortConfig.key.replace('col_', ''), 10)
      const columnName = data?.headers[colIndex] ? getColumnName(data.headers[colIndex]) : null
      const isAmount = columnName === '금액'
      const isDate = columnName === '날짜'

      result.sort((a, b) => {
        const valA = a[sortConfig.key]
        const valB = b[sortConfig.key]

        let comparison = 0
        if (isAmount) {
          const numA = parseNumber(valA) ?? 0
          const numB = parseNumber(valB) ?? 0
          comparison = numA - numB
        } else if (isDate) {
          const dateA = parseDate(valA)
          const dateB = parseDate(valB)
          if (!dateA && !dateB) comparison = 0
          else if (!dateA) comparison = 1
          else if (!dateB) comparison = -1
          else comparison = dateA.getTime() - dateB.getTime()
        } else {
          comparison = valA.localeCompare(valB, 'ko')
        }

        return sortConfig.direction === 'desc' ? -comparison : comparison
      })
    } else if (dateColIndex >= 0) {
      // 기본: 날짜 내림차순
      result.sort((a, b) => {
        const dateA = parseDate(a[`col_${dateColIndex}`])
        const dateB = parseDate(b[`col_${dateColIndex}`])
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.getTime() - dateA.getTime()
      })
    }

    return result
  }, [allData, sortConfig, data?.headers])

  // 전체 검색 + 컬럼 필터 적용
  const filteredData = useMemo(() => {
    let result = sortedData

    if (searchText.trim()) {
      const search = searchText.toLowerCase()
      result = result.filter((row) => {
        return Object.keys(row)
          .filter((key) => key.startsWith('col_'))
          .some((key) => row[key]?.toLowerCase().includes(search))
      })
    }

    Object.entries(columnFilters).forEach(([colKey, values]) => {
      if (values && values.length > 0) {
        result = result.filter((row) => values.includes(row[colKey]))
      }
    })

    return result
  }, [sortedData, searchText, columnFilters])

  // 현재 표시할 데이터
  const visibleData = useMemo(() => {
    return filteredData.slice(0, visibleCount)
  }, [filteredData, visibleCount])

  const hasMore = visibleCount < filteredData.length

  // 금액 합산 계산 (지출분류 카테고리 기준)
  const totalAmount = useMemo(() => {
    if (!data) return { income: 0, expense: 0 }
    
    // 금액 컬럼 찾기
    let amountColIndex = data.headers.findIndex((h) => h && h.includes('금액'))
    if (amountColIndex < 0) {
      for (let i = data.headers.length - 1; i >= 0; i--) {
        const header = data.headers[i]
        if (header && header.trim() && !header.toLowerCase().startsWith('column')) {
          amountColIndex = i
          break
        }
      }
    }

    // 지출분류 컬럼 찾기
    const categoryColIndex = data.headers.findIndex((h) => h && (h.includes('지출분류') || h.includes('분류')))

    if (amountColIndex < 0) return { income: 0, expense: 0 }

    let income = 0
    let expense = 0

    filteredData.forEach((row) => {
      const value = row[`col_${amountColIndex}`]
      const category = categoryColIndex >= 0 ? row[`col_${categoryColIndex}`] : ''
      const num = parseNumber(value)
      
      if (num !== null && category) {
        const categoryLower = category.toLowerCase()
        
        // 지출: "~~지출", "여행"
        if (categoryLower.includes('지출') || categoryLower.includes('여행')) {
          expense += Math.abs(num)
        }
        // 수입: "수입"
        else if (categoryLower.includes('수입')) {
          income += Math.abs(num)
        }
        // 저금, 대금은 변동없음 (합산 제외)
      }
    })

    return { income, expense }
  }, [filteredData, data])

  // 더보기 로드 함수
  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return
    
    setIsLoadingMore(true)
    setTimeout(() => {
      setVisibleCount((prev) => prev + ITEMS_PER_PAGE)
      setIsLoadingMore(false)
    }, 200)
  }, [hasMore, isLoadingMore])

  // Intersection Observer로 무한 스크롤 구현
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first.isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    const currentLoader = loaderRef.current
    if (currentLoader) {
      observer.observe(currentLoader)
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader)
      }
    }
  }, [hasMore, isLoadingMore, loadMore])

  // 검색어/필터 변경 시 표시 개수 초기화
  const handleSearchChange = (value: string) => {
    setSearchText(value)
    setVisibleCount(ITEMS_PER_PAGE)
  }

  const handleFilterChange = (colKey: string, values: string[]) => {
    setColumnFilters((prev) => ({
      ...prev,
      [colKey]: values,
    }))
    setVisibleCount(ITEMS_PER_PAGE)
  }

  const handleSort = (colKey: string) => {
    setSortConfig((prev) => {
      if (prev?.key === colKey) {
        if (prev.direction === 'desc') return { key: colKey, direction: 'asc' }
        return null // 정렬 해제
      }
      return { key: colKey, direction: 'desc' }
    })
  }

  // 각 컬럼의 고유값 추출
  const getUniqueValues = (colIndex: number): string[] => {
    const values = allData.map((row) => row[`col_${colIndex}`]).filter(Boolean)
    return [...new Set(values)].sort()
  }

  // 필터 가능한 컬럼 정보 (빈 헤더, "Column"으로 시작하는 헤더 제외)
  const filterableColumns = useMemo(() => {
    if (!data) return []
    
    return data.headers
      .map((header, index) => {
        // 빈 헤더 또는 "Column"으로 시작하는 헤더 제외
        if (!header || header.trim() === '' || header.toLowerCase().startsWith('column')) {
          return null
        }
        const columnName = getColumnName(header)
        const config = columnName ? COLUMN_CONFIG[columnName] : null
        if (config?.filter) {
          return {
            index,
            header,
            columnName,
            dataIndex: `col_${index}`,
            options: getUniqueValues(index),
          }
        }
        return null
      })
      .filter(Boolean) as Array<{
        index: number
        header: string
        columnName: ColumnName
        dataIndex: string
        options: string[]
      }>
  }, [data, allData])

  // 컬럼 설정 (빈 헤더, "Column"으로 시작하는 헤더 제외)
  const columnSettings = useMemo(() => {
    if (!data) return []
    return data.headers
      .map((header, index) => {
        // 빈 헤더 또는 "Column"으로 시작하는 헤더 제외
        if (!header || header.trim() === '' || header.toLowerCase().startsWith('column')) {
          return null
        }
        const columnName = getColumnName(header)
        const config = columnName ? COLUMN_CONFIG[columnName] : { sort: false, filter: false }
        return {
          index,
          header,
          columnName,
          dataIndex: `col_${index}`,
          ...config,
          isAmount: columnName === '금액',
        }
      })
      .filter(Boolean) as Array<{
        index: number
        header: string
        columnName: ColumnName | null
        dataIndex: string
        sort: boolean
        filter: boolean
        isAmount: boolean
      }>
  }, [data])

  if (isLoading && allData.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-lg overflow-hidden">
        <Empty description="데이터가 없습니다" className="py-12" />
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 검색 및 필터 영역 */}
      <div
        className="p-3 sm:p-4 rounded-lg space-y-3"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(249, 250, 251, 0.8)',
          border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        }}
      >
        {/* 전체 검색 */}
        <Input
          placeholder="전체 검색..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          allowClear
          size="large"
          style={{ background: isDark ? '#1e293b' : '#ffffff' }}
        />

        {/* 컬럼 필터 - 모바일에서 세로 배치 */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
          {filterableColumns.map((col) => (
            <Select
              key={col.dataIndex}
              mode="multiple"
              placeholder={`${col.header}`}
              value={columnFilters[col.dataIndex] || []}
              onChange={(values) => handleFilterChange(col.dataIndex, values)}
              className="w-full sm:w-auto"
              style={{ minWidth: 120 }}
              maxTagCount={1}
              allowClear
              options={col.options.map((opt) => ({ label: opt, value: opt }))}
            />
          ))}
          {(searchText || Object.values(columnFilters).some((v) => v?.length > 0)) && (
            <Button
              onClick={() => {
                setSearchText('')
                setColumnFilters({})
                setVisibleCount(ITEMS_PER_PAGE)
              }}
              className="w-full sm:w-auto"
            >
              필터 초기화
            </Button>
          )}
        </div>
      </div>

      {/* 결과 개수 및 금액 합산 */}
      <div
        className="p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(249, 250, 251, 0.5)',
          border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        }}
      >
        <div className="text-xs sm:text-sm text-gray-500">
          검색 결과: <span className="font-medium" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>{filteredData.length}개</span>
          {filteredData.length !== allData.length && (
            <span className="ml-1">(전체 {allData.length}개)</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">수입:</span>
            <span className="font-mono font-bold text-blue-500">
              +{totalAmount.income.toLocaleString('ko-KR')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">지출:</span>
            <span className="font-mono font-bold text-red-500">
              -{totalAmount.expense.toLocaleString('ko-KR')}
            </span>
          </div>
        </div>
      </div>

      {/* 모바일: 카드 형식 / 데스크탑: 테이블 형식 */}
      <div className="hidden sm:block overflow-x-auto rounded-lg" style={{ border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: isDark ? '#1e293b' : '#f9fafb' }}>
              {columnSettings.map((col) => (
                <th
                  key={col.dataIndex}
                  className={`px-3 py-3 text-left font-medium whitespace-nowrap ${col.sort ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                  style={{
                    color: isDark ? '#f8fafc' : '#1f2937',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                  }}
                  onClick={() => col.sort && handleSort(col.dataIndex)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sort && (
                      <span className="text-xs text-gray-400">
                        {sortConfig?.key === col.dataIndex
                          ? sortConfig.direction === 'desc' ? '↓' : '↑'
                          : '↕'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row) => {
              // 지출분류 컬럼에서 카테고리 값 가져오기
              const categoryCol = columnSettings.find((c) => c.columnName === '지출분류')
              const category = categoryCol ? row[categoryCol.dataIndex] : ''
              const rowColor = getRowColorByCategory(category)
              
              // 카테고리에 따라 지출/수입 판단
              const isExpenseCategory = category && (category.includes('지출') || category.includes('여행'))
              const isIncomeCategory = category && category.includes('수입')
              
              return (
                <tr
                  key={row.key}
                  className="hover:bg-opacity-50"
                  style={{ 
                    background: rowColor?.bg || (isDark ? '#1e293b' : '#ffffff'),
                  }}
                >
                  {columnSettings.map((col) => {
                    const value = row[col.dataIndex]
                    const num = col.isAmount ? parseNumber(value) : null
                    
                    // 금액 컬럼: 카테고리에 따라 색상 결정
                    let textColor = rowColor?.text || (isDark ? '#f8fafc' : '#1f2937')
                    if (col.isAmount && num !== null) {
                      if (isExpenseCategory) {
                        textColor = '#f87171' // 지출: 붉은색
                      } else if (isIncomeCategory) {
                        textColor = '#60a5fa' // 수입: 파란색
                      }
                    }
                    
                    return (
                      <td
                        key={col.dataIndex}
                        className={`px-3 py-2.5 ${col.isAmount ? 'text-right font-mono' : ''}`}
                        style={{
                          color: textColor,
                          borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                        }}
                      >
                        {!value ? (
                          <span className="text-gray-400">-</span>
                        ) : col.isAmount && num !== null ? (
                          <span className="font-medium">
                            {isExpenseCategory ? '-' : isIncomeCategory ? '+' : ''}{Math.abs(num).toLocaleString('ko-KR')}
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 뷰 */}
      <div className="sm:hidden space-y-3">
        {visibleData.map((row) => {
          const dateCol = columnSettings.find((c) => c.columnName === '날짜')
          const amountCol = columnSettings.find((c) => c.columnName === '금액')
          const summaryCol = columnSettings.find((c) => c.columnName === '요약')
          const categoryCol = columnSettings.find((c) => c.columnName === '지출분류')
          const elementCol = columnSettings.find((c) => c.columnName === '요소')

          const date = dateCol ? row[dateCol.dataIndex] : ''
          const amount = amountCol ? row[amountCol.dataIndex] : ''
          const summary = summaryCol ? row[summaryCol.dataIndex] : ''
          const category = categoryCol ? row[categoryCol.dataIndex] : ''
          const element = elementCol ? row[elementCol.dataIndex] : ''
          
          const num = parseNumber(amount)
          const rowColor = getRowColorByCategory(category)
          
          // 카테고리에 따라 지출/수입 판단
          const isExpenseCategory = category && (category.includes('지출') || category.includes('여행'))
          const isIncomeCategory = category && category.includes('수입')

          return (
            <Card
              key={row.key}
              size="small"
              style={{
                background: rowColor?.bg || (isDark ? '#1e293b' : '#ffffff'),
                border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs" style={{ color: rowColor?.text || '#9ca3af' }}>{date}</span>
                    {category && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: rowColor ? 'rgba(255,255,255,0.1)' : (isDark ? '#334155' : '#e5e7eb'),
                          color: rowColor?.text || (isDark ? '#94a3b8' : '#6b7280'),
                        }}
                      >
                        {category}
                      </span>
                    )}
                  </div>
                  <div className="font-medium truncate" style={{ color: rowColor?.text || (isDark ? '#f8fafc' : '#1f2937') }}>
                    {summary || element || '-'}
                  </div>
                  {element && summary && (
                    <div className="text-xs truncate" style={{ color: rowColor?.text ? `${rowColor.text}99` : '#9ca3af' }}>{element}</div>
                  )}
                </div>
                <div
                  className="font-mono font-bold text-base flex-shrink-0"
                  style={{
                    color: isExpenseCategory ? '#f87171' : isIncomeCategory ? '#60a5fa' : (rowColor?.text || '#9ca3af')
                  }}
                >
                  {num !== null ? (
                    <>
                      {isExpenseCategory ? '-' : isIncomeCategory ? '+' : ''}
                      {Math.abs(num).toLocaleString('ko-KR')}
                    </>
                  ) : amount || '-'}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* 무한 스크롤 로더 */}
      {hasMore && (
        <div ref={loaderRef} className="flex justify-center items-center py-6">
          {isLoadingMore ? (
            <div className="flex items-center gap-2">
              <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
              <span className="text-gray-500 text-sm">불러오는 중...</span>
            </div>
          ) : (
            <span className="text-gray-400 text-xs sm:text-sm">
              스크롤하여 더 보기 ({filteredData.length - visibleCount}개)
            </span>
          )}
        </div>
      )}

      {!hasMore && filteredData.length > ITEMS_PER_PAGE && (
        <div className="text-center py-4 text-gray-400 text-xs sm:text-sm">
          모든 항목을 불러왔습니다
        </div>
      )}
    </div>
  )
}
