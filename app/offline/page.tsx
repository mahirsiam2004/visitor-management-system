'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
      <WifiOff className="h-20 w-20 text-slate-400 mb-6" />
      <h1 className="text-2xl font-bold text-white mb-2">অফলাইন</h1>
      <p className="text-slate-400 mb-2">No internet connection.</p>
      <p className="text-slate-300 font-medium mb-6">
        ইন্টারনেট নেই। QR যাচাই করা যাচ্ছে না।
      </p>
      <div className="rounded-xl bg-amber-500/20 border border-amber-400/40 p-5 text-left max-w-sm w-full">
        <p className="text-amber-200 font-semibold mb-2">📞 ম্যানুয়াল পদ্ধতি</p>
        <p className="text-amber-100 text-sm">
          If the pass is not in the offline cache, call the resident directly to verify the visitor.
          Write the entry manually in the offline log book and mark it as <strong>unverified</strong>.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-xl bg-blue-600 text-white px-6 py-3 font-semibold text-base hover:bg-blue-700"
      >
        Try Again
      </button>
    </div>
  )
}
