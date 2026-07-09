'use client'

import { useParams } from 'next/navigation'
import { UserProfile } from '@/components/dashboard/user-profile'

export default function TeamMemberPage() {
  const params = useParams<{ id: string }>()
  return <UserProfile userId={params.id} backHref="/dashboard/team" backLabel="My Team" />
}
