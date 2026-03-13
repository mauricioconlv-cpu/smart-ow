'use client'

import { Download } from 'lucide-react'
import { generateDescriptiveMemory } from '@/lib/utils/pdf'

export default function DownloadPDFButton({ service }: { service: any }) {
  return (
    <button
      onClick={() => generateDescriptiveMemory(service)}
      className="mt-2 w-full flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-bold py-3 px-4 rounded-xl transition-colors border border-green-200"
    >
      <Download className="h-5 w-5" />
      <span>Descargar Memoria (PDF)</span>
    </button>
  )
}
