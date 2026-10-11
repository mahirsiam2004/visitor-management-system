'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Shield, UserX, UserCheck, UserPlus } from 'lucide-react'
import { getAllProfiles, updateUserRole, deactivateUser, reactivateUser, createSecurityGuard } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Select, SelectOption } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import SearchAndFilter from '@/components/shared/SearchAndFilter'
import DataTable from '@/components/shared/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/lib/utils/guest-pass'
import type { Profile } from '@/types'
import { PAGE_SIZE } from '@/constants'

const emptyCreate = { fullName: '', email: '', phoneNumber: '', password: '' }

export default function SecurityGuardsPage() {
  const [guards, setGuards] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<Profile | null>(null)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [acting, setActing] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [creating, setCreating] = useState(false)
  const debouncedSearch = useDebounce(search, 400)
  const { page, pageSize, total, setTotal, goToPage, setPage } = usePagination({ pageSize: PAGE_SIZE })

  const fetchGuards = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAllProfiles({
        page, pageSize, search: debouncedSearch,
        role: 'security', includeInactive: showInactive,
      })
      if (result.success) {
        setGuards(result.data.data)
        setTotal(result.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, showInactive])

  useEffect(() => { fetchGuards() }, [fetchGuards])
  useEffect(() => { setPage(1) }, [debouncedSearch, showInactive])

  const handleRoleChange = async (userId: string, newRole: 'resident' | 'security' | 'admin') => {
    setUpdatingRole(userId)
    const result = await updateUserRole(userId, newRole)
    if (result.success) { toast.success('Role updated'); fetchGuards() }
    else toast.error(result.error)
    setUpdatingRole(null)
  }

  const handleDeactivate = async () => {
    if (!deactivateTarget || !deactivateReason.trim()) { toast.error('Please provide a reason'); return }
    setActing(true)
    const result = await deactivateUser(deactivateTarget.id, deactivateReason)
    if (result.success) {
      toast.success('Guard deactivated')
      setDeactivateTarget(null)
      setDeactivateReason('')
      fetchGuards()
    } else {
      toast.error(result.error)
    }
    setActing(false)
  }

  const handleReactivate = async (userId: string) => {
    setActing(true)
    const result = await reactivateUser(userId)
    if (result.success) { toast.success('Guard reactivated'); fetchGuards() }
    else toast.error(result.error)
    setActing(false)
  }

  const handleCreate = async () => {
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.error('Name, email and password are required')
      return
    }
    if (createForm.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setCreating(true)
    const result = await createSecurityGuard({
      fullName: createForm.fullName.trim(),
      email: createForm.email.trim(),
      phoneNumber: createForm.phoneNumber.trim() || undefined,
      password: createForm.password,
    })
    if (result.success) {
      toast.success('Security guard account created')
      setCreateOpen(false)
      setCreateForm(emptyCreate)
      fetchGuards()
    } else {
      toast.error(result.error)
    }
    setCreating(false)
  }

  const columns = [
    {
      key: 'full_name',
      label: 'Name',
      render: (p: Profile) => (
        <div>
          <p className="font-medium text-slate-900">{p.full_name}</p>
          <p className="text-xs text-slate-400">{p.email}</p>
        </div>
      ),
    },
    {
      key: 'phone_number',
      label: 'Phone',
      render: (p: Profile) => <span className="text-slate-600">{p.phone_number || '—'}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (p: Profile) => <StatusBadge type="role" status={p.role} />,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (p: Profile) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          p.is_active
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-500 border-slate-200'
        }`}>
          {p.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Added',
      render: (p: Profile) => <span className="text-slate-500 text-xs">{formatDate(p.created_at)}</span>,
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
          {p.is_active ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => { setDeactivateTarget(p); setDeactivateReason('') }}
              title="Deactivate"
            >
              <UserX className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
              onClick={() => handleReactivate(p.id)}
              disabled={acting}
              title="Reactivate"
            >
              <UserCheck className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Security Guards" description="Manage security staff accounts and roles">
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add Guard
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4">
        <SearchAndFilter
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by name or email…"
          onClear={() => setSearch('')}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
      </div>

      <DataTable
        data={guards}
        columns={columns}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        rowKey={(p) => p.id}
        emptyMessage="No security guards found"
      />

      {/* Deactivate Dialog */}
      <Dialog open={!!deactivateTarget} onClose={() => { setDeactivateTarget(null); setDeactivateReason('') }}>
        <DialogContent title="Deactivate Guard" onClose={() => { setDeactivateTarget(null); setDeactivateReason('') }}>
          {deactivateTarget && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Deactivate <strong>{deactivateTarget.full_name}</strong>? They will not be able to log in.
                All their entry logs are preserved and this can be reversed.
              </p>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Resigned, end of contract…"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  disabled={acting}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDeactivateTarget(null); setDeactivateReason('') }} disabled={acting}>Cancel</Button>
                <Button
                  onClick={handleDeactivate}
                  disabled={acting || !deactivateReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {acting ? 'Deactivating…' : 'Deactivate'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Guard Dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setCreateForm(emptyCreate) }}>
        <DialogContent title="Add Security Guard" onClose={() => { setCreateOpen(false); setCreateForm(emptyCreate) }}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Create a security guard account. Guards can only be created by admins.
            </p>
            <div className="space-y-3">
              {[
                { key: 'fullName',    label: 'Full Name *',    type: 'text',     placeholder: 'Mohammad Hossain' },
                { key: 'email',       label: 'Email *',        type: 'email',    placeholder: 'guard@example.com' },
                { key: 'phoneNumber', label: 'Phone (optional)', type: 'tel',   placeholder: '01XXXXXXXXX' },
                { key: 'password',    label: 'Temporary Password *', type: 'password', placeholder: 'Min 8 characters' },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">{field.label}</label>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={(createForm as any)[field.key]}
                    onChange={(e) => setCreateForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    disabled={creating}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateForm(emptyCreate) }} disabled={creating}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create Guard'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
