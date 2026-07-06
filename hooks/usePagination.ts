'use client'

import { useState, useCallback } from 'react'

interface UsePaginationOptions {
  initialPage?: number
  pageSize?: number
}

export function usePagination({ initialPage = 1, pageSize = 10 }: UsePaginationOptions = {}) {
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(0)

  const totalPages = Math.ceil(total / pageSize)

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages || 1)))
  }, [totalPages])

  const nextPage = useCallback(() => goToPage(page + 1), [page, goToPage])
  const prevPage = useCallback(() => goToPage(page - 1), [page, goToPage])
  const firstPage = useCallback(() => goToPage(1), [goToPage])

  const reset = useCallback(() => {
    setPage(1)
    setTotal(0)
  }, [])

  return {
    page,
    pageSize,
    total,
    totalPages,
    setTotal,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    reset,
    setPage,
  }
}
