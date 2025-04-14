import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TimeRange = "1d" | "1w" | "1m" | "3m" | "6m" | "1y"

interface TimeRangeSelectorProps {
  onChange: (value: TimeRange) => void
  value: TimeRange
}

export function TimeRangeSelector({ onChange, value }: TimeRangeSelectorProps) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select time range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1d">Last 24 Hours</SelectItem>
        <SelectItem value="1w">Last Week</SelectItem>
        <SelectItem value="1m">Last Month</SelectItem>
        <SelectItem value="3m">Last 3 Months</SelectItem>
        <SelectItem value="6m">Last 6 Months</SelectItem>
        <SelectItem value="1y">Last Year</SelectItem>
      </SelectContent>
    </Select>
  )
}