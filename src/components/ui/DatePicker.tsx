import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  className?: string
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  // internal string state to avoid controlled-value jumping while typing
  const initial = value ? format(value, "yyyy-MM-dd") : ""
  const [inputValue, setInputValue] = React.useState<string>(initial)

  // keep internal state in sync when external value prop changes
  React.useEffect(() => {
    const newVal = value ? format(value, "yyyy-MM-dd") : ""
    setInputValue(newVal)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)

    // Only propagate when we have a full yyyy-mm-dd string
    const fullDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(val)
    if (!val) {
      onChange?.(undefined)
      return
    }
    if (!fullDateMatch) {
      // don't call onChange yet to avoid overwriting while user types
      return
    }

    // parse and emit
    const [year, month, day] = val.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    onChange?.(date)
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="date"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
            !inputValue && "text-muted-foreground"
          )}
          value={inputValue}
          onChange={handleChange}
          max={format(new Date(), "yyyy-MM-dd")} // Não permite datas futuras
        />
        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
    </div>
  )
}