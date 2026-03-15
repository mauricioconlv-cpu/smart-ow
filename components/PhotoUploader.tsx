'use client'

import { useRef, useState } from 'react'
import { Camera, X, Upload } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'
import { createClient } from '@/lib/supabase/client'

interface PhotoUploaderProps {
  bucket: string        // e.g. 'tow-trucks' | 'avatars'
  folder?: string       // optional subfolder
  currentUrl?: string | null
  onUpload: (url: string) => void
  shape?: 'square' | 'circle'
  label?: string
  maxMB?: number
}

export default function PhotoUploader({
  bucket,
  folder = '',
  currentUrl,
  onUpload,
  shape = 'square',
  label = 'Foto de la unidad',
  maxMB = 2.5,
}: PhotoUploaderProps) {
  const [preview, setPreview]   = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('Solo se aceptan imágenes (JPG, PNG, WEBP).')
      return
    }

    setUploading(true)
    setStatus('Optimizando imagen...')

    try {
      const compressed = await compressImage(file, maxMB)
      const sizeMB = (compressed.size / 1024 / 1024).toFixed(2)
      setStatus(`Subiendo (${sizeMB} MB)...`)

      const supabase = createClient()
      const ext  = 'jpg'
      const path = folder
        ? `${folder}/${Date.now()}.${ext}`
        : `${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })

      if (upErr) { setStatus(`Error: ${upErr.message}`); setUploading(false); return }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

      setPreview(publicUrl)
      onUpload(publicUrl)
      setStatus(`✓ Listo (${sizeMB} MB)`)
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  const shapeClass = shape === 'circle'
    ? 'rounded-full'
    : 'rounded-xl'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className={`relative w-32 h-32 border-2 border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all ${shapeClass} flex items-center justify-center overflow-hidden`}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <>
            <img src={preview} alt="preview" className={`w-full h-full object-cover ${shapeClass}`} />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setPreview(null); onUpload('') }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            {uploading
              ? <Upload className="w-7 h-7 animate-bounce text-blue-400" />
              : <Camera className="w-7 h-7" />
            }
            <span className="text-xs text-center leading-tight px-1">
              {uploading ? 'Subiendo...' : 'Toca para subir'}
            </span>
          </div>
        )}
      </div>
      {status && (
        <p className={`text-xs ${status.startsWith('✓') ? 'text-green-600' : status.startsWith('Error') ? 'text-red-500' : 'text-slate-500'}`}>
          {status}
        </p>
      )}
      <p className="text-xs text-slate-400">Máx. {maxMB} MB · JPG, PNG, WEBP</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
