import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  className?: string
}

// Small helper to check valid date
const isValidDate = (y: number, m: number, d: number) => {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (y < 1900 || y > new Date().getFullYear()) return false
  if (m < 1 || m > 12) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const today = new Date()
  const initial = value ? {
    day: String(value.getDate()).padStart(2, '0'),
    month: String(value.getMonth() + 1).padStart(2, '0'),
    year: String(value.getFullYear())
  } : { day: '', month: '', year: '' }

  const [day, setDay] = React.useState<string>(initial.day)
  const [month, setMonth] = React.useState<string>(initial.month)
  const [year, setYear] = React.useState<string>(initial.year)

  // sync when external value changes
  React.useEffect(() => {
    if (value) {
      const d = String(value.getDate()).padStart(2, '0')
      const m = String(value.getMonth() + 1).padStart(2, '0')
      const y = String(value.getFullYear())
      setDay(d); setMonth(m); setYear(y)
    } else {
      setDay(''); setMonth(''); setYear('')
    }
  }, [value])

  // helper to emit change only when full and valid
  React.useEffect(() => {
    const dNum = Number(day)
    const mNum = Number(month)
    const yNum = Number(year)
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      if (isValidDate(yNum, mNum, dNum)) {
        onChange?.(new Date(yNum, mNum - 1, dNum))
      } else {
        onChange?.(undefined)
      }
    }
  }, [day, month, year, onChange])

  const onDayInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0,2)
    setDay(v)
    if (v.length === 2) {
      // auto focus month
      const next = (e.target as HTMLInputElement).nextElementSibling as HTMLInputElement | null
      next?.focus()
    }
  }
  const onMonthInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0,2)
    setMonth(v)
    if (v.length === 2) {
      const next = (e.target as HTMLInputElement).nextElementSibling as HTMLInputElement | null
      next?.focus()
    }
  }
  const onYearInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0,4)
    setYear(v)
  }

  const containerStyle = "flex items-center gap-2 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
  const inputBase = "bg-transparent focus:outline-none text-sm w-10 text-center"

  return (
    <div className={cn('relative w-full', className)}>
      <div className={containerStyle}>
        <input
          aria-label="Dia"
          placeholder="DD"
          value={day}
          onChange={onDayInput}
          className={cn(inputBase)}
          inputMode="numeric"
        />
        <span className="text-sm text-muted-foreground">/</span>
        <input
          aria-label="Mês"
          placeholder="MM"
          value={month}
          onChange={onMonthInput}
          className={cn(inputBase)}
          inputMode="numeric"
        />
        <span className="text-sm text-muted-foreground">/</span>
        <input
          aria-label="Ano"
          placeholder="AAAA"
          value={year}
          onChange={onYearInput}
          className={cn('bg-transparent focus:outline-none text-sm w-20 text-center')}
          inputMode="numeric"
        />

        <div className="ml-auto pointer-events-none">
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </div>
      </div>
    </div>
  )
}