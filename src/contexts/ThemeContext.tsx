import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ConfigProvider, theme } from 'antd'
import koKR from 'antd/locale/ko_KR'

type ThemeMode = 'dark' | 'light'

interface ThemeContextType {
  themeMode: ThemeMode
  toggleTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode')
    return (saved as ThemeMode) || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode)
    // body 클래스 업데이트
    document.body.classList.remove('light', 'dark')
    document.body.classList.add(themeMode)
  }, [themeMode])

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const isDark = themeMode === 'dark'

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, isDark }}>
      <ConfigProvider
        locale={koKR}
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#22c55e',
            colorBgContainer: isDark ? '#1e293b' : '#ffffff',
            colorBgElevated: isDark ? '#334155' : '#ffffff',
            colorBgLayout: isDark ? '#0f172a' : '#f5f5f5',
            colorText: isDark ? '#f8fafc' : '#1f2937',
            colorTextSecondary: isDark ? '#94a3b8' : '#6b7280',
            colorBorder: isDark ? '#334155' : '#e5e7eb',
            borderRadius: 8,
            fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          },
          components: {
            Table: {
              headerBg: isDark ? '#1e293b' : '#f9fafb',
              headerColor: isDark ? '#f8fafc' : '#1f2937',
              rowHoverBg: isDark ? '#334155' : '#f3f4f6',
              borderColor: isDark ? '#334155' : '#e5e7eb',
            },
            Button: {
              primaryShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
            },
            Card: {
              colorBgContainer: isDark ? '#1e293b' : '#ffffff',
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

