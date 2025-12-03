import { useState, useMemo, useEffect } from 'react'
import { Layout, Button, Avatar, Dropdown, Spin, Alert, Typography, Switch, Drawer } from 'antd'
import {
  ReloadOutlined,
  LogoutOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
  TableOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useGoogleSheets } from '../hooks/useGoogleSheets'
import { DataTable } from './DataTable'
import { AccessDenied } from './AccessDenied'
import { BudgetSummary } from './BudgetSummary'

const { Header, Content, Footer } = Layout
const { Title, Text } = Typography

// 숫자 파싱 헬퍼
function parseAmount(value: string): number {
  if (!value) return 0
  const num = parseFloat(value.replace(/[^\d.,-]/g, '').replace(/,/g, ''))
  return isNaN(num) ? 0 : Math.abs(num)
}

export function MainPage() {
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const {
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
  } = useGoogleSheets()

  // 스코프 에러일 때 자동으로 로그아웃해서 재로그인 유도
  useEffect(() => {
    if (errorType === 'scope') {
      console.log('토큰 스코프 부족 - 재로그인 필요')
      // localStorage 클리어하고 로그아웃
      localStorage.clear()
      logout()
    }
  }, [errorType, logout])

  // 모든 탭의 카테고리별 합계 계산
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    let totalIncome = 0 // 전체 수입

    allSheetsData.forEach((sheetData) => {
      if (!sheetData) return

      // 지출분류 컬럼 찾기
      const categoryColIndex = sheetData.headers.findIndex(
        (h) => h && (h.includes('지출분류') || h.includes('분류'))
      )
      // 금액 컬럼 찾기
      let amountColIndex = sheetData.headers.findIndex((h) => h && h.includes('금액'))
      if (amountColIndex < 0) {
        amountColIndex = sheetData.headers.length - 1
      }

      if (categoryColIndex < 0 || amountColIndex < 0) return

      sheetData.rows.forEach((row) => {
        const category = row[categoryColIndex] || ''
        const amount = parseAmount(row[amountColIndex] || '')

        if (!category) return

        // 카테고리별 합산
        if (!totals[category]) {
          totals[category] = 0
        }
        totals[category] += amount

        // 수입 카테고리 합산
        if (category.includes('수입')) {
          totalIncome += amount
        }
      })
    })

    // 주요 카테고리 추출
    const livingExpense = Object.entries(totals)
      .filter(([cat]) => cat.includes('생활비') && cat.includes('지출'))
      .reduce((sum, [, val]) => sum + val, 0)

    const fixedExpense = Object.entries(totals)
      .filter(([cat]) => cat.includes('고정') && cat.includes('지출'))
      .reduce((sum, [, val]) => sum + val, 0)

    const otherExpense = Object.entries(totals)
      .filter(([cat]) => cat.includes('기타') && cat.includes('지출'))
      .reduce((sum, [, val]) => sum + val, 0)

    const travelExpense = Object.entries(totals)
      .filter(([cat]) => cat.includes('여행'))
      .reduce((sum, [, val]) => sum + val, 0)

    const savings = Object.entries(totals)
      .filter(([cat]) => cat.includes('저금') || cat.includes('저축'))
      .reduce((sum, [, val]) => sum + val, 0)

    const payments = Object.entries(totals)
      .filter(([cat]) => cat.includes('대금'))
      .reduce((sum, [, val]) => sum + val, 0)

    // 실질 남은 돈 = 수입 - 모든지출 - 저축 - 대금
    const totalExpenseAll = livingExpense + fixedExpense + otherExpense + travelExpense
    const actualRemaining = totalIncome - totalExpenseAll - savings - payments

    return {
      all: totals,
      livingExpense,
      fixedExpense,
      otherExpense,
      travelExpense,
      savings,
      payments,
      totalIncome,
      actualRemaining,
    }
  }, [allSheetsData])

  // 권한 확인 중
  if (hasAccess === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  // 권한 없음
  if (hasAccess === false) {
    return <AccessDenied />
  }

  const userMenuItems = [
    {
      key: 'email',
      label: (
        <div className="px-2 py-1">
          <Text type="secondary" className="text-xs">{user?.email}</Text>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: logout,
    },
  ]

  return (
    <Layout className="min-h-screen">
      {/* Header */}
      <Header
        className="sticky top-0 z-50 px-3 sm:px-6"
        style={{
          background: isDark ? '#1e293b' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
          height: 'auto',
          padding: '12px',
          lineHeight: 'normal',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              <TableOutlined className="text-white text-base sm:text-xl" />
            </div>
            <div className="min-w-0">
              <Title level={5} className="!mb-0 !text-sm sm:!text-base truncate" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>
                가계부
              </Title>
              {spreadsheetInfo && (
                <Text type="secondary" className="text-xs hidden sm:block truncate">
                  {spreadsheetInfo.title}
                </Text>
              )}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {/* 다크모드 토글 */}
            <div className="flex items-center gap-2">
              <SunOutlined style={{ color: isDark ? '#94a3b8' : '#f59e0b', fontSize: 14 }} />
              <Switch
                checked={isDark}
                onChange={toggleTheme}
                size="small"
              />
              <MoonOutlined style={{ color: isDark ? '#60a5fa' : '#94a3b8', fontSize: 14 }} />
            </div>

            {/* 새로고침 */}
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={isLoading}
              size="small"
            />

            {/* 사용자 메뉴 */}
            {user && (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                  <Avatar
                    src={user.picture}
                    icon={<UserOutlined />}
                    size={28}
                  />
                  <Text className="hidden md:inline" style={{ color: isDark ? '#f8fafc' : '#1f2937', fontSize: 13 }}>
                    {user.name}
                  </Text>
                </div>
              </Dropdown>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuOpen(true)}
            className="sm:hidden"
            size="small"
          />
        </div>
      </Header>

      {/* Mobile Menu Drawer */}
      <Drawer
        title="메뉴"
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        size="default"
        styles={{
          body: { padding: 0 },
          header: { background: isDark ? '#1e293b' : '#ffffff', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
          content: { background: isDark ? '#0f172a' : '#f9fafb' },
        }}
      >
        <div className="p-4 space-y-4">
          {/* 사용자 정보 */}
          {user && (
            <div
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: isDark ? '#1e293b' : '#ffffff' }}
            >
              <Avatar src={user.picture} icon={<UserOutlined />} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate" style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>
                  {user.name}
                </div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
            </div>
          )}

          {/* 다크모드 토글 */}
          <div
            className="p-3 rounded-lg flex items-center justify-between"
            style={{ background: isDark ? '#1e293b' : '#ffffff' }}
          >
            <span style={{ color: isDark ? '#f8fafc' : '#1f2937' }}>다크 모드</span>
            <div className="flex items-center gap-2">
              <SunOutlined style={{ color: isDark ? '#94a3b8' : '#f59e0b' }} />
              <Switch checked={isDark} onChange={toggleTheme} size="small" />
              <MoonOutlined style={{ color: isDark ? '#60a5fa' : '#94a3b8' }} />
            </div>
          </div>

          {/* 새로고침 */}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refresh()
              setMobileMenuOpen(false)
            }}
            loading={isLoading}
            block
          >
            새로고침
          </Button>

          {/* 로그아웃 */}
          <Button
            icon={<LogoutOutlined />}
            onClick={logout}
            block
            danger
          >
            로그아웃
          </Button>
        </div>
      </Drawer>

      {/* Content */}
      <Content className="p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Error message */}
          {error && (
            <Alert
              message="오류"
              description={error}
              type="error"
              showIcon
              className="mb-4"
              closable
            />
          )}

          {/* 예산 요약 */}
          <BudgetSummary 
            totalBudget={totalBudget} 
            categoryTotals={categoryTotals}
          />

          {/* Month tabs - 모바일에서는 가로 스크롤 */}
          {monthlySheets.length > 0 ? (
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {monthlySheets.map((sheet) => (
                  <Button
                    key={sheet.sheetId}
                    type={selectedMonth === sheet.title ? 'primary' : 'default'}
                    onClick={() => selectMonth(sheet.title)}
                    className="flex-shrink-0"
                    style={
                      selectedMonth === sheet.title
                        ? {
                            background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
                            border: 'none',
                          }
                        : {}
                    }
                  >
                    {sheet.title}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            !isLoading && (
              <Alert
                message="월별 시트를 찾을 수 없습니다"
                description="스프레드시트에 '1월', '2월' 등의 이름을 가진 시트가 필요합니다."
                type="warning"
                showIcon
                className="mb-4"
              />
            )
          )}

          {/* Data table */}
          <DataTable data={currentSheetData} isLoading={isLoading} />
        </div>
      </Content>

      {/* Footer */}
      <Footer
        className="text-center py-4"
        style={{
          background: isDark ? '#0f172a' : '#f9fafb',
          borderTop: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
        }}
      >
        <Text type="secondary" className="text-xs sm:text-sm">Google Sheets 기반 가계부 서비스</Text>
      </Footer>
    </Layout>
  )
}
