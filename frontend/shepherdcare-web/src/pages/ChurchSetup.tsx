import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import api from '../services/api'
import { applyChurchSlug } from '../auth'

const BASE_DOMAIN = 'sgch.al-hanna.com'

function extractSlug(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const host = url.hostname // e.g. "stmark.sgch.al-hanna.com" or "sgch.al-hanna.com"
    if (host.endsWith(`.${BASE_DOMAIN}`)) {
      return host.replace(`.${BASE_DOMAIN}`, '') // "stmark"
    }
    // full custom domain — use hostname as slug
    return host
  } catch {
    // bare slug like "stmark" (no dots, no protocol)
    return trimmed
  }
}

interface Props { onSetup: () => void }

export default function ChurchSetup({ onSetup }: Props) {
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [scanning, setScanning] = useState(false)

  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number>(0)

  // ── QR scanner ────────────────────────────────────────────────────
  const startScan = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
    } catch {
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }

  const stopScan = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  useEffect(() => {
    if (!scanning || !videoRef.current || !streamRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current!
    video.srcObject = streamRef.current
    video.play()

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(img.data, img.width, img.height)
        if (code?.data) {
          stopScan()
          handleContinue(code.data)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafRef.current) }
  }, [scanning])

  // ── Validate & save ───────────────────────────────────────────────
  const handleContinue = async (raw?: string) => {
    const value = (raw ?? input).trim()
    if (!value) { setError('Please enter your church URL or slug.'); return }
    setLoading(true)
    setError('')
    try {
      const slug = extractSlug(value)
      // Verify the church exists and is active
      const res = await api.get(`/churches/slug/${slug}`)
      if (res.status !== 200) throw new Error()
      applyChurchSlug(slug)
      localStorage.setItem('churchSlug', slug)
      onSetup()
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404) {
        setError('Church not found. Please check the URL or QR code and try again.')
      } else {
        setError('Could not connect to the church server. Check your URL and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d1a4e', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 36, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, color: '#6366f1', marginBottom: 8 }}>✝</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>ShepherdCare</h1>
          <p style={{ color: '#6366f1', margin: '4px 0 0', fontSize: 14 }}>رعاية</p>
        </div>

        <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          Enter your church URL or scan the church QR code to get started.
        </p>

        {/* URL input */}
        {!scanning && (
          <>
            <label style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>
              Church URL or code
            </label>
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              placeholder="e.g. stmark   or   stmark.sgch.al-hanna.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 14px',
                fontSize: 14, color: '#111827', outline: 'none',
                fontFamily: 'inherit', marginBottom: 12,
              }}
              onKeyDown={e => e.key === 'Enter' && handleContinue()}
              autoFocus
            />

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={() => handleContinue()}
              disabled={loading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                background: loading ? '#a5b4fc' : '#6366f1', color: '#fff',
                fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: 12,
              }}
            >
              {loading ? 'Connecting…' : 'Continue'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ color: '#94a3b8', fontSize: 13 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            {/* QR scan button */}
            <button
              onClick={startScan}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10,
                border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              📷 Scan QR Code
            </button>
          </>
        )}

        {/* QR scanner viewfinder */}
        {scanning && (
          <div style={{ position: 'relative' }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 12, display: 'block' }} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Overlay frame */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 200, height: 200, border: '3px solid #6366f1', borderRadius: 16,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              }} />
            </div>

            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, margin: '12px 0 8px' }}>
              Point camera at the church QR code
            </p>
            <button
              onClick={stopScan}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10,
                border: '1.5px solid #e2e8f0', background: '#f8fafc',
                color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
