'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface QueryErrorStateProps {
  title?: string
  message?: string | null
  onRetry: () => void
  retrying?: boolean
  className?: string
}

export function QueryErrorState({
  title = 'Failed to load data',
  message = 'An error occurred while connecting to the database. Please try again.',
  onRetry,
  retrying = false,
  className = '',
}: QueryErrorStateProps) {
  return (
    <div className={`rounded-xl border border-rose-200 bg-rose-50/60 p-8 text-center my-4 ${className}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-3 shadow-xs">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto mb-5 leading-relaxed">
        {message || 'Unable to fetch records from the database schema cache.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retrying}
        className="gap-2 border-rose-300 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-medium px-4 shadow-2xs"
      >
        <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  )
}

export default QueryErrorState
