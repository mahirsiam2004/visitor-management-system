'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createGuestPassSchema, CreateGuestPassInput } from '@/lib/validations/schemas'
import { createGuestPass } from '@/app/actions/guest-passes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { X } from 'lucide-react'

interface CreateGuestPassFormProps {
  onSuccess: () => void
}

export default function CreateGuestPassForm({ onSuccess }: CreateGuestPassFormProps) {
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateGuestPassInput>({
    resolver: zodResolver(createGuestPassSchema),
  })

  const onSubmit = async (data: CreateGuestPassInput) => {
    setLoading(true)
    try {
      const result = await createGuestPass(data)
      if (result.success) {
        reset()
        onSuccess()
      } else {
        toast.error(result.error || 'Failed to create guest pass')
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-lg border border-slate-200 p-6 mb-8 space-y-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Create Guest Pass</h2>
        <button type="button" className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guest Name */}
        <div>
          <label htmlFor="guestName" className="block text-sm font-medium text-slate-700 mb-1">
            Guest Name
          </label>
          <Input
            id="guestName"
            placeholder="John Smith"
            disabled={loading}
            {...register('guestName')}
            className="w-full"
          />
          {errors.guestName && <span className="text-red-500 text-sm">{errors.guestName.message}</span>}
        </div>

        {/* Guest Phone */}
        <div>
          <label htmlFor="guestPhone" className="block text-sm font-medium text-slate-700 mb-1">
            Phone (Optional)
          </label>
          <Input
            id="guestPhone"
            placeholder="+1 (555) 000-0000"
            disabled={loading}
            {...register('guestPhone')}
            className="w-full"
          />
        </div>

        {/* Visit Date */}
        <div>
          <label htmlFor="visitDate" className="block text-sm font-medium text-slate-700 mb-1">
            Visit Date
          </label>
          <Input
            id="visitDate"
            type="date"
            disabled={loading}
            {...register('visitDate')}
            className="w-full"
          />
          {errors.visitDate && <span className="text-red-500 text-sm">{errors.visitDate.message}</span>}
        </div>

        {/* Visit Time */}
        <div>
          <label htmlFor="visitTime" className="block text-sm font-medium text-slate-700 mb-1">
            Visit Time
          </label>
          <Input
            id="visitTime"
            type="time"
            disabled={loading}
            {...register('visitTime')}
            className="w-full"
          />
          {errors.visitTime && <span className="text-red-500 text-sm">{errors.visitTime.message}</span>}
        </div>

        {/* Duration */}
        <div>
          <label htmlFor="durationHours" className="block text-sm font-medium text-slate-700 mb-1">
            Duration (Hours)
          </label>
          <Input
            id="durationHours"
            type="number"
            min="1"
            max="24"
            placeholder="2"
            disabled={loading}
            {...register('durationHours', { valueAsNumber: true })}
            className="w-full"
          />
          {errors.durationHours && <span className="text-red-500 text-sm">{errors.durationHours.message}</span>}
        </div>

        {/* Purpose */}
        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-slate-700 mb-1">
            Purpose of Visit
          </label>
          <Input
            id="purpose"
            placeholder="Delivery, Repair, Meeting, etc."
            disabled={loading}
            {...register('purpose')}
            className="w-full"
          />
          {errors.purpose && <span className="text-red-500 text-sm">{errors.purpose.message}</span>}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? 'Creating...' : 'Create Guest Pass'}
        </Button>
      </div>
    </form>
  )
}
