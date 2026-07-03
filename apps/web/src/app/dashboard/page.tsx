'use client'

import { useAuth } from '@/components/auth-provider'
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'
import { EmployeeDashboard } from '@/components/dashboard/employee-dashboard'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'

export default function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === 'admin') return <AdminDashboard />
  if (user.role === 'manager') return <ManagerDashboard />
  return <EmployeeDashboard />
}
