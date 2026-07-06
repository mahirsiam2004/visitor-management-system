import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VerifyTokenClient from './VerifyTokenClient'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: 'Verify Guest Pass - SecureEntry',
  }
}

export default async function VerifyPage({ params }: PageProps) {
  const { token } = await params

  if (!token) notFound()

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('verify_guest_token', { p_token: token })

  return (
    <VerifyTokenClient
      token={token}
      initialResult={error ? null : data}
    />
  )
}
