import { useMemo, useState } from 'react'
import { Progress, Modal } from 'antd'
import { CalendarOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'
import { DataTable } from './DataTable'
import { SheetData } from '../services/sheetsApi'

interface CategoryTotals {
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

interface SheetData {
  sheetTitle: string
  headers: string[]
  rows: string[][]
}

interface BudgetSummaryProps {
  totalBudget: number
  categoryTotals: CategoryTotals
  selectedMonth: string | null
  selectedYear: number | null
  livingExpenseDetails: string[][]
  currentSheetData: SheetData | null
  allSheetsData: SheetData[]
  monthlyFixedExpense: number
}

// 선택된 월에 따른 예산 기간 계산 (25일 기준)
function getBudgetPeriodForMonth(selectedMonth: string | null): { 
  start: Date
  end: Date
  totalDays: number
  elapsedDays: number
  remainingDays: number
  idealPercent: number
} {
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

// 금액 파싱 헬퍼
function parseAmount(value: string): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/[^\d.,-]/g, '').replace(/,/g, ''))
  return isNaN(num) ? 0 : Math.abs(num)
}

export function BudgetSummary({ 
  totalBudget, 
  categoryTotals, 
  selectedMonth, 
  selectedYear,
  livingExpenseDetails,
  currentSheetData,
  allSheetsData,
  monthlyFixedExpense
}: BudgetSummaryProps) {
  const { isDark } = useTheme()
  const [showDetails, setShowDetails] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [modalType, setModalType] = useState<'living' | 'travel' | 'fixed' | 'other' | 'income' | 'savings' | 'payments' | 'details'>('details')

  const { start, end, remainingDays, idealPercent } = useMemo(
    () => getBudgetPeriodForMonth(selectedMonth),
    [selectedMonth]
  )

  const { livingExpense, fixedExpense, otherExpense, travelExpense, savings, payments, totalIncome, actualRemaining, all } = categoryTotals

  // 연도별 여행 합계 계산 (같은 연도 내 모든 월의 여행 지출 합산)
  const yearlyTravelExpense = useMemo(() => {
    if (!selectedYear || allSheetsData.length === 0) return travelExpense
    
    let total = 0
    allSheetsData.forEach((sheetData) => {
      // 시트 제목에서 연도 추출
      const match = sheetData.sheetTitle.match(/(\d{4})년/)
      if (!match) return
      const sheetYear = parseInt(match[1], 10)
      
      // 선택된 연도와 같은 경우만 합산
      if (sheetYear !== selectedYear) return
      
      // 분류 컬럼과 금액 컬럼 찾기
      const categoryColIndex = sheetData.headers.findIndex(
        (h) => h && (h.includes('지출분류') || h.includes('분류'))
      )
      const amountColIndex = sheetData.headers.findIndex((h) => h && h.includes('금액'))
      
      if (categoryColIndex < 0 || amountColIndex < 0) return
      
      // 여행 카테고리 합산
      sheetData.rows.forEach((row) => {
        const category = row[categoryColIndex] || ''
        if (category.includes('여행')) {
          const amount = parseFloat((row[amountColIndex] || '0').replace(/[^\d.-]/g, '')) || 0
          total += Math.abs(amount)
        }
      })
    })
    
    return total > 0 ? total : travelExpense
  }, [selectedYear, allSheetsData, travelExpense])

  const remainingBudget = totalBudget - livingExpense
  const dailyBudget = remainingDays > 0 ? Math.floor(remainingBudget / remainingDays) : 0
  const usagePercent = totalBudget > 0 ? Math.round((livingExpense / totalBudget) * 100) : 0

  const periodStr = `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`

  const getStatusColor = () => {
    if (usagePercent >= 100) return '#ef4444'
    if (usagePercent >= idealPercent) return '#f59e0b'
    return '#22c55e'
  }

  // 생활비 지출 카테고리별 분류
  const livingExpenseBreakdown = useMemo(() => {
    return Object.entries(all)
      .filter(([cat]) => cat.includes('생활비') && cat.includes('지출'))
      .sort((a, b) => b[1] - a[1])
  }, [all])

  // 카테고리별 거래 내역 필터링
  const getFilteredTransactions = (categoryFilter: string) => {
    if (!currentSheetData) return []
    
    const categoryColIndex = currentSheetData.headers.findIndex(
      (h) => h && (h.includes('지출분류') || h.includes('분류'))
    )
    
    if (categoryColIndex < 0) return []
    
    return currentSheetData.rows.filter(row => {
      const category = row[categoryColIndex] || ''
      return category.includes(categoryFilter)
    })
  }

  // 각 카테고리별 거래 내역
  const livingTransactions = useMemo(() => getFilteredTransactions('생활비'), [currentSheetData])
  
  // 연도별 여행 트랜잭션 (같은 연도 내 모든 월) - 헤더 정보 포함
  const travelTransactions = useMemo(() => {
    if (!selectedYear || allSheetsData.length === 0) {
      return getFilteredTransactions('여행')
    }
    
    const transactions: string[][] = []
    allSheetsData.forEach((sheetData) => {
      // 시트 제목에서 연도 추출
      const match = sheetData.sheetTitle.match(/(\d{4})년/)
      if (!match) return
      const sheetYear = parseInt(match[1], 10)
      
      // 선택된 연도와 같은 경우만
      if (sheetYear !== selectedYear) return
      
      const categoryColIndex = sheetData.headers.findIndex(
        (h) => h && (h.includes('지출분류') || h.includes('분류'))
      )
      
      if (categoryColIndex < 0) return
      
      sheetData.rows.forEach(row => {
        const category = row[categoryColIndex] || ''
        if (category.includes('여행')) {
          transactions.push(row)
        }
      })
    })
    
    return transactions.length > 0 ? transactions : getFilteredTransactions('여행')
  }, [selectedYear, allSheetsData, currentSheetData])
  
  // 여행 데이터의 헤더 (연도별 합산 시 첫 번째 시트의 헤더 사용)
  const travelHeaders = useMemo(() => {
    if (!selectedYear || allSheetsData.length === 0) {
      return currentSheetData?.headers || []
    }
    
    // 같은 연도의 첫 번째 시트 헤더 사용
    for (const sheetData of allSheetsData) {
      const match = sheetData.sheetTitle.match(/(\d{4})년/)
      if (match && parseInt(match[1], 10) === selectedYear) {
        return sheetData.headers
      }
    }
    
    return currentSheetData?.headers || []
  }, [selectedYear, allSheetsData, currentSheetData])
  const fixedTransactions = useMemo(() => getFilteredTransactions('고정'), [currentSheetData])
  const otherTransactions = useMemo(() => getFilteredTransactions('기타'), [currentSheetData])
  const incomeTransactions = useMemo(() => getFilteredTransactions('수입'), [currentSheetData])
  const savingsTransactions = useMemo(() => {
    if (!currentSheetData) return []
    const categoryColIndex = currentSheetData.headers.findIndex(
      (h) => h && (h.includes('지출분류') || h.includes('분류'))
    )
    if (categoryColIndex < 0) return []
    return currentSheetData.rows.filter(row => {
      const category = row[categoryColIndex] || ''
      return category.includes('저금') || category.includes('저축')
    })
  }, [currentSheetData])
  const paymentsTransactions = useMemo(() => getFilteredTransactions('대금'), [currentSheetData])

  const openModal = (type: 'living' | 'travel' | 'fixed' | 'other' | 'income' | 'savings' | 'payments' | 'details') => {
    setModalType(type)
    setShowExpenseModal(true)
  }

  const getModalTitle = () => {
    switch (modalType) {
      case 'living': return '🛒 생활비 지출 내역'
      case 'travel': return '✈️ 여행 지출 내역'
      case 'fixed': return '📌 고정 지출 내역'
      case 'other': return '📦 기타 지출 내역'
      case 'income': return '💵 수입 내역'
      case 'savings': return '🏦 저축 내역'
      case 'payments': return '💳 대금 내역'
      case 'details': return '📊 생활비 지출 상세'
    }
  }

  const getModalData = () => {
    switch (modalType) {
      case 'living': return livingTransactions
      case 'travel': return travelTransactions
      case 'fixed': return fixedTransactions
      case 'other': return otherTransactions
      case 'income': return incomeTransactions
      case 'savings': return savingsTransactions
      case 'payments': return paymentsTransactions
      case 'details': return []
    }
  }

  const getModalHeaders = () => {
    if (modalType === 'travel') {
      return travelHeaders
    }
    return currentSheetData?.headers || []
  }

  // 모달 데이터를 SheetData 형태로 변환
  const getModalSheetData = (): SheetData | null => {
    const transactions = getModalData()
    const headers = getModalHeaders()
    
    if (!transactions || transactions.length === 0) return null
    
    return {
      sheetTitle: getModalTitle(),
      headers: headers,
      rows: transactions
    }
  }

  return (
    <div
      className="mb-4 rounded-xl overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(249, 250, 251, 0.8) 100%)',
        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
      }}
    >
      <div className="p-4">
        {/* 기간 표시 */}
        <div className="flex items-center gap-2 mb-3 text-xs sm:text-sm text-gray-500">
          <CalendarOutlined />
          <span>예산 기간: {periodStr}</span>
          <span className="ml-auto font-medium" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>
            D-{remainingDays}
          </span>
        </div>

        {/* 진행 바 */}
        <div className="mb-4 relative">
          <Progress
            percent={Math.min(usagePercent, 100)}
            strokeColor={getStatusColor()}
            trailColor={isDark ? '#334155' : '#e5e7eb'}
            showInfo={false}
            size="small"
          />
          
          <div 
            className="absolute top-0 h-2 w-0.5 bg-blue-400"
            style={{ 
              left: `${Math.min(idealPercent, 100)}%`,
              transform: 'translateX(-50%)',
            }}
          />
          <div 
            className="absolute -top-4 text-xs text-blue-400 whitespace-nowrap"
            style={{ 
              left: `${Math.min(idealPercent, 100)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            ▼
          </div>

          <div className="flex justify-between text-xs mt-1">
            <div className="flex items-center gap-2">
              <span style={{ color: getStatusColor() }}>{usagePercent}% 사용</span>
              <span className="text-blue-400">(권장 {idealPercent}%)</span>
            </div>
            <span className="text-gray-500">{Math.max(0, 100 - usagePercent)}% 남음</span>
          </div>
          
          {usagePercent > idealPercent && usagePercent < 100 && (
            <div className="text-xs text-amber-500 mt-1">
              ⚠️ 권장 사용률보다 {usagePercent - idealPercent}%p 초과 사용 중
            </div>
          )}
          {usagePercent <= idealPercent && (
            <div className="text-xs text-green-500 mt-1">
              ✅ 권장 사용률 이하로 잘 관리 중 ({idealPercent - usagePercent}%p 여유)
            </div>
          )}
        </div>

        {/* 주요 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <StatCard label="총 생활비" value={totalBudget} isDark={isDark} />
          <StatCard 
            label="생활비 사용" 
            value={-livingExpense} 
            isDark={isDark} 
            color="#ef4444" 
            onClick={() => openModal('living')}
          />
          <StatCard label="남은 생활비" value={remainingBudget} isDark={isDark} color={remainingBudget >= 0 ? '#22c55e' : '#ef4444'} />
          <StatCard label="하루 예산" value={dailyBudget} isDark={isDark} color={dailyBudget >= 0 ? '#60a5fa' : '#ef4444'} />
          <StatCard 
            label={`✈️ 여행 (${selectedYear}년)`}
            value={-yearlyTravelExpense} 
            isDark={isDark} 
            color="#a855f7" 
            bgColor={isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)'}
            colSpan
            onClick={() => openModal('travel')}
          />
        </div>
      </div>

      {/* 자세히보기 토글 버튼 */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full py-2 px-4 flex items-center justify-center gap-2 text-sm transition-colors"
        style={{
          background: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(243, 244, 246, 0.5)',
          color: isDark ? '#94a3b8' : '#6b7280',
          borderTop: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        }}
      >
        {showDetails ? <UpOutlined /> : <DownOutlined />}
        {showDetails ? '접기' : '자세히 보기'}
      </button>

      {/* 상세 정보 */}
      {showDetails && (
        <div 
          className="p-4 space-y-4"
          style={{
            background: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(249, 250, 251, 0.5)',
            borderTop: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
          }}
        >
          {/* 지출 요약 */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">📊 지출 요약</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MiniStatCard label="고정 지출" value={fixedExpense} isDark={isDark} color="#f59e0b" onClick={() => openModal('fixed')} />
              <MiniStatCard label="생활비 지출" value={livingExpense} isDark={isDark} color="#ef4444" onClick={() => openModal('living')} />
              <MiniStatCard label="기타 지출" value={otherExpense} isDark={isDark} color="#8b5cf6" onClick={() => openModal('other')} />
              <MiniStatCard label={`여행 (${selectedYear}년)`} value={yearlyTravelExpense} isDark={isDark} color="#a855f7" onClick={() => openModal('travel')} />
            </div>
          </div>

          {/* 생활비 지출 카테고리별 */}
          {livingExpenseBreakdown.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">🛒 생활비 지출 상세</h4>
              <div className="space-y-1">
                {livingExpenseBreakdown.map(([category, amount]) => {
                  const percent = livingExpense > 0 ? Math.round((amount / livingExpense) * 100) : 0
                  return (
                    <div 
                      key={category} 
                      className="flex items-center justify-between text-xs py-1 px-2 rounded cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(243, 244, 246, 0.8)' }}
                      onClick={() => openModal('details')}
                    >
                      <span style={{ color: isDark ? '#cbd5e1' : '#4b5563' }}>{category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{percent}%</span>
                        <span className="font-mono font-medium text-red-500">
                          -{amount.toLocaleString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 수입/저축/대금 */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">💰 수입 & 기타</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <MiniStatCard label="총 수입" value={totalIncome} isDark={isDark} color="#22c55e" isPositive onClick={() => openModal('income')} />
              <MiniStatCard label="저축" value={savings} isDark={isDark} color="#60a5fa" onClick={() => openModal('savings')} />
              <MiniStatCard label="대금" value={payments} isDark={isDark} color="#f59e0b" onClick={() => openModal('payments')} />
            </div>
          </div>

          {/* 남은 돈 */}
          <div
            className="p-3 rounded-lg text-center"
            style={{
              background: isDark 
                ? (actualRemaining >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                : (actualRemaining >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
              border: `1px solid ${actualRemaining >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <div className="text-xs text-gray-500 mb-1">💵 남은 돈</div>
            <div className="text-xs text-gray-400 mb-2">(수입 - 모든지출 - 저축)</div>
            <div 
              className="font-mono font-bold text-lg sm:text-xl"
              style={{ color: actualRemaining >= 0 ? '#22c55e' : '#ef4444' }}
            >
              {actualRemaining >= 0 ? '+' : ''}{actualRemaining.toLocaleString('ko-KR')}
            </div>
            {/* 예정 생활비 다 쓰면 + 고정지출 차이 반영 */}
            {(() => {
              // 고정지출 차이: 실제 고정지출 - 예정 고정비용 (양수면 초과, 음수면 절약)
              const fixedDiff = fixedExpense - monthlyFixedExpense
              // 추정 남은 돈: 현재 남은돈 - 남은 생활비 - 고정지출 초과분
              const estimatedRemaining = actualRemaining - remainingBudget - fixedDiff
              
              return (
                <div className="text-xs text-gray-400 mt-2">
                  (추정){' '}
                  <span 
                    className="font-mono"
                    style={{ color: estimatedRemaining >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {estimatedRemaining >= 0 ? '+' : ''}
                    {estimatedRemaining.toLocaleString('ko-KR')}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* 거래 내역 모달 */}
      <Modal
        title={getModalTitle()}
        open={showExpenseModal}
        onCancel={() => setShowExpenseModal(false)}
        footer={null}
        width={900}
        styles={{
          content: { background: isDark ? '#1e293b' : '#ffffff' },
          header: { background: isDark ? '#1e293b' : '#ffffff' },
          body: { 
            maxHeight: 'calc(100vh - 200px)', 
            overflowY: 'auto',
            paddingBottom: '20px'
          },
        }}
        style={{
          top: 20,
          maxHeight: 'calc(100vh - 40px)',
        }}
      >
        {modalType === 'details' ? (
          <ExpenseDetailsTable data={livingExpenseDetails} isDark={isDark} />
        ) : (
          <DataTable data={getModalSheetData()} isLoading={false} hideFilters={true} />
        )}
      </Modal>
    </div>
  )
}

// 생활비 상세 테이블 (B10:F20)
function ExpenseDetailsTable({ data, isDark }: { data: string[][], isDark: boolean }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500 py-8">데이터가 없습니다</div>
  }

  // 금액 컬럼 인덱스 찾기 (숫자가 포함된 첫 번째 열)
  const findAmountColIndex = (row: string[]): number => {
    for (let i = 1; i < row.length; i++) {
      const val = row[i] || ''
      // ₩, 숫자, 쉼표가 포함된 값이면 금액 컬럼
      if (/[₩\d,]+/.test(val) && /\d/.test(val)) {
        return i
      }
    }
    return 1 // 기본값
  }
  
  // 첫 번째 데이터 행에서 금액 컬럼 찾기
  const amountColIndex = data.length > 0 ? findAmountColIndex(data[0]) : 1

  // 총합 계산
  const total = data.reduce((sum, row) => {
    const amount = parseFloat((row[amountColIndex] || '0').replace(/[^\d.-]/g, '')) || 0
    return sum + amount
  }, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(243, 244, 246, 0.8)' }}>
            <th className="text-left p-2 rounded-tl-lg" style={{ color: isDark ? '#cbd5e1' : '#4b5563' }}>카테고리</th>
            <th className="text-right p-2" style={{ color: isDark ? '#cbd5e1' : '#4b5563' }}>금액</th>
            <th className="text-right p-2 rounded-tr-lg" style={{ color: isDark ? '#cbd5e1' : '#4b5563' }}>비중</th>
          </tr>
        </thead>
        <tbody>
          {data.filter(row => row[0] && row[0].trim()).map((row, idx) => {
            const category = row[0] || '-'
            const amount = parseFloat((row[amountColIndex] || '0').replace(/[^\d.-]/g, '')) || 0
            const percent = total > 0 ? Math.round((amount / total) * 100) : 0
            
            return (
              <tr 
                key={idx}
                style={{ 
                  background: idx % 2 === 0 
                    ? (isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(255, 255, 255, 0.5)')
                    : (isDark ? 'rgba(51, 65, 85, 0.2)' : 'rgba(243, 244, 246, 0.5)')
                }}
              >
                <td className="p-2" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>{category}</td>
                <td className="p-2 text-right font-mono text-red-500">
                  {amount > 0 ? `-${amount.toLocaleString('ko-KR')}` : '0'}
                </td>
                <td className="p-2 text-right text-gray-500">{percent}%</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(243, 244, 246, 0.8)' }}>
            <td className="p-2 font-bold rounded-bl-lg" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>합계</td>
            <td className="p-2 text-right font-mono font-bold text-red-500">
              -{total.toLocaleString('ko-KR')}
            </td>
            <td className="p-2 text-right text-gray-500 rounded-br-lg">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// 통계 카드 컴포넌트
function StatCard({ 
  label, 
  value, 
  isDark, 
  color, 
  bgColor,
  colSpan,
  onClick
}: { 
  label: string
  value: number
  isDark: boolean
  color?: string
  bgColor?: string
  colSpan?: boolean
  onClick?: () => void
}) {
  const isNegative = value < 0
  const displayValue = Math.abs(value)
  const defaultColor = isDark ? '#f8fafc' : '#1f2937'

  return (
    <div
      className={`p-2 sm:p-3 rounded-lg text-center ${colSpan ? 'col-span-2 sm:col-span-1' : ''} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      style={{ background: bgColor || (isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(243, 244, 246, 0.8)') }}
      onClick={onClick}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div 
        className="font-mono font-bold text-xs sm:text-sm"
        style={{ color: color || defaultColor }}
      >
        {isNegative ? '-' : ''}{displayValue.toLocaleString('ko-KR')}
      </div>
    </div>
  )
}

// 미니 통계 카드 컴포넌트
function MiniStatCard({ 
  label, 
  value, 
  isDark, 
  color,
  isPositive,
  onClick
}: { 
  label: string
  value: number
  isDark: boolean
  color: string
  isPositive?: boolean
  onClick?: () => void
}) {
  return (
    <div
      className={`p-2 rounded-lg ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      style={{ background: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(243, 244, 246, 0.8)' }}
      onClick={onClick}
    >
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-mono font-medium text-xs" style={{ color }}>
        {isPositive ? '+' : '-'}{value.toLocaleString('ko-KR')}
      </div>
    </div>
  )
}
