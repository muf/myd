import { useState, useMemo, useEffect } from 'react'
import { Modal, Typography, Spin } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { DataTable } from './DataTable'
import { SheetData, getSheetData } from '../services/sheetsApi'

const { Text } = Typography

interface SearchModalProps {
  open: boolean
  onClose: () => void
  monthlySheets: { sheetId: number; title: string }[]
}

export function SearchModal({ open, onClose, monthlySheets }: SearchModalProps) {
  const { accessToken } = useAuth()
  const [allSheetsData, setAllSheetsData] = useState<SheetData[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // 모달이 열릴 때 모든 시트 데이터 로드
  useEffect(() => {
    if (open && accessToken && monthlySheets.length > 0) {
      setIsLoadingData(true)
      
      // 모든 월별 시트 데이터 로드
      Promise.all(
        monthlySheets.map(sheet => getSheetData(accessToken, sheet.title))
      )
        .then(results => {
          const validData = results.filter(data => data !== null) as SheetData[]
          setAllSheetsData(validData)
        })
        .catch(error => {
          console.error('Failed to load all sheets data:', error)
          setAllSheetsData([])
        })
        .finally(() => {
          setIsLoadingData(false)
        })
    }
  }, [open, accessToken, monthlySheets])

  // 전체 데이터를 하나로 합치기
  const combinedData = useMemo((): SheetData | null => {
    if (allSheetsData.length === 0) return null

    // 첫 번째 시트의 헤더를 사용
    const headers = allSheetsData[0]?.headers || []
    
    // 모든 시트의 rows를 합치기
    const allRows: string[][] = []
    allSheetsData.forEach(sheet => {
      if (sheet.rows && sheet.rows.length > 0) {
        allRows.push(...sheet.rows)
      }
    })

    return {
      sheetTitle: '전체 데이터',
      headers,
      rows: allRows
    }
  }, [allSheetsData])

  const handleClose = () => {
    onClose()
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SearchOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
          <span>전체 데이터 검색</span>
          {isLoadingData && <Spin size="small" style={{ marginLeft: 8 }} />}
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
      destroyOnHidden={true}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '24px',
        },
      }}
    >
      {isLoadingData ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            전체 데이터를 불러오는 중...
          </Text>
        </div>
      ) : (
        <>
          {/* 검색 입력 */}
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              총 {combinedData?.rows.length || 0}개 항목 ({allSheetsData.length}개 시트)
            </Text>
          </div>

          {/* 검색 결과 테이블 */}
          <DataTable data={combinedData} isLoading={false} />
        </>
      )}
    </Modal>
  )
}

