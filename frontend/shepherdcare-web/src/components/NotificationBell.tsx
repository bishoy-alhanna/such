import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../auth'
import { useT } from '../i18n'

interface NotifItem {
  id: string
  title: string
  body: string
  type: string
  link: string | null
  isRead: boolean
  createdAt: string
}

interface Props {
  collapsed: boolean
}

const ROLES = ['All', 'SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader', 'Servant', 'DataEntry', 'Member']

export default function NotificationBell({ collapsed }: Props) {
  const nav = useNavigate()
  const { hasRole } = useAuth()
  const { t } = useT()
  const canBroadcast = hasRole('SuperAdmin') || hasRole('Priest') || hasRole('SeniorPriest') || hasRole('ServiceLeader')
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(false)
  const [dropPos, setDropPos] = useState<{ top: number; inlineStart: number } | null>(null)

  // Broadcast modal state
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [bcTitle, setBcTitle] = useState('')
  const [bcBody, setBcBody] = useState('')
  const [bcLink, setBcLink] = useState('')
  const [bcTarget, setBcTarget] = useState('All')
  const [bcSending, setBcSending] = useState(false)
  const [bcResult, setBcResult] = useState<string | null>(null)

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count')
      setUnread(data.count ?? 0)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [fetchCount])

  const loadItems = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications?pageSize=30')
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  const handleBellClick = () => {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const isRtl = document.documentElement.dir === 'rtl'
      setDropPos({
        top: r.top,
        inlineStart: isRtl ? window.innerWidth - r.left + 8 : r.right + 8,
      })
    }
    setOpen(true)
    loadItems()
  }

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`)
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnread(c => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnread(0)
  }

  const dismiss = async (id: string, wasRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.delete(`/notifications/${id}`)
    setItems(prev => prev.filter(n => n.id !== id))
    if (!wasRead) setUnread(c => Math.max(0, c - 1))
  }

  const handleItemClick = (n: NotifItem) => {
    if (!n.isRead) markRead(n.id)
    if (n.link) { nav(n.link); setOpen(false) }
  }

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return t('notifications.now' as any)
    if (diff < 3600) return t('notifications.minutesAgo' as any, { n: Math.floor(diff / 60) })
    if (diff < 86400) return t('notifications.hoursAgo' as any, { n: Math.floor(diff / 3600) })
    return t('notifications.daysAgo' as any, { n: Math.floor(diff / 86400) })
  }

  const sendBroadcast = async () => {
    if (!bcTitle.trim() || !bcBody.trim()) return
    setBcSending(true)
    setBcResult(null)
    try {
      const r = await api.post('/notifications/broadcast', {
        title: bcTitle.trim(), body: bcBody.trim(),
        link: bcLink.trim() || null, target: bcTarget,
      })
      setBcResult(t('notifications.sentTo' as any, { n: r.data.sent }))
      setBcTitle(''); setBcBody(''); setBcLink(''); setBcTarget('All')
    } catch {
      setBcResult(t('notifications.sendError' as any))
    } finally {
      setBcSending(false)
    }
  }

  const isRtl = document.documentElement.dir === 'rtl'

  return (
    <>
      <button
        ref={btnRef}
        className="sidebar-logout"
        onClick={handleBellClick}
        title="الإشعارات"
        style={{ position: 'relative', justifyContent: collapsed ? 'center' : undefined }}
      >
        <span style={{ position: 'relative', width: 20, flexShrink: 0, textAlign: 'center', display: 'inline-flex', justifyContent: 'center' }}>
          🔔
          {unread > 0 && (
            <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </span>
        {!collapsed && <span>الإشعارات</span>}
      </button>

      {open && dropPos && (
        <div
          ref={dropRef}
          className="notif-dropdown"
          style={{
            position: 'fixed',
            top: dropPos.top,
            ...(isRtl
              ? { insetInlineEnd: dropPos.inlineStart }
              : { insetInlineStart: dropPos.inlineStart }),
          }}
        >
          <div className="notif-header">
            <span style={{ fontWeight: 600 }}>
              الإشعارات
              {unread > 0 && <span className="notif-badge-count">{unread}</span>}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {canBroadcast && (
                <button className="notif-mark-all" onClick={() => { setOpen(false); setBroadcastOpen(true) }} title="إرسال إشعار جماعي">
                  📢
                </button>
              )}
              {unread > 0 && (
                <button className="notif-mark-all" onClick={markAllRead}>
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
          </div>

          <div className="notif-list">
            {loading && <div className="notif-empty">جارٍ التحميل…</div>}
            {!loading && items.length === 0 && <div className="notif-empty">لا توجد إشعارات</div>}
            {items.map(n => (
              <div
                key={n.id}
                className={'notif-item' + (n.isRead ? '' : ' unread')}
                onClick={() => handleItemClick(n)}
              >
                <div className="notif-item-content">
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                </div>
                <button
                  className="notif-dismiss"
                  onClick={e => dismiss(n.id, n.isRead, e)}
                  title="حذف"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Broadcast modal */}
      {broadcastOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setBroadcastOpen(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 32px',
            maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,.2)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18 }}>📢 إرسال إشعار جماعي</h3>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>المستهدفون</label>
                <select value={bcTarget} onChange={e => setBcTarget(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}>
                  {ROLES.map(r => <option key={r} value={r}>{r === 'All' ? 'الكل' : r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>العنوان *</label>
                <input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="عنوان الإشعار"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>النص *</label>
                <textarea value={bcBody} onChange={e => setBcBody(e.target.value)} placeholder="نص الإشعار…" rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>رابط (اختياري)</label>
                <input value={bcLink} onChange={e => setBcLink(e.target.value)} placeholder="/events"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
              </div>

              {bcResult && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: bcResult.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: bcResult.startsWith('✅') ? '#15803d' : '#dc2626', fontWeight: 600, fontSize: 14 }}>
                  {bcResult}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => { setBroadcastOpen(false); setBcResult(null) }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 14 }}>
                  إلغاء
                </button>
                <button onClick={sendBroadcast} disabled={bcSending || !bcTitle.trim() || !bcBody.trim()}
                  style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: bcSending ? .6 : 1 }}>
                  {bcSending ? 'جارٍ الإرسال…' : 'إرسال'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
