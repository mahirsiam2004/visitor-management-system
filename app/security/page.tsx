'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Camera, Search, CheckCircle, XCircle, LogIn, LogOut,
  User, Home, Phone, Calendar, Clock, Timer, Loader2, CameraOff,
} from 'lucide-react';
import { tokenSearchSchema, TokenSearchInput } from '@/lib/validations';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate, formatDateTime, formatTime, formatDuration } from '@/lib/utils';

interface GuestPassResult {
  _id: string;
  guestName: string;
  guestPhone: string;
  purpose: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  guestId: string;
  qrToken: string;
  expiresAt: string;
  status: string;
  entryTime?: string;
  exitTime?: string;
  isValid: boolean;
  resident: { name: string; apartment: string; phone: string };
}

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [guestData, setGuestData] = useState<GuestPassResult | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<unknown>(null);
  const scannerRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<TokenSearchInput>({ resolver: zodResolver(tokenSearchSchema) });

  // ── Camera QR scanner init ───────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'camera') return;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;

    const initScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          false
        );

        scanner.render(
          (decodedText: string) => {
            // Extract token from URL format
            const token = decodedText.includes('/verify/')
              ? decodedText.split('/verify/').pop()!
              : decodedText;
            setValue('token', token);
            lookupToken(token);
            scanner?.stop().catch(() => {});
            setScannerActive(false);
          },
          () => {} // Error ignored
        );
        setScannerActive(true);
        setHtml5QrCode(scanner);
      } catch {
        // html5-qrcode not available
      }
    };

    if (scannerRef.current) initScanner();

    return () => {
      scanner?.stop().catch(() => {}).finally(() => scanner?.clear());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const lookupToken = async (token: string) => {
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(token)}`);
      const json = await res.json();
      if (json.success) {
        setGuestData(json.data);
      } else {
        toast.error(json.error ?? 'Invalid token');
        setGuestData(null);
      }
    } catch {
      toast.error('Network error');
    }
  };

  const onManualSearch = async (data: TokenSearchInput) => {
    await lookupToken(data.token);
  };

  const handleCheckIn = async () => {
    if (!guestData) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/security/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestData.qrToken }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Guest checked in successfully!');
        await lookupToken(guestData.qrToken);
      } else {
        toast.error(json.error ?? 'Check-in failed');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCheckOut = async () => {
    if (!guestData) return;
    setLoadingAction(true);
    try {
      const res = await fetch('/api/security/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestData.qrToken }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Guest checked out successfully!');
        await lookupToken(guestData.qrToken);
      } else {
        toast.error(json.error ?? 'Check-out failed');
      }
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">QR Scanner & Lookup</h2>
        <p className="text-gray-400 text-sm mt-1">Scan or search to verify and manage visitor access</p>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 p-1 bg-gray-900 rounded-xl border border-gray-800 w-fit">
        {[
          { id: 'camera' as const, label: 'Camera Scanner', icon: Camera },
          { id: 'manual' as const, label: 'Manual Lookup', icon: Search },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setGuestData(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Camera Scanner */}
      {activeTab === 'camera' && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">Point camera at QR code</h3>
          </div>
          <div
            ref={scannerRef}
            id="qr-reader"
            className="rounded-xl overflow-hidden bg-gray-900"
            style={{ minHeight: '300px' }}
          />
          {!scannerActive && (
            <div className="flex items-center gap-2 mt-3 text-gray-500 text-sm">
              <CameraOff className="w-4 h-4" />
              <span>Camera access required. Allow camera permissions in your browser.</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Search */}
      {activeTab === 'manual' && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Enter QR Token or Guest ID
          </h3>
          <form onSubmit={handleSubmit(onManualSearch)} className="flex gap-3">
            <input
              {...register('token')}
              placeholder="Paste token UUID here..."
              className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono text-sm"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold hover:from-green-500 hover:to-green-400 transition-all shadow-lg shadow-green-900/30"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
          {errors.token && <p className="text-red-400 text-xs mt-1">{errors.token.message}</p>}
        </div>
      )}

      {/* Guest Pass Result */}
      {guestData && (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
          {/* Status Banner */}
          <div className={`px-6 py-4 border-b border-gray-800/60 flex items-center justify-between ${
            guestData.status === 'inside' ? 'bg-green-600/10' :
            guestData.status === 'active' ? 'bg-blue-600/10' :
            guestData.status === 'expired' ? 'bg-red-600/10' : 'bg-gray-600/10'
          }`}>
            <div className="flex items-center gap-3">
              {guestData.isValid ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <h3 className="font-bold text-white text-lg">{guestData.guestName}</h3>
                <p className="text-gray-400 text-sm">{guestData.purpose}</p>
              </div>
            </div>
            <StatusBadge status={guestData.status} />
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Info Grid */}
            <div className="space-y-3">
              {[
                { icon: Phone, label: 'Guest Phone', value: guestData.guestPhone },
                { icon: User, label: 'Resident Name', value: guestData.resident?.name },
                { icon: Home, label: 'Apartment', value: guestData.resident?.apartment },
                { icon: Calendar, label: 'Visit Date', value: formatDate(guestData.visitDate) },
                { icon: Clock, label: 'Visit Time', value: formatTime(guestData.visitTime) },
                { icon: Timer, label: 'Duration', value: formatDuration(guestData.duration) },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/40">
                  <div className="w-8 h-8 rounded-lg bg-gray-700/60 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm font-medium text-white">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Timing + Actions */}
            <div className="space-y-4">
              {/* Expiry */}
              <div className={`p-4 rounded-xl border ${
                guestData.isValid
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <p className="text-xs text-gray-500 mb-1">Pass Expires</p>
                <p className="font-mono text-sm font-medium text-white">
                  {formatDateTime(guestData.expiresAt)}
                </p>
                <p className={`text-xs mt-1 font-semibold ${
                  guestData.isValid ? 'text-green-400' : 'text-red-400'
                }`}>
                  {guestData.isValid ? '✓ Valid — Entry Allowed' : '✗ Expired or Invalid'}
                </p>
              </div>

              {guestData.entryTime && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-gray-500 mb-1">Checked In</p>
                  <p className="text-sm font-medium text-white font-mono">{formatDateTime(guestData.entryTime)}</p>
                </div>
              )}

              {guestData.exitTime && (
                <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/20">
                  <p className="text-xs text-gray-500 mb-1">Checked Out</p>
                  <p className="text-sm font-medium text-white font-mono">{formatDateTime(guestData.exitTime)}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {guestData.status === 'active' && guestData.isValid && (
                  <button
                    onClick={handleCheckIn}
                    disabled={loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold hover:from-green-500 hover:to-green-400 transition-all shadow-lg shadow-green-900/30 disabled:opacity-60"
                  >
                    {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    Check In Guest
                  </button>
                )}

                {guestData.status === 'inside' && (
                  <button
                    onClick={handleCheckOut}
                    disabled={loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/30 disabled:opacity-60"
                  >
                    {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Check Out Guest
                  </button>
                )}

                {guestData.status === 'expired' && (
                  <div className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-center text-sm">
                    ✗ Pass Expired — Entry Not Allowed
                  </div>
                )}

                {guestData.status === 'completed' && (
                  <div className="w-full py-3 rounded-xl bg-gray-500/10 border border-gray-500/20 text-gray-400 font-semibold text-center text-sm">
                    ✓ Visit Completed
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
