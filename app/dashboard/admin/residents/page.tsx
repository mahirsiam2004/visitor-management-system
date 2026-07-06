'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Building2, Trash2, Edit, UserCheck } from 'lucide-react'
import { getAllProfiles, updateUserRole, deleteUser } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Select, SelectOption } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/lib/utils/guest-pass'
import type { Profile } from '@/types'
import { PAGE_SIZE } from '@/constants'

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 400)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchResidents = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAllProfiles({
        page,
        pageSize,
        search: debouncedSearch,
        role: 'resident',
      })
      if (result.success) {
        setResidents(result.data.data)
        setTotal(result.data.total)
      } else {
        toast.error(result.error)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch])

  useEffect(() => {
    fetchResidents()
  }, [fetchResidents])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const handleRoleChange = async (userId: string, newRole: 'resident' | 'security' | 'admin') => {
    setUpdatingRole(userId)
    try {
      const result = await updateUserRole(userId, newRole)
      if (result.success) {
        toast.success('Role updated')
        fetchResidents()
      } else {
        toast.error(result.error)
      }
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteUser(deleteTarget.id)
      if (result.success) {
        toast.success('User deleted')
        setDeleteTarget(null)
        fetchResidents()
      } else {
        toast.error(result.error)
      }
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'full_name',
      label: 'Resident',
      render: (p: Profile) => (
        <div>
          <p className="font-medium text-slate-900">{p.full_name}</p>
          <p className="text-xs text-slate-400">{p.email}</p>
        </div>
      ),
    },
    {
      key: 'apartment_number',
      label: 'Apartment',
      render: (p: Profile) => (
        <span className="text-slate-600">{p.apartment_number || '—'}</span>
      ),
    },
    {
      key: 'phone_number',
      label: 'Phone',
      render: (p: Profile) => (
        <span className="text-slate-600">{p.phone_number || '—'}</span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (p: Profile) => <StatusBadge type="role" status={p.role} />,
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (p: Profile) => (
        <span className="text-slate-500 text-xs">{formatDate(p.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p: Profile) => (
        <div className="flex items-center gap-2">
          <Select
            value={p.role}
            onChange={(e) => handleRoleChange(p.id, e.target.value as any)}
            disabled={updatingRole === p.id}
            className="text-xs h-7 py-0"
          >
            <SelectOption value="resident">Resident</SelectOption>
            <SelectOption value="security">Security</SelectOption>
            <SelectOption value="admin">Admin</SelectOption>
          </Select>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeleteTarget(p)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Residents"
        description="Manage all resident accounts in the system"
      />

      <SearchAndFilter
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by name, email, apartment..."
        onClear={() => setSearch('')}
      />

      <DataTable
        data={residents}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        rowKey={(p) => p.id}
        emptyMessage="No residents found"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogContent
          title="Delete User"
          description="This action cannot be undone. All data associated with this user will be permanently deleted."
          onClose={() => setDeleteTarget(null)}
        >
          {deleteTarget && (
            <div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4">
                <p className="text-sm font-medium text-red-800">{deleteTarget.full_name}</p>
                <p className="text-xs text-red-600">{deleteTarget.email}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete User'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
