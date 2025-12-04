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
  ArrowUpOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useGoogleSheets } from '../hooks/useGoogleSheets'
import { DataTable } from './DataTable'
import { AccessDenied } from './AccessDenied'
import { BudgetSummary } from './BudgetSummary'
import { InfoModal } from './InfoModal'
import { SearchModal } from './SearchModal'
import { AddDataModal } from './AddDataModal'
import { parseAmount } from '../utils/common'

const { Header, Content, Footer } = Layout
const { Title, Text } = Typography

// 시트 제목에서 년도 추출
function extractYear(title: string): number | null {
  const match = title.match(/(\d{4})년/)
  return match ? parseInt(match[1], 10) : null
}

export function MainPage() {
  const { user, logout, accessToken } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [addDataModalOpen, setAddDataModalOpen] = useState(false)

  // Scroll to top 버튼 표시 여부
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const sheetsData = useGoogleSheets()
  const {
    spreadsheetInfo,
    monthlySheets,
    currentSheetData,
    allSheetsData,
    totalBudget,
    livingExpenseDetails,
    monthlyFixedExpense,
    infoData,
    selectedMonth,
    hasAccess,
    isLoading,
    error,
    selectMonth,
    refresh,
  } = sheetsData;

  // 년도별로 시트 그룹핑
  const yearGroups = useMemo(() => {
    const groups: Record<number, typeof monthlySheets> = {}
    monthlySheets.forEach((sheet) => {
      const year = extractYear(sheet.title)
      if (year) {
        if (!groups[year]) groups[year] = []
        groups[year].push(sheet)
      }
    })
    return groups
  }, [monthlySheets])

  // 사용 가능한 년도 목록 (최신순)
  const availableYears = useMemo(() => {
    return Object.keys(yearGroups)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => b - a)
  }, [yearGroups])

  // 초기 년도 설정 (선택된 월에서 추출하거나 현재 년도)
  useEffect(() => {
    if (selectedYear === null && selectedMonth) {
      const year = extractYear(selectedMonth)
      if (year) setSelectedYear(year)
    } else if (selectedYear === null && availableYears.length > 0) {
      const currentYear = new Date().getFullYear()
      setSelectedYear(availableYears.includes(currentYear) ? currentYear : availableYears[0])
    }
  }, [selectedMonth, availableYears, selectedYear])

  // 선택된 년도의 월들
  const filteredMonths = useMemo(() => {
    if (selectedYear === null) return monthlySheets
    return yearGroups[selectedYear] || []
  }, [selectedYear, yearGroups, monthlySheets])

  // 현재 탭(월)의 카테고리별 합계 계산
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    let totalIncome = 0

    // 현재 선택된 월의 데이터만 사용
    if (!currentSheetData) {
      return {
        all: {},
        livingExpense: 0,
        fixedExpense: 0,
        otherExpense: 0,
        travelExpense: 0,
        savings: 0,
        payments: 0,
        totalIncome: 0,
        actualRemaining: 0,
      }
    }

    // 지출분류 컬럼 찾기
    const categoryColIndex = currentSheetData.headers.findIndex(
      (h) => h && (h.includes('지출분류') || h.includes('분류'))
    )
    // 금액 컬럼 찾기
    let amountColIndex = currentSheetData.headers.findIndex((h) => h && h.includes('금액'))
    if (amountColIndex < 0) {
      amountColIndex = currentSheetData.headers.length - 1
    }

    if (categoryColIndex >= 0 && amountColIndex >= 0) {
      currentSheetData.rows.forEach((row) => {
        const category = row[categoryColIndex] || ''
        const amount = parseAmount(row[amountColIndex] || '')

        if (!category || amount === null) return

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
    }

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

    // 남은 돈 = 수입 - 저축 - 👀 모든 예정 지출
    const totalExpenseAll = livingExpense + fixedExpense + otherExpense + travelExpense
    const actualRemaining = totalIncome - totalExpenseAll - savings

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
  }, [currentSheetData])

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
    <>
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
            {/* 검색 */}
            <Button
              type="text"
              icon={<SearchOutlined style={{ color: '#f59e0b', fontSize: 18 }} />}
              onClick={() => setSearchModalOpen(true)}
              size="small"
              title="전체 검색"
            />
            
            {/* 정보 */}
            <Button
              type="text"
              icon={<InfoCircleOutlined style={{ color: '#60a5fa', fontSize: 18 }} />}
              onClick={() => setInfoModalOpen(true)}
              size="small"
              title="정보"
            />
            
            {/* 구글 시트 열기 */}
            <Button
              type="text"
              icon={<TableOutlined style={{ color: '#0f9d58', fontSize: 18 }} />}
              onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID ?? "10zucaKG4Cu7WT-2Dijpn4S9h-6EODzJMmoI9e75LDio"}/edit`, '_blank')}
              size="small"
              title="구글 시트 열기"
            />

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

          {/* Mobile Actions */}
          <div className="flex sm:hidden items-center gap-2">
            {/* 검색 */}
            <Button
              type="text"
              icon={<SearchOutlined style={{ color: '#f59e0b', fontSize: 22 }} />}
              onClick={() => setSearchModalOpen(true)}
              style={{ width: 40, height: 40 }}
              title="전체 검색"
            />
            
            {/* 정보 */}
            <Button
              type="text"
              icon={<InfoCircleOutlined style={{ color: '#60a5fa', fontSize: 22 }} />}
              onClick={() => setInfoModalOpen(true)}
              style={{ width: 40, height: 40 }}
              title="정보"
            />
            
            {/* 구글 시트 열기 */}
            <Button
              type="text"
              icon={<TableOutlined style={{ color: '#0f9d58', fontSize: 22 }} />}
              onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID ?? "10zucaKG4Cu7WT-2Dijpn4S9h-6EODzJMmoI9e75LDio"}/edit`, '_blank')}
              style={{ width: 40, height: 40 }}
              title="구글 시트 열기"
            />
            {/* 다크모드 토글 */}
            <Button
              type="text"
              icon={isDark ? <SunOutlined style={{ color: '#fbbf24', fontSize: 20 }} /> : <MoonOutlined style={{ color: '#6366f1', fontSize: 20 }} />}
              onClick={toggleTheme}
              style={{ width: 40, height: 40 }}
            />
            {/* 새로고침 */}
            <Button
              type="text"
              icon={<ReloadOutlined style={{ fontSize: 18 }} />}
              onClick={refresh}
              loading={isLoading}
              style={{ width: 40, height: 40 }}
            />
            {/* 메뉴 */}
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setMobileMenuOpen(true)}
              style={{ width: 40, height: 40 }}
            />
          </div>
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
          body: { padding: 0, background: isDark ? '#0f172a' : '#f9fafb' },
          header: { background: isDark ? '#1e293b' : '#ffffff', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
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

          {/* 검색 */}
          <Button
            icon={<SearchOutlined style={{ color: '#f59e0b' }} />}
            onClick={() => {
              setSearchModalOpen(true)
              setMobileMenuOpen(false)
            }}
            block
          >
            전체 검색
          </Button>

          {/* 정보 */}
          <Button
            icon={<InfoCircleOutlined style={{ color: '#60a5fa' }} />}
            onClick={() => {
              setInfoModalOpen(true)
              setMobileMenuOpen(false)
            }}
            block
          >
            정보
          </Button>

          {/* 구글 시트 열기 */}
          <Button
            icon={<TableOutlined style={{ color: '#0f9d58' }} />}
            onClick={() => {
              window.open(`https://docs.google.com/spreadsheets/d/${import.meta.env.VITE_SPREADSHEET_ID ?? "10zucaKG4Cu7WT-2Dijpn4S9h-6EODzJMmoI9e75LDio"}/edit`, '_blank')
              setMobileMenuOpen(false)
            }}
            block
          >
            구글 시트 열기
          </Button>

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

          {/* Year & Month tabs */}
          {monthlySheets.length > 0 ? (
            <div className="mb-4 space-y-3">
              {/* 년도 선택 탭 */}
              {availableYears.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {availableYears.map((year) => (
                    <Button
                      key={year}
                      type={selectedYear === year ? 'primary' : 'default'}
                      onClick={() => {
                        setSelectedYear(year)
                        // 해당 년도의 첫 번째 월 선택
                        const firstMonth = yearGroups[year]?.[0]
                        if (firstMonth) selectMonth(firstMonth.title)
                      }}
                      className="flex-shrink-0"
                      icon={<CalendarOutlined />}
                      style={
                        selectedYear === year
                          ? {
                              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                              border: 'none',
                            }
                          : {}
                      }
                    >
                      {year}년
                    </Button>
                  ))}
                </div>
              )}
              
              {/* 월 선택 탭 */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {filteredMonths.map((sheet) => {
                  // "2024년 12월" -> "12월" 형태로 표시
                  const monthOnly = sheet.title.replace(/\d{4}년\s*/, '')
                  return (
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
                      {monthOnly}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : (
            !isLoading && (
              <Alert
                message="월별 시트를 찾을 수 없습니다"
                description="스프레드시트에 '2024년 1월' 형태의 이름을 가진 시트가 필요합니다."
                type="warning"
                showIcon
                className="mb-4"
              />
            )
          )}

          {/* 예산 요약 */}
          <BudgetSummary 
            totalBudget={totalBudget} 
            categoryTotals={categoryTotals}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            livingExpenseDetails={livingExpenseDetails}
            currentSheetData={currentSheetData}
            allSheetsData={allSheetsData}
            monthlyFixedExpense={monthlyFixedExpense}
            sheetId={monthlySheets.find(s => s.title === selectedMonth)?.sheetId}
            onDataChange={refresh}
          />

          {/* Data table */}
          <DataTable 
            data={currentSheetData} 
            isLoading={isLoading}
            sheetId={monthlySheets.find(s => s.title === selectedMonth)?.sheetId}
            onDataChange={refresh}
          />
        </div>
      </Content>

      {/* Footer */}
      <Footer
        className="text-center py-4"
        style={{
          background: isDark ? '#0f172a' : '#f9fafb',
          borderTop: `1px solid ${isDark ? '#1e293b' : '#e5e7eb'}`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Text type="secondary" className="text-xs sm:text-sm">Google Sheets 기반 가계부 서비스</Text>
      </Footer>
    </Layout>

    {/* 정보 모달 */}
    <InfoModal
      open={infoModalOpen}
      onClose={() => setInfoModalOpen(false)}
      infoData={infoData}
    />

    {/* 검색 모달 */}
    <SearchModal
      open={searchModalOpen}
      onClose={() => setSearchModalOpen(false)}
      monthlySheets={monthlySheets}
    />

    {/* 데이터 추가 모달 */}
    <AddDataModal
      open={addDataModalOpen}
      onCancel={() => setAddDataModalOpen(false)}
      onSuccess={() => {
        refresh()
      }}
      accessToken={accessToken || ''}
      availableSheets={monthlySheets}
      defaultSheet={selectedMonth || undefined}
      allSheetsData={allSheetsData}
    />

    {/* Floating 버튼 - 데이터 추가 */}
    <button
      onClick={() => setAddDataModalOpen(true)}
      className="fixed w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
      style={{
        background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
        border: 'none',
        bottom: '24px',
        right: '16px',
        zIndex: 9999,
        cursor: 'pointer',
        position: 'fixed',
      }}
    >
      <PlusOutlined style={{ fontSize: 24, color: '#ffffff' }} />
    </button>

    {/* Floating 버튼 - 최상단 이동 */}
    {showScrollTop && (
      <button
        onClick={scrollToTop}
        className="fixed w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
          border: 'none',
          bottom: '24px',
          right: '80px',
          zIndex: 9999,
          cursor: 'pointer',
          position: 'fixed',
        }}
      >
        <ArrowUpOutlined style={{ fontSize: 20, color: '#ffffff' }} />
      </button>
    )}
    </>
  )
}
