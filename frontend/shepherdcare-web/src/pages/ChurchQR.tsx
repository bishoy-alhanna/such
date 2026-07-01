import React, { useEffect, useRef, useState } from 'react'
// @ts-ignore – qrcode has no bundled types; installed as a production dependency
import QRCode from 'qrcode'
import Header from '../components/Header'
import api from '../services/api'

const BASE_DOMAIN = 'sgch.al-hanna.com'

export default function ChurchQRPage() {
  const slug      = localStorage.getItem('churchSlug') ?? ''
  const churchUrl = `https://${slug}.${BASE_DOMAIN}`

  const canvasRef                     = useRef<HTMLCanvasElement>(null)
  const [churchName, setChurchName]   = useState('')
  const [copied, setCopied]           = useState(false)

  useEffect(() => {
    api.get<{ churchName: string }>('/subscription')
      .then(r => setChurchName(r.data.churchName))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !slug) return
    QRCode.toCanvas(canvas, churchUrl, {
      width:  280,
      margin: 2,
      color:  { dark: '#1e293b', light: '#ffffff' },
    })
  }, [slug, churchUrl])

  const downloadPNG = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `${slug}-qr.png`
    a.href     = canvas.toDataURL('image/png')
    a.click()
  }

  const copyURL = () => {
    navigator.clipboard.writeText(churchUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (!slug) {
    return (
      <>
        <Header />
        <div style={{ padding: 32 }}>No church configured.</div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div style={{ padding: '32px 24px', maxWidth: 520 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
          Church QR Code
        </h1>
        {churchName && (
          <p style={{ color: '#6366f1', fontWeight: 600, marginBottom: 24 }}>{churchName}</p>
        )}

        {/* QR card */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 24,
          boxShadow: '0 4px 24px rgba(0,0,0,.1)', display: 'inline-block', marginBottom: 24,
        }}>
          <canvas ref={canvasRef} style={{ display: 'block' }} />
          <p style={{
            textAlign: 'center', fontSize: 12, color: '#64748b',
            marginTop: 12, marginBottom: 0, wordBreak: 'break-all',
          }}>
            {churchUrl}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          <button
            onClick={downloadPNG}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#6366f1', color: '#fff', fontWeight: 600,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            ⬇ Download PNG
          </button>
          <button
            onClick={copyURL}
            style={{
              padding: '10px 20px', borderRadius: 8,
              border: '1.5px solid #e2e8f0', background: '#f8fafc',
              color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied!' : '🔗 Copy URL'}
          </button>
        </div>

        {/* Instructions */}
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 10, padding: '14px 18px',
        }}>
          <p style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8, marginTop: 0 }}>
            How to share with members
          </p>
          <ul style={{ margin: 0, paddingInlineStart: 20, color: '#0c4a6e', fontSize: 14, lineHeight: 1.7 }}>
            <li>Print the QR code and display it at your church entrance</li>
            <li>Share it digitally (WhatsApp, email, bulletin)</li>
            <li>Members scan it to open the church app directly</li>
            <li>Or they can type <strong>{slug}</strong> in the church URL field</li>
          </ul>
        </div>
      </div>
    </>
  )
}
