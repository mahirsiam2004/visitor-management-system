'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FilterOption {
  value: string
  label: string
}

interface SearchAndFilterProps {
  search: string
  onSearchChange: (value: string) => void
  filters?: {
    key: string
    label: string
    value: string
    options: FilterOption[]
    onChange: (value: string) => void
  }[]
  onClear?: () => void
  className?: string
  placeholder?: string
}

export default function SearchAndFilter({
  search,
  onSearchChange,
  filters = [],
  onClear,
  className,
  placeholder = 'Search...',
}: SearchAndFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const hasActiveFilters = search || filters.some((f) => f.value)

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filters.map((filter) => (
        <div key={filter.key} className="min-w-[140px]">
          <Select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={filter.label}
          >
            <SelectOption value="">{filter.label}</SelectOption>
            {filter.options.map((opt) => (
              <SelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </SelectOption>
            ))}
          </Select>
        </div>
      ))}

      {hasActiveFilters && onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-slate-500 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}
