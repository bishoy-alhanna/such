import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  value: string       // data to encode — member UUID
  size?: number       // canvas size in px
  label?: string      // text shown below QR
}

export default function QRCodeDisplay({ value, size = 180, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#1f2937', light: '#ffffff' },
    }).catch(() => setError(true))
  }, [value, size])

  if (error) return <div style={{ color: '#ef4444', fontSize: 12 }}>تعذر توليد الرمز</div>

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 8, border: '1px solid #e5e7eb', display: 'block' }} />
      {label && <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', maxWidth: size }}>{label}</div>}
    </div>
  )
}
