import React, { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'

interface Props {
  onScan: (value: string) => void   // called once per distinct scan
  onClose: () => void
}

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function QRScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef    = useRef<number>(0)
  const lastScan  = useRef<string>('')

  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [flash, setFlash] = useState(false)

  const tick = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    const ctx = canvas.getContext('2d')!
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code      = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })

    if (code && code.data && code.data !== lastScan.current) {
      const raw = code.data.trim()
      // Accept plain UUID or URL containing a UUID query param
      let found = ''
      if (UUID_RE.test(raw)) {
        found = raw
      } else {
        try {
          const url   = new URL(raw)
          const param = url.searchParams.get('member') || url.searchParams.get('id') || url.searchParams.get('memberId')
          if (param && UUID_RE.test(param)) found = param
        } catch {}
      }
      if (found) {
        lastScan.current = found
        setFlash(true)
        setTimeout(() => setFlash(false), 400)
        onScan(found)
        // Allow re-scanning after 2 s
        setTimeout(() => { lastScan.current = '' }, 2000)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [onScan])

  useEffect(() => {
    let active = true
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().then(() => { setScanning(true); rafRef.current = requestAnimationFrame(tick) })
      }
    }).catch(e => {
      setError('لا يمكن الوصول للكاميرا: ' + (e?.message ?? e))
    })

    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [tick])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: -44, right: 8, zIndex: 10,
          background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8,
          color: '#fff', fontSize: 15, padding: '6px 14px', cursor: 'pointer', fontWeight: 600,
        }}>✕ إغلاق</button>

        {/* Title */}
        <div style={{ textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
          📷 وجّه الكاميرا نحو رمز QR
        </div>

        {error ? (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '16px 20px', borderRadius: 12, textAlign: 'center', fontSize: 14 }}>
            {error}
          </div>
        ) : (
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Scan frame overlay */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                width: 200, height: 200,
                border: `3px solid ${flash ? '#22c55e' : '#6366f1'}`,
                borderRadius: 16,
                boxShadow: flash ? '0 0 0 4px rgba(34,197,94,.4)' : 'none',
                transition: 'border-color .15s, box-shadow .15s',
              }}>
                {/* Corner marks */}
                {[
                  { top: -2, left:  -2, borderTop:  '3px solid', borderLeft:  '3px solid' },
                  { top: -2, right: -2, borderTop:  '3px solid', borderRight: '3px solid' },
                  { bottom: -2, left:  -2, borderBottom: '3px solid', borderLeft:  '3px solid' },
                  { bottom: -2, right: -2, borderBottom: '3px solid', borderRight: '3px solid' },
                ].map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 20, height: 20, borderColor: flash ? '#22c55e' : '#6366f1', ...s }} />
                ))}
              </div>
            </div>

            {/* Status badge */}
            {scanning && (
              <div style={{
                position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 12,
                padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap',
              }}>
                {flash ? '✅ تم المسح' : '🔍 جارٍ المسح…'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
