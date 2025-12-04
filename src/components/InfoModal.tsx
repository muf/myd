import { Modal, Typography, Table, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

const { Text } = Typography

interface InfoModalProps {
  open: boolean
  onClose: () => void
  infoData: string[][]
}

interface Section {
  title: string
  emoji: string
  color: string
  data: string[][]
  hideTotal?: boolean
}

export function InfoModal({ open, onClose, infoData }: InfoModalProps) {
  const { isDark } = useTheme()

  // 데이터를 분석하여 카테고리별 섹션 추출
  const parseSections = (): Section[] => {
    if (!infoData || infoData.length === 0) {
      return []
    }

    const sections: Section[] = []
    
    // 카테고리 정의 (더 유연한 매칭) - "매년 모으는 돈"을 맨 위로
    const categoryPatterns = [
      { keywords: ['매년', '모으'], title: '매년 모으는 돈', emoji: '💎', color: '#8b5cf6', hideTotal: true },
      { keywords: ['매월', '수입'], title: '매월 수입', emoji: '💰', color: '#10b981' },
      { keywords: ['매달', '지출'], title: '매달 지출', emoji: '💸', color: '#ef4444' },
      { keywords: ['매월', '저축'], title: '매월 저축', emoji: '🏦', color: '#3b82f6' },
      { keywords: ['매년', '지출'], title: '매년 지출', emoji: '📅', color: '#f97316' },
      { keywords: ['매년', '수입'], title: '매년 수입', emoji: '💵', color: '#22c55e' },
    ]

    let i = 0
    while (i < infoData.length) {
      const row = infoData[i]
      
      // 빈 행 건너뛰기
      if (!row || row.every(cell => !cell || cell.trim() === '')) {
        i++
        continue
      }

      // 카테고리 제목 찾기 - 전체 행을 문자열로 결합해서 검색
      const rowText = row.join(' ').trim().toLowerCase()
      
      let matchedCategory = null
      
      for (const pattern of categoryPatterns) {
        // 모든 키워드가 포함되어 있는지 확인
        const matches = pattern.keywords.every(keyword => 
          rowText.includes(keyword.toLowerCase())
        )
        if (matches) {
          matchedCategory = pattern
          break
        }
      }

      if (matchedCategory) {
        // 다음 행부터 모든 데이터 수집 (빈 행이나 다음 카테고리 전까지)
        const sectionData: string[][] = []
        i++
        
        // 모든 데이터 행 추가 (헤더 포함)
        while (i < infoData.length) {
          const dataRow = infoData[i]
          
          // 빈 행이면 종료
          if (!dataRow || dataRow.every(cell => !cell || cell.trim() === '')) {
            break
          }
          
          // 다음 카테고리 제목인지 확인
          const nextRowText = dataRow.join(' ').trim().toLowerCase()
          const isNextCategory = categoryPatterns.some(pattern => 
            pattern.keywords.every(keyword => 
              nextRowText.includes(keyword.toLowerCase())
            )
          )
          
          if (isNextCategory) break
          
          sectionData.push(dataRow)
          i++
        }

        if (sectionData.length > 0) {
          sections.push({
            title: matchedCategory.title,
            emoji: matchedCategory.emoji,
            color: matchedCategory.color,
            data: sectionData,
            hideTotal: matchedCategory.hideTotal
          })
        }
      } else {
        i++
      }
    }

    return sections
  }

  // 금액 파싱 헬퍼
  const parseAmount = (value: string): number => {
    if (!value) return 0
    const cleaned = value.replace(/[^\d.-]/g, '').replace(/,/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : Math.abs(num)
  }

  // 금액 포맷 헬퍼
  const formatAmount = (amount: number): string => {
    return `₩${amount.toLocaleString()}`
  }

  // 빈 열 제거 및 테이블 렌더링
  const renderSection = (section: Section, index: number) => {
    if (section.data.length === 0) return null

    // 빈 열 식별 (모든 행에서 해당 열이 비어있으면 제거)
    const columnHasData = (colIndex: number): boolean => {
      return section.data.some(row => row[colIndex] && row[colIndex].trim() !== '')
    }

    const maxCols = Math.max(...section.data.map(row => row.length))
    const validColumns: number[] = []
    for (let i = 0; i < maxCols; i++) {
      if (columnHasData(i)) {
        validColumns.push(i)
      }
    }

    if (validColumns.length === 0) return null

    // 정보 시트는 헤더 없이 바로 데이터가 시작됨
    // 자동으로 헤더 생성하고 모든 행을 데이터로 처리
    const firstRow = section.data[0] || []
    const headers: string[] = firstRow.map((_, idx) => {
      if (idx === 0) return '항목'
      if (idx === firstRow.length - 1) return '금액'
      return '항목'
    })
    const dataRows = section.data // 첫 행부터 모두 데이터

    // 빈 행 제거
    const validDataRows = dataRows.filter(row => 
      row.some(cell => cell && cell.trim() !== '')
    )

    // 금액 열 찾기 (금액이 포함된 열)
    let amountColIndex = validColumns.find(colIdx => {
      const headerText = headers[colIdx]?.toLowerCase() || ''
      return headerText.includes('금액') || headerText.includes('원') || headerText.includes('₩')
    })

    // 헤더에서 금액 열을 못 찾았으면, 실제 데이터를 보고 금액이 있는 열 찾기
    // 마지막 열부터 역순으로 검색 (일반적으로 금액은 오른쪽에 위치)
    if (amountColIndex === undefined && validDataRows.length > 0) {
      for (let i = validColumns.length - 1; i >= 0; i--) {
        const colIdx = validColumns[i]
        const amountRowCount = validDataRows.filter(row => {
          const cell = row[colIdx] || ''
          const cleaned = cell.replace(/[^\d]/g, '')
          return cleaned.length >= 3 // 3자리 이상 숫자가 있으면 금액으로 간주
        }).length
        
        // 50% 이상의 행에 금액이 있으면 금액 열로 간주
        if (amountRowCount >= validDataRows.length * 0.5) {
          amountColIndex = colIdx
          break
        }
      }
    }

    // 합계 계산
    let totalAmount = 0
    if (amountColIndex !== undefined) {
      const colIdx = amountColIndex // TypeScript를 위한 로컬 변수
      validDataRows.forEach(row => {
        const amountValue = row[colIdx] || ''
        totalAmount += parseAmount(amountValue)
      })
    }

    // 테이블 컬럼 구성 (빈 열 제외)
    const columns = validColumns.map((colIdx, index) => {
      // 왼쪽(항목) 60%, 오른쪽(금액) 40%
      const isFirstCol = index === 0
      const isLastCol = index === validColumns.length - 1
      
      return {
        title: headers[colIdx] || '항목',
        dataIndex: `col${colIdx}`,
        key: `col${colIdx}`,
        width: isFirstCol ? '60%' : isLastCol ? '40%' : '0%',
        ellipsis: {
          showTitle: false,
        },
        render: (text: string) => {
          const displayText = text || '-'
          
          return (
            <Tooltip title={displayText} placement="topLeft">
              <Text 
                style={{ 
                  color: isDark ? '#f8fafc' : '#1f2937',
                  cursor: 'pointer',
                }}
              >
                {displayText}
              </Text>
            </Tooltip>
          )
        },
      }
    })

    // 데이터 소스 구성 (빈 열 제외)
    const dataSource = validDataRows.map((row, idx) => {
      const record: any = { key: idx }
      validColumns.forEach((colIdx) => {
        record[`col${colIdx}`] = row[colIdx] || ''
      })
      return record
    })

    if (dataSource.length === 0) return null

    return (
      <div key={index} style={{ marginBottom: 32 }}>
        <div
          style={{
            background: isDark ? '#1e293b' : '#f8fafc',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderLeft: `4px solid ${section.color}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{section.emoji}</span>
            <Text strong style={{ fontSize: 16, color: isDark ? '#f8fafc' : '#1f2937' }}>
              {section.title}
            </Text>
          </div>
          {!section.hideTotal && totalAmount > 0 && (
            <Text 
              strong 
              style={{ 
                fontSize: 16, 
                color: section.color,
              }}
            >
              {formatAmount(totalAmount)}
            </Text>
          )}
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          size="small"
          bordered
          tableLayout="fixed"
        />
      </div>
    )
  }

  const sections = parseSections()

  // 원시 데이터 테이블 렌더링 (파싱 실패시 대체 UI)
  const renderRawData = () => {
    if (!infoData || infoData.length === 0) {
      return <Text type="secondary">정보 데이터가 없습니다.</Text>
    }

    // 첫 행을 헤더로 사용
    const headers = infoData[0] || []
    const dataRows = infoData.slice(1)

    // 빈 열 찾기
    const maxCols = Math.max(...infoData.map(row => row.length))
    const validColumns: number[] = []
    for (let i = 0; i < maxCols; i++) {
      const hasData = infoData.some(row => row[i] && row[i].trim() !== '')
      if (hasData) validColumns.push(i)
    }

    const columns = validColumns.map((colIdx, index) => {
      const isFirstCol = index === 0
      const isLastCol = index === validColumns.length - 1
      
      return {
        title: headers[colIdx] || '항목',
        dataIndex: `col${colIdx}`,
        key: `col${colIdx}`,
        width: isFirstCol ? '60%' : isLastCol ? '40%' : '0%',
        ellipsis: {
          showTitle: false,
        },
        render: (text: string) => {
          const displayText = text || '-'
          
          return (
            <Tooltip title={displayText} placement="topLeft">
              <Text 
                style={{ 
                  color: isDark ? '#f8fafc' : '#1f2937',
                  cursor: 'pointer',
                }}
              >
                {displayText}
              </Text>
            </Tooltip>
          )
        },
      }
    })

    const dataSource = dataRows
      .filter(row => row.some(cell => cell && cell.trim() !== ''))
      .map((row, idx) => {
        const record: any = { key: idx }
        validColumns.forEach((colIdx) => {
          record[`col${colIdx}`] = row[colIdx] || ''
        })
        return record
      })

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        bordered
        tableLayout="fixed"
      />
    )
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoCircleOutlined style={{ color: '#60a5fa', fontSize: 18 }} />
          <span>정보</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
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
      {sections.length > 0 ? (
        sections.map((section, index) => renderSection(section, index))
      ) : (
        renderRawData()
      )}
    </Modal>
  )
}

