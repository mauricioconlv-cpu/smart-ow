'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, CheckCircle2, Building2, Sparkles } from 'lucide-react'

interface SettingsFormProps {
  companyId: string
  companyName: string
  currentLogoUrl: string | null
  isSuperAdmin: boolean
}

export default function SettingsForm({
  companyId,
  companyName,
  currentLogoUrl,
  isSuperAdmin,
}: SettingsFormProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [logoPreview, setLogoPreview] = useState<string | null>(currentLogoUrl)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo no puede superar los 5 MB.')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setSuccess(false)
    setError('')
  }

  async function handleSaveLogo() {
    if (!logoFile) return
    setIsSaving(true)
    setError('')
    setSuccess(false)

    try {
      // 1. Subir imagen al bucket de Storage
      const ext  = logoFile.name.split('.').pop()
      const path = `${companyId}/logo.${ext}`

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type })

      if (uploadErr) {
        // Si el bucket no existe aún, avisar con mensaje claro
        throw new Error(
          uploadErr.message.includes('Bucket not found')
            ? 'El bucket de logos no existe. Ejecuta add_company_logo.sql en Supabase primero.'
            : 'Error al subir imagen: ' + uploadErr.message
        )
      }

      // 2. Obtener URL pública con cache-bust
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`

      // 3. Guardar en companies via API route (service role, sin RLS)
      const res = await fetch('/api/company/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, logo_url: publicUrl }),
      })

      const result = await res.json()
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Error al actualizar en la base de datos.')
      }

      setLogoPreview(publicUrl)
      setLogoFile(null)
      setSuccess(true)

      // 4. Recargar la página automáticamente tras 1.5s para mostrar el logo en sidebar
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (err: any) {
      setError(err.message || 'Error inesperado.')
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <div className="space-y-6">

      {/* ── Identidad de Empresa ── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Identidad de la Empresa</h3>
            <p className="text-xs text-slate-400">{companyName}</p>
          </div>
        </div>

        {/* Logo Uploader */}
        <div className="flex items-start gap-6">
          {/* Preview */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`
              logo-wrapper-3d flex-shrink-0 cursor-pointer group
              w-28 h-28 rounded-2xl border-2 border-dashed
              ${logoPreview && !logoFile ? 'border-transparent' : 'border-slate-600 hover:border-blue-500/60'}
              bg-white/5 flex items-center justify-center overflow-hidden
              transition-all duration-300
            `}
          >
            {logoPreview ? (
              <div className="relative w-full h-full">
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="logo-3d w-full h-full object-contain p-2"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                  <Upload className="w-6 h-6 text-white" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <Upload className="w-7 h-7 text-slate-500 group-hover:text-blue-400 transition-colors" />
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                  Sube tu logo
                </span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Info + Actions */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Logo de la empresa</p>
              <p className="text-xs text-slate-500 mt-1">
                PNG, JPG, WEBP o SVG. Máximo 5 MB.<br />
                Se mostrará en la esquina superior izquierda del dashboard con efecto 3D.
              </p>
            </div>

            {logoFile && (
              <div className="text-xs text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Nuevo archivo: <span className="font-mono">{logoFile.name}</span>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                ✅ Logo guardado. Recargando automáticamente...
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary btn-ghost text-sm px-4 py-2"
              >
                <Upload className="w-3.5 h-3.5" />
                Elegir archivo
              </button>

              {logoFile && (
                <button
                  type="button"
                  onClick={handleSaveLogo}
                  disabled={isSaving}
                  className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Guardar Logo</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Efecto 3D del Logo</h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          El logo se renderiza con sombras multicapa y efectos de profundidad CSS para dar
          una sensación tridimensional. Al pasar el cursor sobre él en la sidebar aparece
          un glow animado azul/violeta y se eleva levemente.
        </p>
      </div>
    </div>
  )
}
