/**
 * Compresses an image File to below maxSizeMB using Canvas.
 * Works in the browser only (client-side). Returns a new File.
 */
export async function compressImage(
  file: File,
  maxSizeMB = 2.5,
  maxDimension = 1280
): Promise<File> {
  const maxBytes = maxSizeMB * 1024 * 1024

  // Already small enough → return as-is
  if (file.size <= maxBytes) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img

      // Scale down proportionally
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Try progressively lower quality until we fit
      let quality = 0.85
      const tryExport = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('No se pudo comprimir la imagen.')); return }

            if (blob.size <= maxBytes || quality <= 0.3) {
              const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })
              URL.revokeObjectURL(url)
              resolve(compressed)
            } else {
              quality -= 0.1
              tryExport()
            }
          },
          'image/jpeg',
          quality
        )
      }

      tryExport()
    }

    img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    img.src = url
  })
}
