import { useState, useEffect, useMemo } from 'react'
import { Modal, Form, Input, Select, DatePicker, InputNumber, message, AutoComplete, Button } from 'antd'
import { useTheme } from '../contexts/ThemeContext'
import dayjs, { Dayjs } from 'dayjs'
import type { SheetData } from '../services/sheetsApi'

interface AddDataModalProps {
  open: boolean
  onCancel: () => void
  onSuccess: () => void
  accessToken: string
  availableSheets: { sheetId: number; title: string }[]
  defaultSheet?: string
  allSheetsData: SheetData[]
}

export function AddDataModal({
  open,
  onCancel,
  onSuccess,
  accessToken,
  availableSheets,
  defaultSheet,
  allSheetsData,
}: AddDataModalProps) {
  const { isDark } = useTheme()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [elementOpen, setElementOpen] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)

  // 기본값 설정
  useEffect(() => {
    if (open && defaultSheet) {
      form.setFieldsValue({
        sheet: defaultSheet,
        date: dayjs(),
      })
    }
  }, [open, defaultSheet, form])

  // 모든 시트 데이터에서 고유한 값 추출
  const uniqueOptions = useMemo(() => {
    const elements = new Set<string>()
    const categories = new Set<string>()
    const memos = new Set<string>()

    allSheetsData.forEach((sheetData) => {
      sheetData.rows.forEach((row) => {
        // row[1]: 요소 (예: 살구, 감자)
        if (row[1] && row[1].trim()) {
          elements.add(row[1].trim())
        }
        // row[2]: 지출 분류
        if (row[2] && row[2].trim()) {
          categories.add(row[2].trim())
        }
        // row[6]: 메모
        if (row[6] && row[6].trim()) {
          memos.add(row[6].trim())
        }
      })
    })

    return {
      elements: Array.from(elements).sort(),
      categories: Array.from(categories).sort(),
      memos: Array.from(memos).sort(),
    }
  }, [allSheetsData])

  // 입력 필드 완전 초기화 (시트와 날짜만 유지)
  const handleReset = () => {
    const currentValues = form.getFieldsValue()
    form.resetFields()
    form.setFieldsValue({
      sheet: currentValues.sheet,
      date: currentValues.date,
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const { sheet, date, element, category, summary, amount, memo } = values

      // 날짜 포맷팅 (YYYY. M. D)
      const formattedDate = (date as Dayjs).format('YYYY. M. D')

      // 행 데이터 구성 (A~G 열)
      const rowData = [
        formattedDate,           // A: 날짜
        element || '',           // B: 요소
        category || '',          // C: 지출 분류
        summary || '',           // D: 요약
        amount ? String(amount) : '', // E: 금액
        '',                      // F: 빈 열 (필요시)
        memo || '',              // G: 메모
      ]

      // Google Sheets API로 데이터 추가
      const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID
      const range = `'${sheet}'!A:G`
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
          range
        )}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        }
      )

      if (!response.ok) {
        throw new Error('데이터 추가에 실패했습니다.')
      }

      message.success('데이터가 성공적으로 추가되었습니다!')
      onSuccess()
      
      // 날짜/요소/지출분류는 유지하고 나머지만 초기화
      const preservedValues = {
        sheet: values.sheet,
        date: values.date,
        element: values.element,
        category: values.category,
      }
      form.resetFields()
      form.setFieldsValue(preservedValues)
    } catch (error) {
      console.error('Error adding data:', error)
      if (error instanceof Error && error.message) {
        message.error(error.message)
      } else {
        message.error('데이터 추가 중 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>
        {`
          /* 전역 드롭다운 스타일 */
          .ant-select-dropdown.add-data-dropdown,
          .ant-picker-dropdown.add-data-dropdown {
            background: ${isDark ? '#111827' : '#fff'} !important;
          }
          
          .ant-select-dropdown.add-data-dropdown .ant-select-item,
          .ant-picker-dropdown.add-data-dropdown .ant-picker-cell {
            background: ${isDark ? '#111827' : '#fff'} !important;
            color: ${isDark ? '#e5e7eb' : '#000'} !important;
          }
          
          .ant-select-dropdown.add-data-dropdown .ant-select-item-option-selected {
            background: ${isDark ? '#1e3a8a' : '#e6f7ff'} !important;
            color: ${isDark ? '#fff' : '#000'} !important;
          }
          
          .ant-select-dropdown.add-data-dropdown .ant-select-item-option-active {
            background: ${isDark ? '#1e293b' : '#f5f5f5'} !important;
          }
          
          .ant-picker-dropdown.add-data-dropdown .ant-picker-panel {
            background: ${isDark ? '#111827' : '#fff'} !important;
            border-color: ${isDark ? '#374151' : '#d9d9d9'} !important;
          }
          
          .ant-picker-dropdown.add-data-dropdown .ant-picker-header,
          .ant-picker-dropdown.add-data-dropdown .ant-picker-body {
            color: ${isDark ? '#e5e7eb' : '#000'} !important;
          }
          
          .ant-picker-dropdown.add-data-dropdown .ant-picker-cell-selected .ant-picker-cell-inner {
            background: ${isDark ? '#1e3a8a' : '#1890ff'} !important;
            color: #fff !important;
          }
          
          .ant-picker-dropdown.add-data-dropdown .ant-picker-cell:hover .ant-picker-cell-inner {
            background: ${isDark ? '#1e293b' : '#f5f5f5'} !important;
          }
        `}
      </style>
      <Modal
        title="데이터 추가"
        open={open}
        onCancel={onCancel}
        onOk={handleSubmit}
        confirmLoading={loading}
        width={600}
        destroyOnClose
        styles={{
          header: {
            background: isDark ? '#1f2937' : '#fff',
            borderBottom: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
          },
          body: {
            background: isDark ? '#111827' : '#fff',
          },
          footer: {
            background: isDark ? '#111827' : '#fff',
            borderTop: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
          },
        }}
        footer={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
          }}>
            <Button 
              onClick={handleReset} 
              disabled={loading}
              style={{
                background: isDark ? '#1f2937' : '#fff',
                borderColor: isDark ? '#374151' : '#d9d9d9',
                color: isDark ? '#e5e7eb' : '#000',
              }}
            >
              입력 초기화
            </Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                onClick={onCancel} 
                disabled={loading}
                style={{
                  background: isDark ? '#1f2937' : '#fff',
                  borderColor: isDark ? '#374151' : '#d9d9d9',
                  color: isDark ? '#e5e7eb' : '#000',
                }}
              >
                취소
              </Button>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                추가
              </Button>
            </div>
          </div>
        }
      >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          sheet: defaultSheet,
          date: dayjs(),
        }}
      >
        <style>
          {`
            /* 모든 입력 필드 배경색 통일 */
            .add-data-form .ant-input,
            .add-data-form .ant-input-number,
            .add-data-form .ant-input-number-input,
            .add-data-form .ant-picker,
            .add-data-form .ant-picker-input input,
            .add-data-form .ant-select-selector {
              background: ${isDark ? '#111827' : '#fff'} !important;
              border-color: ${isDark ? '#374151' : '#d9d9d9'} !important;
              color: ${isDark ? '#e5e7eb' : '#000'} !important;
            }
            
            /* InputNumber 내부 input */
            .add-data-form .ant-input-number-input {
              background: transparent !important;
            }
            
            /* Placeholder */
            .add-data-form .ant-input::placeholder,
            .add-data-form .ant-input-number-input::placeholder,
            .add-data-form .ant-picker-input input::placeholder,
            .add-data-form .ant-select-selection-placeholder {
              color: ${isDark ? '#6b7280' : '#bfbfbf'} !important;
            }
            
            /* Label */
            .add-data-form .ant-form-item-label > label {
              color: ${isDark ? '#e5e7eb' : '#000'} !important;
            }
            
            /* Hover */
            .add-data-form .ant-input:hover,
            .add-data-form .ant-input-number:hover,
            .add-data-form .ant-picker:hover,
            .add-data-form .ant-select-selector:hover {
              border-color: ${isDark ? '#4b5563' : '#40a9ff'} !important;
            }
            
            /* Focus */
            .add-data-form .ant-input:focus,
            .add-data-form .ant-input-number-focused,
            .add-data-form .ant-picker-focused,
            .add-data-form .ant-select-focused .ant-select-selector {
              border-color: ${isDark ? '#60a5fa' : '#40a9ff'} !important;
              box-shadow: 0 0 0 2px ${isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(24, 144, 255, 0.2)'} !important;
            }
            
            /* Select 화살표 아이콘 */
            .add-data-form .ant-select-arrow,
            .add-data-form .ant-picker-suffix {
              color: ${isDark ? '#9ca3af' : '#000'} !important;
            }
            
            /* InputNumber 버튼 */
            .add-data-form .ant-input-number-handler-wrap {
              background: ${isDark ? '#1f2937' : '#fafafa'} !important;
              border-left-color: ${isDark ? '#374151' : '#d9d9d9'} !important;
            }
            
            .add-data-form .ant-input-number-handler {
              border-color: ${isDark ? '#374151' : '#d9d9d9'} !important;
              color: ${isDark ? '#9ca3af' : '#000'} !important;
            }
            
            .add-data-form .ant-input-number-handler:hover {
              background: ${isDark ? '#374151' : '#f5f5f5'} !important;
            }
          `}
        </style>
        <div className="add-data-form">
          <Form.Item
            name="sheet"
            label="시트 선택"
            rules={[{ required: true, message: '시트를 선택해주세요' }]}
          >
            <Select
              placeholder="시트를 선택하세요"
              options={availableSheets.map((sheet) => ({
                label: sheet.title,
                value: sheet.title,
              }))}
              popupClassName="add-data-dropdown"
              open={sheetOpen}
              onDropdownVisibleChange={(visible) => setSheetOpen(visible)}
              onSelect={() => {
                setSheetOpen(false)
              }}
            />
          </Form.Item>

          <Form.Item
            name="date"
            label="날짜"
            rules={[{ required: true, message: '날짜를 입력해주세요' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY. M. D"
              placeholder="날짜를 선택하세요"
              popupClassName="add-data-dropdown"
              onChange={() => {
                // 날짜 선택 시 드롭다운 자동 닫힘 (기본 동작)
              }}
            />
          </Form.Item>

          <Form.Item name="element" label="요소">
            <AutoComplete
              placeholder="예: 살구, 감자"
              options={uniqueOptions.elements.map((el) => ({ value: el }))}
              filterOption={(inputValue, option) =>
                option!.value.toLowerCase().includes(inputValue.toLowerCase())
              }
              popupClassName="add-data-dropdown"
              open={elementOpen}
              onDropdownVisibleChange={(visible) => setElementOpen(visible)}
              onSelect={() => {
                setElementOpen(false)
              }}
            />
          </Form.Item>

          <Form.Item name="category" label="지출 분류">
            <Select
              placeholder="지출 분류를 선택하세요"
              options={uniqueOptions.categories.map((cat) => ({ label: cat, value: cat }))}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              popupClassName="add-data-dropdown"
              open={categoryOpen}
              onDropdownVisibleChange={(visible) => setCategoryOpen(visible)}
              onSelect={() => {
                setCategoryOpen(false)
              }}
            />
          </Form.Item>

          <Form.Item name="summary" label="요약">
            <Input placeholder="거래 내용 요약" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="금액"
            rules={[{ required: true, message: '금액을 입력해주세요' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="금액을 입력하세요"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => parseFloat((value || '').replace(/\$\s?|(,*)/g, '') || '0') as any}
              min={0}
            />
          </Form.Item>

          <Form.Item name="memo" label="메모">
            <AutoComplete
              placeholder="메모 (선택)"
              options={uniqueOptions.memos.map((memo) => ({ value: memo }))}
              filterOption={(inputValue, option) =>
                option!.value.toLowerCase().includes(inputValue.toLowerCase())
              }
              popupClassName="add-data-dropdown"
              open={memoOpen}
              onDropdownVisibleChange={(visible) => setMemoOpen(visible)}
              onSelect={() => {
                setMemoOpen(false)
              }}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
    </>
  )
}

