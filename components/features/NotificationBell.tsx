'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, CheckCheck, X } from 'lucide-react'
import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils/guest-pass'
import type { Notification } from '@/types'

const TYPE_ICONS: Record<string, string> = {
  checkin:            '✅',
  checkout:           '👋',
  overstay:           '⚠️',
  ending_soon:        '⏰',
  revoked:            '🚫',
  delivery:           '📦',
  walk_in:            '🚪',
  event:              '🎉',
  emergency:          '🚨',
  extension_request:  '🔄',
  extension_approved: '✅',
  extension_rejected: '❌',
  penalty_created:    '💸',
  penalty_waived:     '✔️',
  system:             '🔔',
}

const TYPE_COLORS: Record<string, string> = {
  overstay:        'border-l-red-500',
  emergency:       'border-l-red-500',
  revoked:         'border-l-red-400',
  ending_soon:     'border-l-amber-400',
  penalty_created: 'border-l-amber-500',
  extension_request: 'border-l-blue-400',
}

interface NotificationBellProps {
  userId: string
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen]             = useState(false)
  const [notifications, setNotifs]  = useState<Notification[]>([])
  const [unreadCount, setUnread]    = useState(0)
  const [loading, setLoading]       = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Load data ────────────────────────────────────────────────────────────
  const loadNotifs = useCallback(async () => {
    setLoading(true)
    const [nRes, cRes] = await Promise.all([
      getNotifications({ limit: 30 }),
      getUnreadCount(),
    ])
    if (nRes.success) setNotifs(nRes.data)
    if (cRes.success) setUnread(cRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadNotifs() }, [loadNotifs])

  // ── Supabase Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifs((prev) => [newNotif, ...prev.slice(0, 29)])
          setUnread((n) => n + 1)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnread((c) => Math.max(0, c - 1))
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) loadNotifs() }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-1rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
              {loading && (
                <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
              )}
              {!loading && notifications.length === 0 && (
                <div className="py-8 text-center">
                  <Bell className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No notifications yet</p>
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                    TYPE_COLORS[n.type] ?? 'border-l-transparent'
                  } ${n.read_at ? 'bg-white' : 'bg-blue-50/40'}`}
                  onClick={() => !n.read_at && handleMarkRead(n.id)}
                >
                  <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${n.read_at ? 'text-slate-600' : 'text-slate-900'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
