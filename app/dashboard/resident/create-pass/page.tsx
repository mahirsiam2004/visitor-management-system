import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CreateGuestPassForm from '@/components/features/CreateGuestPassForm'
import PageHeader from '@/components/layout/PageHeader'

// Force dynamic so it always fetches fresh profile data
export const dynamic = 'force-dynamic'

export default async function CreatePassPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_number, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_number) {
    redirect('/dashboard/resident/profile?setup=true&return=/dashboard/resident/create-pass')
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="Create Guest Pass"
          description="Generate a QR code for your visitor to use at the security gate"
        />
      </div>
      <CreateGuestPassForm apartmentNumber={profile.apartment_number} />
    </div>
  )
}
