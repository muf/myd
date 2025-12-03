import { useMemo, useState } from 'react'
import { Progress, Collapse } from 'antd'
import { CalendarOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

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

interface BudgetSummaryProps {
  totalBudget: number // 총 생활비 예산 (C2 셀)
  categoryTotals: CategoryTotals
}

// 25일 기준 예산 기간 계산
function getBudgetPeriod(): { start: Date; end: Date; remainingDays: number } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  let start: Date
  let end: Date

  if (day >= 25) {
    start = new Date(year, month, 25)
    end = new Date(year, month + 1, 24)
  } else {
    start = new Date(year, month - 1, 25)
    end = new Date(year, month, 24)
  }

  const todayStart = new Date(year, month, day)
  const diffTime = end.getTime() - todayStart.getTime()
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

  return { start, end, remainingDays: Math.max(1, remainingDays) }
}

export function BudgetSummary({ totalBudget, categoryTotals }: BudgetSummaryProps) {
  const { isDark } = useTheme()
  const [showDetails, setShowDetails] = useState(false)

  const { remainingDays, start, end } = useMemo(() => getBudgetPeriod(), [])

  const { livingExpense, fixedExpense, otherExpense, travelExpense, savings, payments, totalIncome, actualRemaining, all } = categoryTotals

  const remainingBudget = totalBudget - livingExpense
  const dailyBudget = remainingDays > 0 ? Math.floor(remainingBudget / remainingDays) : 0
  const usagePercent = totalBudget > 0 ? Math.round((livingExpense / totalBudget) * 100) : 0

  const periodStr = `${start.getMonth() + 1}/${start.getDate()} ~ ${end.getMonth() + 1}/${end.getDate()}`

  const getStatusColor = () => {
    if (usagePercent >= 100) return '#ef4444'
    if (usagePercent >= 80) return '#f59e0b'
    return '#22c55e'
  }

  // 생활비 지출 카테고리별 분류
  const livingExpenseBreakdown = useMemo(() => {
    return Object.entries(all)
      .filter(([cat]) => cat.includes('생활비') && cat.includes('지출'))
      .sort((a, b) => b[1] - a[1])
  }, [all])

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
        <div className="mb-4">
        <Progress
          percent={Math.min(usagePercent, 100)}
          strokeColor={getStatusColor()}
          railColor={isDark ? '#334155' : '#e5e7eb'}
          showInfo={false}
          size="small"
        />
          <div className="flex justify-between text-xs mt-1">
            <span style={{ color: getStatusColor() }}>{usagePercent}% 사용</span>
            <span className="text-gray-500">{Math.max(0, 100 - usagePercent)}% 남음</span>
          </div>
        </div>

        {/* 주요 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <StatCard label="총 생활비" value={totalBudget} isDark={isDark} />
          <StatCard label="생활비 사용" value={-livingExpense} isDark={isDark} color="#ef4444" />
          <StatCard label="남은 생활비" value={remainingBudget} isDark={isDark} color={remainingBudget >= 0 ? '#22c55e' : '#ef4444'} />
          <StatCard label="하루 예산" value={dailyBudget} isDark={isDark} color={dailyBudget >= 0 ? '#60a5fa' : '#ef4444'} />
          <StatCard 
            label="✈️ 여행 (전체)" 
            value={-travelExpense} 
            isDark={isDark} 
            color="#a855f7" 
            bgColor={isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)'}
            colSpan
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
              <MiniStatCard label="고정 지출" value={fixedExpense} isDark={isDark} color="#f59e0b" />
              <MiniStatCard label="생활비 지출" value={livingExpense} isDark={isDark} color="#ef4444" />
              <MiniStatCard label="기타 지출" value={otherExpense} isDark={isDark} color="#8b5cf6" />
              <MiniStatCard label="여행" value={travelExpense} isDark={isDark} color="#a855f7" />
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
                      className="flex items-center justify-between text-xs py-1 px-2 rounded"
                      style={{ background: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(243, 244, 246, 0.8)' }}
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
              <MiniStatCard label="총 수입" value={totalIncome} isDark={isDark} color="#22c55e" isPositive />
              <MiniStatCard label="저축" value={savings} isDark={isDark} color="#60a5fa" />
              <MiniStatCard label="대금" value={payments} isDark={isDark} color="#f59e0b" />
            </div>
          </div>

          {/* 실질 남은 돈 */}
          <div
            className="p-3 rounded-lg text-center"
            style={{
              background: isDark 
                ? (actualRemaining >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                : (actualRemaining >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
              border: `1px solid ${actualRemaining >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            <div className="text-xs text-gray-500 mb-1">💵 실질 남은 돈</div>
            <div className="text-xs text-gray-400 mb-2">(수입 - 모든지출 - 저축 - 대금)</div>
            <div 
              className="font-mono font-bold text-lg sm:text-xl"
              style={{ color: actualRemaining >= 0 ? '#22c55e' : '#ef4444' }}
            >
              {actualRemaining >= 0 ? '+' : ''}{actualRemaining.toLocaleString('ko-KR')}
            </div>
          </div>
        </div>
      )}
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
  colSpan 
}: { 
  label: string
  value: number
  isDark: boolean
  color?: string
  bgColor?: string
  colSpan?: boolean
}) {
  const isNegative = value < 0
  const displayValue = Math.abs(value)
  const defaultColor = isDark ? '#f8fafc' : '#1f2937'

  return (
    <div
      className={`p-2 sm:p-3 rounded-lg text-center ${colSpan ? 'col-span-2 sm:col-span-1' : ''}`}
      style={{ background: bgColor || (isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(243, 244, 246, 0.8)') }}
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
  isPositive 
}: { 
  label: string
  value: number
  isDark: boolean
  color: string
  isPositive?: boolean
}) {
  return (
    <div
      className="p-2 rounded-lg"
      style={{ background: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(243, 244, 246, 0.8)' }}
    >
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="font-mono font-medium text-xs" style={{ color }}>
        {isPositive ? '+' : '-'}{value.toLocaleString('ko-KR')}
      </div>
    </div>
  )
}
