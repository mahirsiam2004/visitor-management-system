'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { User, Mail, Phone, Home, Shield, Loader2, Save } from 'lucide-react';
import { profileSchema, ProfileInput } from '@/lib/validations';
import { IUser } from '@/types';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setUser(json.data);
          reset({
            name: json.data.name,
            phone: json.data.phone,
            apartment: json.data.apartment,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: ProfileInput) => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? 'Failed to update profile');
        return;
      }
      setUser(json.data);
      toast.success('Profile updated successfully');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">My Profile</h2>
        <p className="text-gray-400 text-sm mt-1">View and update your account information</p>
      </div>

      {/* Avatar Card */}
      <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center flex-shrink-0 shadow-xl shadow-blue-900/30">
          <span className="text-white text-3xl font-extrabold">
            {user?.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{user?.name}</h3>
          <p className="text-gray-400">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 capitalize">
              <Shield className="w-3 h-3" />
              {user?.role}
            </span>
            {user?.apartment && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                <Home className="w-3 h-3" />
                Apt {user.apartment}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Account Info (read-only) */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white border-b border-gray-800/60 pb-3">Account Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Email', value: user?.email, icon: Mail },
            { label: 'Role', value: user?.role, icon: Shield },
            { label: 'Member Since', value: user?.createdAt ? formatDate(user.createdAt) : 'N/A', icon: User },
            { label: 'Apartment', value: user?.apartment ?? 'N/A', icon: Home },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/40">
              <div className="w-8 h-8 rounded-lg bg-gray-700/60 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-medium text-white capitalize">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Form */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-semibold text-white border-b border-gray-800/60 pb-3 mb-5">
          Edit Profile
        </h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />Full Name
            </label>
            <input {...register('name')} className={inputClass} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Phone className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />Phone Number
            </label>
            <input {...register('phone')} className={inputClass} />
            {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              <Home className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />Apartment / Unit
            </label>
            <input {...register('apartment')} className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
