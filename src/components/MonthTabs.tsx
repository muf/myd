interface MonthTabsProps {
  months: { sheetId: number; title: string }[]
  selectedMonth: string | null
  onSelectMonth: (month: string) => void
}

export function MonthTabs({ months, selectedMonth, onSelectMonth }: MonthTabsProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2">
        {months.map((month, index) => {
          const isSelected = month.title === selectedMonth
          return (
            <button
              key={month.sheetId}
              onClick={() => onSelectMonth(month.title)}
              className={`
                px-4 py-2 rounded-xl font-medium transition-all duration-300
                animate-slideIn
                ${isSelected
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white border border-slate-700/50'
                }
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {month.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}

