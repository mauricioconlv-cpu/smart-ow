'use client'

import React, { useRef, useState, useEffect } from 'react'

interface SignaturePadProps {
  label: string
  onSave: (dataUrl: string) => void
  disabled?: boolean
  initialUrl?: string
}

export function SignaturePad({ label, onSave, disabled, initialUrl }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(!!initialUrl)
  
  // Use a fixed logical size to avoid CSS scaling distortion, but keep CSS width fluid
  const canvasWidth = 400
  const canvasHeight = 200

  useEffect(() => {
    if (initialUrl && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          ctx.drawImage(img, 0, 0)
        }
      }
      img.src = initialUrl
    }
  }, [initialUrl])

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    // CSS scale factor
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    
    let clientX, clientY
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (disabled) return
    setIsDrawing(true)
    const { x, y } = getCoordinates(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 3
      ctx.strokeStyle = '#0f172a' // slate-900
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || disabled) return
    const { x, y } = getCoordinates(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
      setHasSignature(true)
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleClear = () => {
    if (disabled) return
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      setHasSignature(false)
    }
  }

  const handleSave = () => {
    if (canvasRef.current && hasSignature) {
      onSave(canvasRef.current.toDataURL('image/png'))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
        {!disabled && hasSignature && (
          <button onClick={handleClear} className="text-xs text-red-500 hover:text-red-700">
            Limpiar
          </button>
        )}
      </div>
      <div className="border border-slate-300 rounded-xl overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full flex-shrink-0 cursor-crosshair bg-slate-50"
          style={{ height: '150px' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      {!disabled && hasSignature && (
        <button
          onClick={handleSave}
          className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold rounded-lg text-sm transition-colors"
        >
          Confirmar Firma
        </button>
      )}
    </div>
  )
}
