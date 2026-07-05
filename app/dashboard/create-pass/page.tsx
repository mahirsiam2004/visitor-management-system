'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  User, Phone, Calendar, Clock, Timer, FileText, Loader2, QrCode,
} from 'lucide-react';
import { guestPassSchema, GuestPassInput } from '@/lib/validations';
import { IGuestPass } from '@/types';
import QRDisplay from '@/components/dashboard/QRDisplay';

const DURATION_OPTIONS = [
  { label: '1 Hour', value: 1 },
  { label: '2 Hours', value: 2 },
  { label: '4 Hours', value: 4 },
  { label: '8 Hours', value: 8 },
  { label: '12 Hours', value: 12 },
  { label: '24 Hours', value: 24 },
];

export default function CreatePassPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPass, setGeneratedPass] = useState<IGuestPass | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GuestPassInput>({
    resolver: zodResolver(guestPassSchema),
    defaultValues: {
      duration: 2,
      visitDate: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data: GuestPassInput) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? 'Failed to create guest pass');
        return;
      }

      setGeneratedPass(json.data);
      toast.success('Guest pass created! QR code is ready below.');
      reset();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Create Guest Pass</h2>
        <p className="text-gray-400 text-sm mt-1">
          Fill in the details to generate a QR-based visitor pass
        </p>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800/60">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Guest Details</h3>
            <p className="text-xs text-gray-500">Your apartment number will be auto-filled</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Guest Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <User className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                Guest Name
              </label>
              <input
                {...register('guestName')}
                type="text"
                placeholder="John Smith"
                className={inputClass}
              />
              {errors.guestName && (
                <p className="text-red-400 text-xs mt-1">{errors.guestName.message}</p>
              )}
            </div>

            {/* Guest Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Phone className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                Guest Phone Number
              </label>
              <input
                {...register('guestPhone')}
                type="tel"
                placeholder="+1 234 567 8900"
                className={inputClass}
              />
              {errors.guestPhone && (
                <p className="text-red-400 text-xs mt-1">{errors.guestPhone.message}</p>
              )}
            </div>

            {/* Visit Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                Visit Date
              </label>
              <input
                {...register('visitDate')}
                type="date"
                className={`${inputClass} [color-scheme:dark]`}
              />
              {errors.visitDate && (
                <p className="text-red-400 text-xs mt-1">{errors.visitDate.message}</p>
              )}
            </div>

            {/* Visit Time */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                Visit Time
              </label>
              <input
                {...register('visitTime')}
                type="time"
                className={`${inputClass} [color-scheme:dark]`}
              />
              {errors.visitTime && (
                <p className="text-red-400 text-xs mt-1">{errors.visitTime.message}</p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Timer className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                Duration
              </label>
              <select {...register('duration', { valueAsNumber: true })} className={inputClass}>
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.duration && (
                <p className="text-red-400 text-xs mt-1">{errors.duration.message}</p>
              )}
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <FileText className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                Purpose of Visit
              </label>
              <input
                {...register('purpose')}
                type="text"
                placeholder="e.g. Family visit, Delivery, etc."
                className={inputClass}
              />
              {errors.purpose && (
                <p className="text-red-400 text-xs mt-1">{errors.purpose.message}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 md:flex-none md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
              ) : (
                <><QrCode className="w-4 h-4" />Generate QR Pass</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated QR */}
      {generatedPass && (
        <QRDisplay pass={generatedPass} baseUrl={baseUrl} />
      )}
    </div>
  );
}
