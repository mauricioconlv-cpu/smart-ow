'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MedicalReportPrint } from '@/components/medical/MedicalReportPrint'

export default function AdminMedicalPrintPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [service, setService] = useState<any>(null)
  
  useEffect(() => {
    supabase.from('medical_services')
      .select(`
        *,
        doctor:medical_providers(full_name, cedula, specialty, phone)
      `)
      .eq('id', id)
      .single()
      .then(({ data }) => setService(data))
  }, [id, supabase])

  if (!service) return <div className="p-10 text-center font-sans">Cargando reporte...</div>

  return <MedicalReportPrint service={service} />
}
