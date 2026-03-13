'use client'

import { Truck, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PanicButton from './components/PanicButton'
import PTTButton from './components/PTTButton'
import { useOperatorStore } from './store'
import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const { activeServiceId } = useOperatorStore()
  
  // Opcional: obtener y precargar al usuario en el cliente
  const [session, setSession] = useState<any>(null)
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* App Header (Mobile Like) */}
      <header className="bg-blue-600 text-white shadow-md p-4 flex justify-between items-center z-10">
        <div className="flex items-center space-x-2">
          <Truck className="h-6 w-6" />
          <span className="font-bold text-lg tracking-wide">Operador</span>
        </div>
        
        <div className="flex items-center space-x-3">
           <PTTButton activeServiceId={activeServiceId || undefined} />
           
           <button onClick={handleLogout} className="p-2 rounded-full hover:bg-black/10 transition-colors">
              <LogOut className="h-5 w-5" />
            </button>
        </div>
      </header>

      {/* Main Content Area (Scrollable) */}
      <main className="flex-1 overflow-y-auto w-full z-0 relative">
        {children}
      </main>
      
      <PanicButton activeServiceId={activeServiceId || undefined} />

    </div>
  )
}
