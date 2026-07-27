import type { Metadata } from 'next'
import ServicesContent from './ServicesContent'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Explore SecureEntry’s visitor management services: QR guest passes, guard verification, admin analytics, role management, and notifications.',
}

export default function ServicesPage() {
  return <ServicesContent />
}
