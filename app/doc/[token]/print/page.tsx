'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MedicalReportPrint } from '@/components/medical/MedicalReportPrint'

export default function DoctorPrintPage() {
  const { token } = useParams<{ token: string }>()
  const supabase = createClient()
  const [service, setService] = useState<any>(null)
  
  useEffect(() => {
    // Para simplificar, obtenemos los datos usando el token si la ruta es pública,
    // o usando la sesión. En este caso enviaremos fetch a la DB si tenemos RLS,
    // pero el doctor no tiene sesión! 
    // Por lo que necesitamos un endpoint público para obtener el reporte o usar el secret en el backend.
    
    // Mejor solución: Hacemos fetch a una API o pasamos los datos vía localStorage
    // Ya que el doctor acaba de llenar el formulario, podemos leerlo de la API /api/medical/verify-pin
    // El doctor todavía tiene el PIN en local storage.
    const cachedPin = localStorage.getItem(`smart_tow_doc_${token}`)
    if (cachedPin) {
      fetch('/api/medical/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: cachedPin })
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) setService(data.service)
      })
    } else {
      // Intentamos fetch director, aunque RLS fallará sin PIN.
      // O mostramos error.
      alert('Debes iniciar sesión con tu PIN primero.')
    }
  }, [token])

  if (!service) return <div className="p-10 text-center font-sans tracking-tight">Cargando reporte...</div>

  return <MedicalReportPrint service={service} />
}
