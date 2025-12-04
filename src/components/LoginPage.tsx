import { Button, Typography, Card, Spin } from 'antd'
import { GoogleOutlined, TableOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const { Title, Text, Paragraph } = Typography

export function LoginPage() {
  const { login, isLoading } = useAuth()
  const { isDark } = useTheme()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1a1a2e 50%, #16213e 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(34, 197, 94, 0.1)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(16, 185, 129, 0.1)' }}
        />
      </div>

      <Card
        className="relative z-10 w-full max-w-md text-center"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        }}
        variant="borderless"
      >
        {/* Logo */}
        <div className="mb-6">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
              boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
            }}
          >
            <TableOutlined className="text-white text-4xl" />
          </div>
        </div>

        {/* Title */}
        <Title
          level={2}
          className="!mb-2"
          style={{
            background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          가계부
        </Title>
        <Text type="secondary" className="text-lg">
          Google 계정으로 로그인하여 시작하세요
        </Text>

        {/* Login button */}
        <div className="mt-8">
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            onClick={login}
            className="w-full h-12 text-base font-medium"
            style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)',
            }}
          >
            Google로 로그인
          </Button>
        </div>

        {/* Info */}
        <Paragraph type="secondary" className="mt-8 text-sm">
          스프레드시트에 대한 읽기 권한이 있는 계정으로 로그인해주세요.
          권한이 없는 경우 접근이 제한됩니다.
        </Paragraph>
      </Card>
    </div>
  )
}
