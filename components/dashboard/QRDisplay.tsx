'use client';

import { useRef } from 'react';
import QRCode from 'react-qr-code';
import { Download, Share2, Clock, User, Home, Phone, Calendar, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { IGuestPass, IUser } from '@/types';
import { formatDate, formatDateTime, formatTime, formatDuration } from '@/lib/utils';
import StatusBadge from '@/components/shared/StatusBadge';

interface QRDisplayProps {
  pass: IGuestPass;
  baseUrl: string;
}

export default function QRDisplay({ pass, baseUrl }: QRDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const resident = pass.residentId as IUser;
  const qrValue = `${baseUrl}/verify/${pass.qrToken}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(0, 0, 300, 300);
      ctx!.drawImage(img, 0, 0, 300, 300);
      const link = document.createElement('a');
      link.download = `guest-pass-${pass.guestName.replace(/\s/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
    toast.success('QR code downloaded!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Guest Pass for ${pass.guestName}`,
          text: `Visitor pass for ${pass.guestName} on ${formatDate(pass.visitDate)}`,
          url: qrValue,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(qrValue);
      toast.success('Verification link copied to clipboard!');
    }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-green-600/20 border-b border-gray-800/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg">Guest Pass Generated</h3>
            <p className="text-gray-400 text-sm">Share or scan this QR code at entry</p>
          </div>
          <StatusBadge status={pass.status} />
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-4">
          <div
            ref={qrRef}
            className="p-4 bg-white rounded-2xl shadow-2xl shadow-black/50 glow-blue"
          >
            <QRCode
              value={qrValue}
              size={220}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              viewBox="0 0 256 256"
              fgColor="#0f172a"
            />
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Guest ID</p>
            <p className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg break-all">
              {pass.guestId}
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 text-sm font-medium hover:bg-blue-600/30 transition-all"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600/20 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-600/30 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Guest Details */}
        <div className="space-y-4">
          <h4 className="font-semibold text-white border-b border-gray-800/60 pb-2">
            Guest Information
          </h4>

          {[
            { icon: User, label: 'Guest Name', value: pass.guestName },
            { icon: Phone, label: 'Phone', value: pass.guestPhone },
            { icon: Home, label: 'Visiting Apartment', value: resident?.apartment ?? 'N/A' },
            { icon: User, label: 'Resident', value: resident?.name ?? 'N/A' },
            { icon: Calendar, label: 'Visit Date', value: `${formatDate(pass.visitDate)} at ${formatTime(pass.visitTime)}` },
            { icon: Timer, label: 'Duration', value: formatDuration(pass.duration) },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-800/60 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-medium text-white">{item.value}</p>
              </div>
            </div>
          ))}

          {/* Expiry */}
          <div className="mt-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">Pass Expires</span>
            </div>
            <p className="text-white font-mono text-sm">{formatDateTime(pass.expiresAt)}</p>
            <p className="text-gray-500 text-xs mt-1">
              After this time, the QR code will be invalid
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
