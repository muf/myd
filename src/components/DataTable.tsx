import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Input, Empty, Select, Button, Spin, Card, DatePicker, Modal, message, Statistic } from 'antd'
import { SearchOutlined, LoadingOutlined, DeleteOutlined, ExclamationCircleOutlined, BarChartOutlined, TableOutlined } from '@ant-design/icons'
import { Line } from '@ant-design/charts'
import { SheetData, deleteSheetRow } from '../services/sheetsApi'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { parseAmount, parseDate, getCategoryColor } from '../utils/common'
import { getColumnName, COLUMN_CONFIG } from '../utils/columnUtils'
import type { DataRow, ColumnName } from '../types'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

const { RangePicker } = DatePicker

interface DataTableProps {
  data: SheetData | null
  isLoading: boolean
  hideFilters?: boolean
  sheetId?: number
  onDataChange?: () => void
}

const ITEMS_PER_PAGE = 30
const ENABLE_DELETE = false // 삭제 기능 임시 비활성화

export function DataTable({ data, isLoading, hideFilters = false, sheetId, onDataChange }: DataTableProps) {
  const { isDark } = useTheme()
  const { accessToken } = useAuth()
  const [searchText, setSearchText] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null)
  const [showChart, setShowChart] = useState(false)

  // 삭제 핸들러
  const handleDelete = useCallback(async (rowIndex: number, rowData: DataRow) => {
    if (!sheetId || !accessToken || !onDataChange) return

    // 삭제할 데이터 요약 생성
    const summary = `${rowData.col_0 || ''} ${rowData.col_3 || ''} ${rowData.col_4 || ''}`
    
    Modal.confirm({
      title: '데이터 삭제',
      icon: <ExclamationCircleOutlined />,
      content: `정말로 이 항목을 삭제하시겠습니까?\n\n${summary.trim() || '(데이터 없음)'}`,
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      async onOk() {
        setDeletingRowIndex(rowIndex)
        try {
          const success = await deleteSheetRow(accessToken, sheetId, rowIndex)
          if (success) {
            message.success('데이터가 삭제되었습니다.')
            onDataChange()
          } else {
            message.error('데이터 삭제에 실패했습니다.')
          }
        } catch (error) {
          console.error('Delete error:', error)
          message.error('데이터 삭제 중 오류가 발생했습니다.')
        } finally {
          setDeletingRowIndex(null)
        }
      },
    })
  }, [sheetId, accessToken, onDataChange])

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
          const numA = parseAmount(valA) ?? 0
          const numB = parseAmount(valB) ?? 0
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

    // 날짜 범위 필터 적용
    if (dateRange && dateRange[0] && dateRange[1]) {
      const dateColKey = columnSettings.find(col => col.columnName === '날짜')?.dataIndex
      if (dateColKey) {
        const startDate = dateRange[0].startOf('day')
        const endDate = dateRange[1].endOf('day')
        
        result = result.filter((row) => {
          const dateStr = row[dateColKey]
          const rowDate = parseDate(dateStr)
          if (!rowDate) return false
          
          const rowDayjs = dayjs(rowDate)
          return rowDayjs.isSameOrAfter(startDate) && rowDayjs.isSameOrBefore(endDate)
        })
      }
    }

    Object.entries(columnFilters).forEach(([colKey, values]) => {
      if (values && values.length > 0) {
        result = result.filter((row) => values.includes(row[colKey]))
      }
    })

    return result
  }, [sortedData, searchText, columnFilters, dateRange, columnSettings])

  // 현재 표시할 데이터
  const visibleData = useMemo(() => {
    return filteredData.slice(0, visibleCount)
  }, [filteredData, visibleCount])

  const hasMore = visibleCount < filteredData.length

  // 일별 집계 데이터 (필터링된 데이터 기준) - @ant-design/charts 형식
  const dailyChartData = useMemo(() => {
    if (!data || filteredData.length === 0) return []

    const dateCol = columnSettings.find((c) => c.columnName === '날짜')
    const categoryCol = columnSettings.find((c) => c.columnName === '지출분류')
    const amountCol = columnSettings.find((c) => c.columnName === '금액')

    if (!dateCol || !categoryCol || !amountCol) return []

    // 일별 집계 맵
    const dailyMap = new Map<string, { date: string; dateLabel: string; expense: number }>()

    filteredData.forEach((row) => {
      const dateStr = row[dateCol.dataIndex]
      const category = row[categoryCol.dataIndex] || ''
      const amountStr = row[amountCol.dataIndex] || '0'
      const amount = parseAmount(amountStr)

      if (!dateStr || amount === null) return

      // "생활비 지출"만 대상으로
      if (category !== '생활비 지출') return

      // 날짜 파싱 (YYYY. M. D 형식)
      const parsed = dayjs(dateStr.replace(/\./g, '-').trim())
      if (!parsed.isValid()) return

      const dateKey = parsed.format('YYYY-MM-DD')
      const dateLabel = parsed.format('M/D')

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, dateLabel, expense: 0 })
      }

      const daily = dailyMap.get(dateKey)!
      daily.expense += Math.abs(amount)
    })

    // 날짜순 정렬하고 @ant-design/charts 형식으로 변환
    const sorted = Array.from(dailyMap.values()).sort((a, b) => {
      return a.date.localeCompare(b.date)
    })

    // Line 차트용 데이터 형식: [{ date, value }] - 생활비 지출만, 만원 단위로
    const chartData: { date: string; value: number }[] = []
    sorted.forEach((d) => {
      chartData.push({
        date: d.dateLabel,
        value: Math.round(d.expense / 10000), // 만원 단위로 변환
      })
    })

    return chartData
  }, [data, filteredData, columnSettings])

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
      const num = parseAmount(value)
      
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
      {!hideFilters && (
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
            {filterableColumns.map((col) => {
              // 날짜 컬럼은 DateRangePicker 사용
              if (col.columnName === '날짜') {
                return (
                  <div key={col.dataIndex} className="w-full sm:w-auto">
                    <RangePicker
                      placeholder={['시작일', '종료일']}
                      value={dateRange}
                      onChange={(dates) => {
                        setDateRange(dates as [Dayjs | null, Dayjs | null] | null)
                        setVisibleCount(ITEMS_PER_PAGE)
                      }}
                      className="w-full"
                      style={{ maxWidth: '100%' }}
                      allowClear
                      format="YYYY-MM-DD"
                      placement="bottomLeft"
                      getPopupContainer={(trigger) => trigger.parentElement?.parentElement || document.body}
                    />
                  </div>
                )
              }
              
              // 다른 컬럼은 기존 Select 사용
              return (
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
              )
            })}
            {(searchText || dateRange || Object.values(columnFilters).some((v) => v?.length > 0)) && (
              <Button
                onClick={() => {
                  setSearchText('')
                  setColumnFilters({})
                  setDateRange(null)
                  setVisibleCount(ITEMS_PER_PAGE)
                }}
                className="w-full sm:w-auto"
              >
                필터 초기화
              </Button>
            )}
          </div>
        </div>
      )}

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
          <Button
            type={showChart ? 'primary' : 'default'}
            icon={showChart ? <TableOutlined /> : <BarChartOutlined />}
            size="small"
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? '목록' : '차트'}
          </Button>
        </div>
      </div>

      {/* 일별 차트 */}
      {showChart && dailyChartData.length > 0 && (
        <div
          className="p-4 rounded-lg space-y-4"
          style={{
            background: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
          }}
        >
          <h3 className="text-lg font-semibold" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>
            일별 생활비 지출 추이
          </h3>
          
          {/* 합계 통계 */}
          <div className="flex justify-center">
            <Statistic
              title={<span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>총 생활비 지출</span>}
              value={dailyChartData.reduce((sum, d) => sum + d.value, 0)}
              precision={0}
              valueStyle={{ color: '#f87171', fontSize: '24px' }}
              suffix="만원"
            />
          </div>

          {/* Line Chart */}
          <div className="mt-4">
            <Line
              data={dailyChartData}
              xField="date"
              yField="value"
              smooth={true}
              animation={{
                appear: {
                  animation: 'path-in',
                  duration: 1000,
                },
              }}
              color="#f87171"
              yAxis={{
                title: {
                  text: '생활비 지출 (만원)',
                  style: {
                    fill: isDark ? '#9ca3af' : '#6b7280',
                    fontSize: 12,
                  },
                },
                label: {
                  formatter: (v: string) => {
                    return parseFloat(v).toLocaleString('ko-KR')
                  },
                  style: {
                    fill: isDark ? '#9ca3af' : '#6b7280',
                  },
                },
                grid: {
                  line: {
                    style: {
                      stroke: isDark ? '#334155' : '#e5e7eb',
                      lineDash: [4, 4],
                    },
                  },
                },
              }}
              xAxis={{
                title: {
                  text: '날짜',
                  style: {
                    fill: isDark ? '#9ca3af' : '#6b7280',
                    fontSize: 12,
                  },
                },
                label: {
                  style: {
                    fill: isDark ? '#9ca3af' : '#6b7280',
                  },
                  autoRotate: true,
                  autoHide: true,
                },
              }}
              tooltip={{
                showTitle: true,
                title: (title: string) => title,
                showMarkers: true,
                formatter: (datum: any) => {
                  return {
                    name: '생활비 지출',
                    value: `${datum.value.toLocaleString('ko-KR')}만원`,
                  }
                },
                domStyles: {
                  'g2-tooltip': {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    color: isDark ? '#f8fafc' : '#1f2937',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '14px',
                  },
                },
              }}
              label={{
                style: {
                  fill: '#f87171',
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'center',
                },
                formatter: (datum: any) => {
                  // 0이 아닌 값만 표시
                  return datum.value > 0 ? `${datum.value}` : ''
                },
                offsetY: -10,
              }}
              point={{
                size: 6,
                shape: 'circle',
                style: {
                  fill: '#f87171',
                  stroke: '#ffffff',
                  lineWidth: 2,
                  shadowColor: 'rgba(248, 113, 113, 0.3)',
                  shadowBlur: 4,
                },
              }}
              theme={isDark ? 'dark' : 'light'}
            />
          </div>
        </div>
      )}

      {/* 모바일: 카드 형식 / 데스크탑: 테이블 형식 */}
      {!showChart && (
      <div className="hidden sm:block overflow-x-auto rounded-lg" style={{ border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: isDark ? '#1e293b' : '#f9fafb' }}>
              {columnSettings.map((col) => {
                // 이 컬럼에 대한 필터 정보 찾기
                const filterCol = filterableColumns.find(fc => fc.dataIndex === col.dataIndex)
                
                return (
                  <th
                    key={col.dataIndex}
                    className="px-3 py-3 text-left font-medium whitespace-nowrap"
                    style={{
                      color: isDark ? '#f8fafc' : '#1f2937',
                      borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {/* 헤더 텍스트 + 정렬 */}
                      <span 
                        className={`flex items-center gap-1 ${col.sort ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => col.sort && handleSort(col.dataIndex)}
                      >
                        {col.header}
                        {col.sort && (
                          <span className="text-xs text-gray-400">
                            {sortConfig?.key === col.dataIndex
                              ? sortConfig.direction === 'desc' ? '↓' : '↑'
                              : '↕'}
                          </span>
                        )}
                      </span>
                      
                      {/* 필터 드롭다운 */}
                      {filterCol && (
                        <Select
                          mode="multiple"
                          placeholder={`필터`}
                          value={columnFilters[col.dataIndex] || []}
                          onChange={(values) => handleFilterChange(col.dataIndex, values)}
                          className="w-full"
                          size="small"
                          maxTagCount={0}
                          maxTagPlaceholder={(omittedValues) => `${omittedValues.length}개 선택`}
                          allowClear
                          options={filterCol.options.map((opt) => ({ label: opt, value: opt }))}
                          style={{ minWidth: 100 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  </th>
                )
              })}
              {/* 작업 컬럼 (삭제 버튼) */}
              {ENABLE_DELETE && sheetId && onDataChange && (
                <th
                  className="px-3 py-3 text-center font-medium whitespace-nowrap"
                  style={{
                    color: isDark ? '#f8fafc' : '#1f2937',
                    borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                    width: '80px',
                  }}
                >
                  작업
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleData.map((row) => {
              // 지출분류 컬럼에서 카테고리 값 가져오기
              const categoryCol = columnSettings.find((c) => c.columnName === '지출분류')
              const category = categoryCol ? row[categoryCol.dataIndex] : ''
              const rowColor = getCategoryColor(category)
              
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
                    const num = col.isAmount ? parseAmount(value) : null
                    
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
                  {/* 삭제 버튼 */}
                  {ENABLE_DELETE && sheetId && onDataChange && (
                    <td
                      className="px-3 py-2.5 text-center"
                      style={{
                        borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                      }}
                    >
                      <Button
                        type="text"
                        icon={<DeleteOutlined style={{ fontSize: '18px' }} />}
                        size="middle"
                        danger
                        onClick={() => handleDelete(parseInt(row.key.split('-')[1]), row)}
                        loading={deletingRowIndex === parseInt(row.key.split('-')[1])}
                        disabled={deletingRowIndex !== null}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* 모바일 카드 뷰 */}
      {!showChart && (
      <div className="sm:hidden space-y-3">
        {visibleData.map((row) => {
          const dateCol = columnSettings.find((c) => c.columnName === '날짜')
          const amountCol = columnSettings.find((c) => c.columnName === '금액')
          const summaryCol = columnSettings.find((c) => c.columnName === '요약')
          const categoryCol = columnSettings.find((c) => c.columnName === '지출분류')
          const elementCol = columnSettings.find((c) => c.columnName === '요소')
          const memoCol = columnSettings.find((c) => c.columnName === '메모')

          const date = dateCol ? row[dateCol.dataIndex] : ''
          const amount = amountCol ? row[amountCol.dataIndex] : ''
          const summary = summaryCol ? row[summaryCol.dataIndex] : ''
          const category = categoryCol ? row[categoryCol.dataIndex] : ''
          const element = elementCol ? row[elementCol.dataIndex] : ''
          const memo = memoCol ? row[memoCol.dataIndex] : ''
          
          
          const num = parseAmount(amount)
          const rowColor = getCategoryColor(category)
          
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
              <div className="flex flex-col gap-2">
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
                      {memo && memo.trim() && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: rowColor ? 'rgba(255,255,255,0.08)' : (isDark ? '#1e293b' : '#f3f4f6'),
                            color: rowColor?.text ? `${rowColor.text}cc` : (isDark ? '#94a3b8' : '#6b7280'),
                            border: `1px solid ${rowColor ? 'rgba(255,255,255,0.15)' : (isDark ? '#334155' : '#e5e7eb')}`,
                          }}
                        >
                          {memo}
                        </span>
                      )}
                    </div>
                    <div className="font-medium truncate" style={{ color: rowColor?.text || (isDark ? '#f8fafc' : '#1f2937') }}>
                      {summary || element || '-'}
                    </div>
                    {element && summary && (
                      <div className="text-xs truncate" style={{ color: rowColor?.text ? `${rowColor.text}99` : '#9ca3af' }}>
                        {element.trim().startsWith('-') ? element : `- ${element}`}
                      </div>
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
                {ENABLE_DELETE && sheetId && onDataChange && (
                  <div className="flex justify-end">
                    <Button
                      type="text"
                      icon={<DeleteOutlined style={{ fontSize: '18px' }} />}
                      size="middle"
                      danger
                      onClick={() => handleDelete(parseInt(row.key.split('-')[1]), row)}
                      loading={deletingRowIndex === parseInt(row.key.split('-')[1])}
                      disabled={deletingRowIndex !== null}
                      style={{ padding: '8px' }}
                    />
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      )}

      {/* 무한 스크롤 로더 */}
      {!showChart && hasMore && (
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

      {!showChart && !hasMore && filteredData.length > ITEMS_PER_PAGE && (
        <div className="text-center py-4 text-gray-400 text-xs sm:text-sm">
          모든 항목을 불러왔습니다
        </div>
      )}
    </div>
  )
}
