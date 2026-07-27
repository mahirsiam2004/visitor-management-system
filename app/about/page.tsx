import type { Metadata } from 'next'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about SecureEntry — our mission, how the visitor management system works, and the technology that keeps residential communities secure.',
}

export default function AboutPage() {
  return <AboutContent />
}
