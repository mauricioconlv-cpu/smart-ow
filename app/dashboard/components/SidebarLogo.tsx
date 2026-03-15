'use client'

import { Truck } from 'lucide-react'

interface Company {
  name: string
  logo_url: string | null
}

export default function SidebarLogo({ company }: { company: Company | null }) {
  return (
    <div className="px-4 py-5 flex items-center gap-3 relative z-10">
      {/* Logo / Icono */}
      <div className="logo-wrapper-3d flex-shrink-0">
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name || 'Logo'}
            className="logo-3d w-10 h-10 object-contain rounded-lg"
          />
        ) : (
          <div className="logo-3d w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Truck className="w-5 h-5 text-white drop-shadow-sm" />
          </div>
        )}
      </div>

      {/* Nombre empresa */}
      <div className="min-w-0 flex-1">
        <span className="gradient-text text-lg font-bold leading-tight block truncate">
          {company?.name || 'Smart Tow'}
        </span>
        <span className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
          Dashboard
        </span>
      </div>
    </div>
  )
}
