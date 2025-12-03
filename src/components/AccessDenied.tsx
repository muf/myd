import { Button, Typography, Card, Avatar } from 'antd'
import { LockOutlined, ReloadOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const { Title, Text } = Typography

export function AccessDenied() {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()

  const steps = [
    '스프레드시트 소유자에게 접근 권한을 요청하세요',
    '권한을 받은 후 다시 로그인해주세요',
    '다른 계정으로 로그인을 시도할 수도 있습니다',
  ]

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
          className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(239, 68, 68, 0.1)' }}
        />
        <div
          className="absolute bottom-1/3 right-1/3 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'rgba(249, 115, 22, 0.1)' }}
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
        {/* Icon */}
        <div className="mb-6">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
              boxShadow: '0 8px 32px rgba(220, 38, 38, 0.3)',
            }}
          >
            <LockOutlined className="text-white text-4xl" />
          </div>
        </div>

        {/* Title */}
        <Title level={3} className="!mb-2">
          접근 권한이 없습니다
        </Title>
        <Text type="secondary">
          요청하신 스프레드시트에 대한 접근 권한이 없습니다.
        </Text>

        {/* User info */}
        {user && (
          <div
            className="mt-6 p-4 rounded-lg flex items-center gap-3"
            style={{
              background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(243, 244, 246, 0.8)',
            }}
          >
            <Avatar src={user.picture} icon={<UserOutlined />} size={40} />
            <div className="text-left">
              <Text strong>{user.name}</Text>
              <br />
              <Text type="secondary" className="text-sm">{user.email}</Text>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div
          className="mt-6 p-4 rounded-lg text-left"
          style={{
            background: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(243, 244, 246, 0.5)',
          }}
        >
          <Text strong className="flex items-center gap-2 mb-3">
            <span className="text-yellow-500">💡</span> 권한을 얻으려면
          </Text>
          <div className="space-y-1">
            {steps.map((item, index) => (
              <div key={index} className="py-1">
                <Text type="secondary">
                  {index + 1}. {item}
                </Text>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
            block
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4ade80 0%, #16a34a 100%)',
              border: 'none',
            }}
          >
            다시 시도
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={logout}
            block
            size="large"
          >
            다른 계정으로 로그인
          </Button>
        </div>
      </Card>
    </div>
  )
}
