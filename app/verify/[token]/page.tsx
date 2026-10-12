import { notFound } from 'next/navigation'
import VerifyTokenClient from './VerifyTokenClient'
import type { Metadata } from 'next'
import { verifyGuestToken } from '@/app/actions/guest-passes'

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

  const result = await verifyGuestToken(token)

  return (
    <VerifyTokenClient
      token={token}
      initialResult={result.success ? result.data : null}
    />
  )
}
