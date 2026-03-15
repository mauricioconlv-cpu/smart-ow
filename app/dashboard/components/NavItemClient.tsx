'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItemClientProps {
  href: string
  label: string
  live?: boolean
  children: React.ReactNode
}

export default function NavItemClient({ href, label, live, children }: NavItemClientProps) {
  const pathname = usePathname()
  // Mark active: exact match for /dashboard, prefix match for sub-pages
  const isActive = href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`nav-item group ${isActive ? 'active' : ''}`}
    >
      {children}
      <span className="flex-1">{label}</span>
      {live && (
        <span className="live-dot ml-auto" />
      )}
    </Link>
  )
}
