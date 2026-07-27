import type { Metadata } from 'next'
import ContactContent from './ContactContent'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the SecureEntry team — questions, demos, and onboarding for your residential community.',
}

export default function ContactPage() {
  return <ContactContent />
}
