'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { generateDescriptiveMemory } from '@/lib/utils/pdf'

export default function DownloadPDFButton({
  service,
  companyLogoUrl,
  companyName,
}: {
  service: any
  companyLogoUrl?: string | null
  companyName?: string | null
}) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      await generateDescriptiveMemory(service, companyLogoUrl, companyName)
    } catch (e) {
      console.error('[PDF] Error generando PDF:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="mt-2 w-full flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-3 px-4 rounded-xl transition-colors border border-green-200 disabled:opacity-50"
    >
      {loading
        ? <><Loader2 className="h-5 w-5 animate-spin" /> Generando PDF...</>
        : <><Download className="h-5 w-5" /> Descargar Memoria Descriptiva (PDF)</>
      }
    </button>
  )
}
