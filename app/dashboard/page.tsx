import { redirect } from 'next/navigation'

export default function DashboardPage() {
  // Por ahora redirigimos al módulo de clientes que vamos a construir
  redirect('/dashboard/clients')
}
