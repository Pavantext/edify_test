"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
    dateRange: { from: Date; to: Date; };
    setDateRange: (range: { from: Date; to: Date; }) => void;
}

export function CalendarDateRangePicker({ dateRange, setDateRange, className }: DatePickerWithRangeProps) {
    const [date, setDate] = React.useState<DateRange>({
        from: dateRange.from,
        to: dateRange.to,
    });
    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
        setDate({
            from: dateRange.from,
            to: dateRange.to,
        });
    }, [dateRange]);

    const handleSelect = (range: DateRange | undefined) => {
        if (range && range.from && range.to) {
            setDate(range);
            if (!isOpen) {
                setDateRange({ from: range.from, to: range.to });
            }
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open && date?.from && date?.to) {
            setDateRange({ from: date.from, to: date.to });
        }
    };

    const applyPredefinedRange = (days: number) => {
        const to = new Date();
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        setDate({ from, to });
        setDateRange({ from, to });
        setIsOpen(false);
    };

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={isOpen} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <div className="p-2 flex flex-wrap gap-1 border-b">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyPredefinedRange(7)}
                        >
                            Last 7 Days
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyPredefinedRange(30)}
                        >
                            Last 30 Days
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyPredefinedRange(90)}
                        >
                            Last 90 Days
                        </Button>
                    </div>
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}