'use client'

import { useParams } from 'next/navigation'
import { UserProfile } from '@/components/dashboard/user-profile'

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  return <UserProfile userId={params.id} backHref="/dashboard/users" backLabel="Users" />
}
