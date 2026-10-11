import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPassPublicInfo } from '@/app/actions/guest-passes'
import PublicPassClient from './PublicPassClient'

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const result = await getPassPublicInfo(token)
  const title = result.success
    ? `Guest Pass — ${result.data.guest_name}`
    : 'Guest Pass'
  return {
    title: `${title} | SecureEntry`,
    description: 'Show this QR code and gate code to the security guard at the entrance.',
    robots: 'noindex',   // pass pages must not be indexed
  }
}

export default async function PublicPassPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const result = await getPassPublicInfo(token)
  if (!result.success) notFound()

  return <PublicPassClient pass={result.data} token={token} />
}
