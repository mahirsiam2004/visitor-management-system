'use client'

import { useState, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { User, Lock, Save, ArrowRight, AlertCircle } from 'lucide-react'
import { updateProfile, changePassword, getProfile } from '@/app/actions/auth'
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from '@/lib/validations/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/layout/PageHeader'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

function ProfilePageInner() {
  const searchParams = useSearchParams()
  const isSetup = searchParams.get('setup') === 'true'
  const returnTo = searchParams.get('return') || '/dashboard/resident'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
  })

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  useEffect(() => {
    const load = async () => {
      const result = await getProfile()
      if (result.success) {
        setProfile(result.data)
        profileForm.reset({
          fullName: result.data.full_name,
          phoneNumber: result.data.phone_number || '',
          apartmentNumber: result.data.apartment_number || '',
        })
      }
      setLoadingProfile(false)
    }
    load()
  }, [])

  const onSaveProfile = async (data: UpdateProfileInput) => {
    setSavingProfile(true)
    try {
      const result = await updateProfile(data)
      if (result.success) {
        setProfile(result.data)
        toast.success('Profile updated successfully')
        // If we came from setup flow, redirect back to the originating page
        if (isSetup && data.apartmentNumber) {
          window.location.replace(returnTo)
        }
      } else {
        toast.error(result.error)
      }
    } finally {
      setSavingProfile(false)
    }
  }

  const onChangePassword = async (data: ChangePasswordInput) => {
    setSavingPassword(true)
    try {
      const result = await changePassword(data)
      if (result.success) {
        toast.success('Password changed successfully')
        passwordForm.reset()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title={isSetup ? 'Complete Your Profile' : 'Profile'}
        description={
          isSetup
            ? 'Set your apartment number to start creating guest passes'
            : 'Manage your account information'
        }
      />

      {/* Setup notice */}
      {isSetup && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Apartment number required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Please set your apartment number before creating a guest pass.
            </p>
          </div>
        </div>
      )}

      {/* Avatar card */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          {loadingProfile ? (
            <>
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                {profile ? getInitials(profile.full_name) : '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{profile?.full_name}</p>
                <p className="text-sm text-slate-500">{profile?.email}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Resident · Apt {profile?.apartment_number || 'Not set'}
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Profile form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">Personal Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProfile ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <Input
                    disabled={savingProfile}
                    aria-invalid={!!profileForm.formState.errors.fullName}
                    {...profileForm.register('fullName')}
                  />
                  {profileForm.formState.errors.fullName && (
                    <p className="text-xs text-red-600">{profileForm.formState.errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                  <Input
                    type="tel"
                    disabled={savingProfile}
                    {...profileForm.register('phoneNumber')}
                  />
                  {profileForm.formState.errors.phoneNumber && (
                    <p className="text-xs text-red-600">{profileForm.formState.errors.phoneNumber.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Apartment Number {isSetup && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    placeholder="e.g. A-101"
                    disabled={savingProfile}
                    aria-invalid={!!profileForm.formState.errors.apartmentNumber}
                    {...profileForm.register('apartmentNumber')}
                  />
                  {profileForm.formState.errors.apartmentNumber && (
                    <p className="text-xs text-red-600">{profileForm.formState.errors.apartmentNumber.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Email Address</label>
                  <Input value={profile?.email || ''} disabled className="bg-slate-50 text-slate-500" />
                  <p className="text-xs text-slate-400">Email cannot be changed</p>
                </div>
              </div>

              <Button type="submit" disabled={savingProfile} className="mt-5 gap-2">
                <Save className="h-4 w-4" />
                {savingProfile
                  ? 'Saving...'
                  : isSetup
                  ? 'Save and Continue'
                  : 'Save Changes'}
                {isSetup && !savingProfile && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Only show password section when not in setup mode */}
      {!isSetup && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-base">Change Password</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} noValidate>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Current Password</label>
                  <Input
                    type="password"
                    disabled={savingPassword}
                    aria-invalid={!!passwordForm.formState.errors.currentPassword}
                    {...passwordForm.register('currentPassword')}
                  />
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-xs text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">New Password</label>
                    <Input
                      type="password"
                      disabled={savingPassword}
                      aria-invalid={!!passwordForm.formState.errors.newPassword}
                      {...passwordForm.register('newPassword')}
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-xs text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
                    <Input
                      type="password"
                      disabled={savingPassword}
                      aria-invalid={!!passwordForm.formState.errors.confirmNewPassword}
                      {...passwordForm.register('confirmNewPassword')}
                    />
                    {passwordForm.formState.errors.confirmNewPassword && (
                      <p className="text-xs text-red-600">{passwordForm.formState.errors.confirmNewPassword.message}</p>
                    )}
                  </div>
                </div>

                <Button type="submit" disabled={savingPassword} variant="outline" className="gap-2">
                  <Lock className="h-4 w-4" />
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  )
}
