import React, { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import Header from '../components/Header'
import { useGoogleMaps } from '../hooks/useGoogleMaps'
import { useT } from '../i18n'

interface BuildingItem { id: string; name: string }
interface StreetItem   { id: string; name: string; buildings: BuildingItem[] }
interface AreaItem     { id: string; name: string; color: string; boundaryJson?: string | null; streets: StreetItem[] }

type OverpassResult = { streets: string[]; buildings: Record<string, string[]> }

async function fetchOverpassData(points: { lat: number; lng: number }[]): Promise<OverpassResult> {
  const polyStr = points.map(p => `${p.lat} ${p.lng}`).join(' ')
  const query = `
[out:json][timeout:90];
(
  way["highway"]["name"](poly:"${polyStr}");
  way["highway"]["name:ar"](poly:"${polyStr}");
  way["highway"]["name:en"](poly:"${polyStr}");
  node["addr:housenumber"](poly:"${polyStr}");
  way["addr:housenumber"]["building"](poly:"${polyStr}");
);
out tags;`

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]

  let lastErr: unknown
  for (const url of endpoints) {
    try {
      const body = new URLSearchParams({ data: query })
      const res = await fetch(url, { method: 'POST', body })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data.elements)) throw new Error('Unexpected response')

      const streetNames = new Set<string>()
      const buildings: Record<string, string[]> = {}

      for (const e of data.elements as any[]) {
        const t = e.tags ?? {}
        if (t.highway !== undefined) {
          for (const n of [t.name, t['name:ar'], t['name:en']])
            if (typeof n === 'string' && n.trim()) streetNames.add(n.trim())
        } else if (t['addr:housenumber']) {
          const num = t['addr:housenumber'].trim()
          const street = [t['addr:street'], t['addr:street:ar'], t['addr:street:en']]
            .find((n): n is string => typeof n === 'string' && n.trim().length > 0)?.trim()
          if (street) {
            if (!buildings[street]) buildings[street] = []
            if (!buildings[street].includes(num)) buildings[street].push(num)
          }
        }
      }

      for (const k of Object.keys(buildings))
        buildings[k].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

      return { streets: [...streetNames].sort(), buildings }
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error('Failed to reach Overpass API')
}

// ── Boundary editor modal — keep as-is (all Arabic UI) ───────────────────────
function BoundaryModal({ area, onSaved, onClose }: {
  area: AreaItem
  onSaved: () => void
  onClose: () => void
}) {
  const mapsLoaded  = useGoogleMaps()
  const mapDivRef   = useRef<HTMLDivElement>(null)
  const mapRef      = useRef<any>(null)
  const polygonRef  = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const dotsRef     = useRef<any[]>([])
  const clickRef    = useRef<any>(null)
  const livePtsRef  = useRef<{ lat: number; lng: number }[]>([])

  const initial: { lat: number; lng: number }[] = area.boundaryJson
    ? JSON.parse(area.boundaryJson) : []

  const [isDrawing, setIsDrawing]         = useState(initial.length < 3)
  const [draftCount, setDraftCount]       = useState(0)
  const [finalPts, setFinalPts]           = useState<{ lat: number; lng: number }[]>(initial)
  const [foundStreets, setFoundStreets]   = useState<string[] | null>(null)
  const [foundBuildings, setFoundBuildings] = useState<Record<string, string[]>>({})
  const [checkedStreets, setCheckedStreets] = useState<Set<string>>(new Set())
  const [loadingStreets, setLoadingStreets] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [statusMsg, setStatusMsg]         = useState('')

  const clearDraft = () => {
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }
    dotsRef.current.forEach(m => m.setMap(null))
    dotsRef.current = []
    if (clickRef.current) {
      ;(window as any).google.maps.event.removeListener(clickRef.current)
      clickRef.current = null
    }
    livePtsRef.current = []
    setDraftCount(0)
  }

  const renderEditablePoly = (map: any, pts: { lat: number; lng: number }[]) => {
    const G = (window as any).google.maps
    if (polygonRef.current) { polygonRef.current.setMap(null) }
    const poly = new G.Polygon({
      paths: pts,
      strokeColor: area.color,
      strokeWeight: 2,
      fillColor: area.color,
      fillOpacity: 0.22,
      editable: true,
      map,
    })
    polygonRef.current = poly

    const sync = () => {
      const path = poly.getPath()
      const updated: { lat: number; lng: number }[] = []
      for (let i = 0; i < path.getLength(); i++) {
        const ll = path.getAt(i)
        updated.push({ lat: ll.lat(), lng: ll.lng() })
      }
      setFinalPts(updated)
    }
    poly.getPath().addListener('set_at', sync)
    poly.getPath().addListener('insert_at', sync)
    poly.getPath().addListener('remove_at', sync)
  }

  const startDraw = (map: any) => {
    if (polygonRef.current) { polygonRef.current.setMap(null); polygonRef.current = null }
    clearDraft()
    map.setOptions({ draggableCursor: 'crosshair' })
    const G = (window as any).google.maps

    const line = new G.Polyline({
      path: [], strokeColor: area.color, strokeWeight: 2, strokeOpacity: 0.9, map,
    })
    polylineRef.current = line

    const listener = map.addListener('click', (e: any) => {
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() }
      livePtsRef.current = [...livePtsRef.current, pt]
      line.setPath(livePtsRef.current)
      setDraftCount(livePtsRef.current.length)

      const dot = new G.Marker({
        position: pt, map, clickable: false,
        icon: { path: G.SymbolPath.CIRCLE, scale: 5, fillColor: area.color, fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 },
      })
      dotsRef.current.push(dot)
    })
    clickRef.current = listener
    setIsDrawing(true)
    setFinalPts([])
    setFoundStreets(null)
    setCheckedStreets(new Set())
    setStatusMsg('')
  }

  const finishDrawing = () => {
    const pts = livePtsRef.current
    if (pts.length < 3) return
    clearDraft()
    mapRef.current?.setOptions({ draggableCursor: null })
    renderEditablePoly(mapRef.current, pts)
    setFinalPts(pts)
    setIsDrawing(false)
  }

  const redraw = () => {
    if (mapRef.current) startDraw(mapRef.current)
  }

  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || mapRef.current) return
    const G = (window as any).google.maps

    let center = { lat: 30.0626, lng: 31.2497 }
    if (initial.length > 0) {
      const lats = initial.map(p => p.lat)
      const lngs = initial.map(p => p.lng)
      center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 }
    }

    const map = new G.Map(mapDivRef.current, {
      center, zoom: initial.length > 0 ? 14 : 12,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    })
    mapRef.current = map

    if (initial.length >= 3) {
      renderEditablePoly(map, initial)
    } else {
      startDraw(map)
    }
  }, [mapsLoaded])

  const searchStreets = async () => {
    if (!canSave) { setStatusMsg('أكمل رسم الحدود أولاً.'); return }
    setLoadingStreets(true)
    setStatusMsg('جاري البحث عن الشوارع والمباني في OpenStreetMap…')
    setFoundStreets(null)
    setFoundBuildings({})
    try {
      const { streets, buildings } = await fetchOverpassData(finalPts)
      setFoundStreets(streets)
      setFoundBuildings(buildings)
      setCheckedStreets(new Set(streets))
      const totalBuildings = Object.values(buildings).reduce((s, b) => s + b.length, 0)
      setStatusMsg(streets.length > 0
        ? `تم العثور على ${streets.length} شارع و${totalBuildings} مبنى — اختر الشوارع المراد استيرادها.`
        : 'لم يتم العثور على شوارع مسماة داخل هذه المنطقة في OpenStreetMap.')
    } catch {
      setFoundStreets([])
      setStatusMsg('فشل الاتصال بـ OpenStreetMap. تحقق من الاتصال بالإنترنت وحاول مجدداً.')
    }
    setLoadingStreets(false)
  }

  const toggleStreet = (name: string) =>
    setCheckedStreets(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s })

  const save = async () => {
    if (finalPts.length < 3) { setStatusMsg('أكمل رسم الحدود أولاً.'); return }
    setSaving(true); setStatusMsg('')
    try {
      const boundaryJson = JSON.stringify(finalPts)
      await api.put(`/areas/${area.id}/boundary`, { boundaryJson })
      let updatedStreets = [...area.streets]
      if (foundStreets && checkedStreets.size > 0) {
        const toImport = foundStreets.filter(s => checkedStreets.has(s))
        const buildings: Record<string, string[]> = {}
        for (const s of toImport) if (foundBuildings[s]?.length) buildings[s] = foundBuildings[s]
        const r = await api.post<{ imported: number; streets: StreetItem[] }>(
          `/areas/${area.id}/streets/bulk`, { names: toImport, buildings })
        updatedStreets = r.data.streets
        const totalBuildings = Object.values(buildings).reduce((s, b) => s + b.length, 0)
        setStatusMsg(`تم حفظ الحدود واستيراد ${r.data.imported} شارع${totalBuildings > 0 ? ` و${totalBuildings} مبنى` : ''}.`)
      } else {
        setStatusMsg('تم حفظ الحدود.')
      }
      onSaved()
    } catch { setStatusMsg('فشل الحفظ.') }
    setSaving(false)
  }

  const canSave = !isDrawing && finalPts.length >= 3

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 14, width: '90vw', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: area.color }} />
            <strong style={{ fontSize: '1rem' }}>تحديد حدود: {area.name}</strong>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ position: 'relative', flex: '0 0 420px' }}>
          <div ref={mapDivRef} style={{ height: 420, background: '#f3f4f6' }}>
            {!mapsLoaded && (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                جاري تحميل الخريطة…
              </div>
            )}
          </div>

          {mapsLoaded && (
            <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              {isDrawing && draftCount >= 3 && (
                <button onClick={finishDrawing} style={{
                  padding: '6px 14px', background: area.color, color: 'white', border: 'none',
                  borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}>
                  ✓ إنهاء الرسم ({draftCount} نقطة)
                </button>
              )}
              {!isDrawing && (
                <button onClick={redraw} style={{
                  padding: '5px 12px', background: 'white', border: '1px solid #d1d5db',
                  borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                }}>
                  ارسم من جديد
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', flex: 1, overflowY: 'auto' }}>

          {isDrawing && (
            <p style={{ margin: '0 0 10px', fontSize: '0.83rem', color: '#6b7280' }}>
              {draftCount === 0
                ? 'انقر على الخريطة لإضافة نقاط الحدود.'
                : draftCount < 3
                  ? `${draftCount} نقطة — أضف ${3 - draftCount} على الأقل ثم اضغط "إنهاء الرسم".`
                  : `${draftCount} نقطة — اضغط "إنهاء الرسم" لإغلاق الشكل.`}
            </p>
          )}

          {statusMsg && (
            <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#374151' }}>{statusMsg}</p>
          )}

          {foundStreets !== null && foundStreets.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>الشوارع المكتشفة ({foundStreets.length})</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCheckedStreets(new Set(foundStreets))}
                    style={{ fontSize: '0.78rem', background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer' }}>تحديد الكل</button>
                  <button onClick={() => setCheckedStreets(new Set())}
                    style={{ fontSize: '0.78rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>إلغاء الكل</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 150, overflowY: 'auto', padding: 4 }}>
                {foundStreets.map(s => (
                  <label key={s} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${checkedStreets.has(s) ? area.color : '#d1d5db'}`,
                    background: checkedStreets.has(s) ? `${area.color}18` : 'white', fontSize: '0.83rem',
                  }}>
                    <input type="checkbox" checked={checkedStreets.has(s)} onChange={() => toggleStreet(s)} style={{ margin: 0 }} />
                    {s}
                    {foundBuildings[s]?.length > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#6b7280', marginRight: 2 }}>({foundBuildings[s].length} مبنى)</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={searchStreets} disabled={loadingStreets || !canSave} style={{
              padding: '7px 16px', background: '#f3f4f6', border: '1px solid #d1d5db',
              borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem', opacity: !canSave ? 0.5 : 1,
            }}>
              {loadingStreets ? '…جاري البحث' : 'بحث عن الشوارع (OpenStreetMap)'}
            </button>
            <button onClick={save} disabled={saving || !canSave} style={{
              padding: '7px 20px', background: '#4f46e5', color: 'white', border: 'none',
              borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
              opacity: saving || !canSave ? 0.6 : 1,
            }}>
              {saving ? 'جاري الحفظ…' : 'حفظ الحدود' + (checkedStreets.size > 0 ? ` واستيراد ${checkedStreets.size} شارع` : '')}
            </button>
            <button onClick={onClose} style={{
              padding: '7px 16px', background: 'white', border: '1px solid #d1d5db',
              borderRadius: 8, cursor: 'pointer', fontSize: '0.88rem',
            }}>إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const PALETTE = [
  '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

export default function AreasPage() {
  const { t } = useT()
  const [areas, setAreas]   = useState<AreaItem[]>([])
  const [loading, setLoading] = useState(true)

  const [newAreaName, setNewAreaName]   = useState('')
  const [newAreaColor, setNewAreaColor] = useState(PALETTE[0])
  const [editAreaId, setEditAreaId]     = useState<string | null>(null)
  const [editAreaName, setEditAreaName] = useState('')
  const [editAreaColor, setEditAreaColor] = useState('')
  const [areaError, setAreaError]       = useState('')

  const [newStreet, setNewStreet]   = useState<Record<string, string>>({})
  const [editStreet, setEditStreet] = useState<{ areaId: string; streetId: string; name: string } | null>(null)
  const [streetError, setStreetError] = useState('')

  const [expandedStreet, setExpandedStreet] = useState<string | null>(null)
  const [newBuilding, setNewBuilding] = useState<Record<string, string>>({})
  const [buildingError, setBuildingError] = useState('')

  const [boundaryArea, setBoundaryArea] = useState<AreaItem | null>(null)

  const load = () =>
    api.get<AreaItem[]>('/areas').then(r => setAreas(r.data)).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const addArea = async () => {
    setAreaError('')
    if (!newAreaName.trim()) return setAreaError('Area name is required.')
    try {
      const r = await api.post<AreaItem>('/areas', { name: newAreaName.trim(), color: newAreaColor })
      setAreas(prev => [...prev, { ...r.data, streets: [] }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewAreaName('')
    } catch (e: unknown) {
      setAreaError((e as any)?.response?.data?.title ?? 'Failed to add area.')
    }
  }

  const saveAreaEdit = async () => {
    if (!editAreaId || !editAreaName.trim()) return
    setAreaError('')
    try {
      await api.put(`/areas/${editAreaId}`, { name: editAreaName.trim(), color: editAreaColor })
      setAreas(prev => prev.map(a => a.id === editAreaId
        ? { ...a, name: editAreaName.trim(), color: editAreaColor } : a)
        .sort((a, b) => a.name.localeCompare(b.name)))
      setEditAreaId(null)
    } catch (e: unknown) {
      setAreaError((e as any)?.response?.data?.title ?? 'Failed to update area.')
    }
  }

  const deleteArea = async (id: string) => {
    if (!confirm('Delete this area and ALL its streets?')) return
    await api.delete(`/areas/${id}`)
    setAreas(prev => prev.filter(a => a.id !== id))
  }

  const addStreet = async (areaId: string) => {
    setStreetError('')
    const name = (newStreet[areaId] ?? '').trim()
    if (!name) return setStreetError('Street name is required.')
    try {
      const r = await api.post<StreetItem>(`/areas/${areaId}/streets`, { name })
      setAreas(prev => prev.map(a => a.id === areaId
        ? { ...a, streets: [...a.streets, r.data].sort((x, y) => x.name.localeCompare(y.name)) } : a))
      setNewStreet(prev => ({ ...prev, [areaId]: '' }))
    } catch (e: unknown) {
      setStreetError((e as any)?.response?.data?.title ?? 'Failed to add street.')
    }
  }

  const saveStreetEdit = async () => {
    if (!editStreet || !editStreet.name.trim()) return
    setStreetError('')
    try {
      await api.put(`/areas/${editStreet.areaId}/streets/${editStreet.streetId}`, { name: editStreet.name.trim() })
      setAreas(prev => prev.map(a => a.id === editStreet.areaId
        ? { ...a, streets: a.streets.map(s => s.id === editStreet.streetId ? { ...s, name: editStreet.name.trim() } : s)
            .sort((x, y) => x.name.localeCompare(y.name)) } : a))
      setEditStreet(null)
    } catch (e: unknown) {
      setStreetError((e as any)?.response?.data?.title ?? 'Failed to update street.')
    }
  }

  const deleteStreet = async (areaId: string, streetId: string) => {
    if (!confirm('Delete this street?')) return
    await api.delete(`/areas/${areaId}/streets/${streetId}`)
    setAreas(prev => prev.map(a => a.id === areaId
      ? { ...a, streets: a.streets.filter(s => s.id !== streetId) } : a))
  }

  const addBuilding = async (areaId: string, streetId: string) => {
    setBuildingError('')
    const name = (newBuilding[streetId] ?? '').trim()
    if (!name) return setBuildingError('Building name is required.')
    try {
      const r = await api.post<BuildingItem>(`/areas/${areaId}/streets/${streetId}/buildings`, { name })
      setAreas(prev => prev.map(a => a.id === areaId
        ? { ...a, streets: a.streets.map(s => s.id === streetId
            ? { ...s, buildings: [...s.buildings, r.data].sort((x, y) => x.name.localeCompare(y.name)) }
            : s) }
        : a))
      setNewBuilding(prev => ({ ...prev, [streetId]: '' }))
    } catch (e: unknown) {
      setBuildingError((e as any)?.response?.data?.title ?? 'Failed to add building.')
    }
  }

  const deleteBuilding = async (areaId: string, streetId: string, buildingId: string) => {
    if (!confirm('Delete this building?')) return
    await api.delete(`/areas/${areaId}/streets/${streetId}/buildings/${buildingId}`)
    setAreas(prev => prev.map(a => a.id === areaId
      ? { ...a, streets: a.streets.map(s => s.id === streetId
          ? { ...s, buildings: s.buildings.filter(b => b.id !== buildingId) }
          : s) }
      : a))
  }

  if (loading) return <div className="container"><p>{t('common.loading')}</p></div>

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2>{t('areas.title')} &amp; Streets</h2>
        </div>

        {/* Add area */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h4 style={{ marginTop: 0 }}>Add new area</h4>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={newAreaName}
              onChange={e => setNewAreaName(e.target.value)}
              placeholder="Area name"
              onKeyDown={e => e.key === 'Enter' && addArea()}
              style={{ flex: 1, minWidth: 180 }}
            />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setNewAreaColor(c)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c,
                    border: newAreaColor === c ? '3px solid #1f2937' : '2px solid transparent',
                    cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
              <input type="color" value={newAreaColor} onChange={e => setNewAreaColor(e.target.value)}
                style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                title="Custom color"
              />
            </div>
            <button className="btn-primary" onClick={addArea}>+ {t('common.add')}</button>
          </div>
          {areaError && <div className="error" style={{ marginTop: 6 }}>{areaError}</div>}
        </div>

        {areas.length === 0 && <p style={{ color: '#888' }}>No areas yet. Add one above.</p>}

        {areas.map(area => (
          <div key={area.id} className="card" style={{ marginBottom: 16, borderRight: `4px solid ${area.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {editAreaId === area.id ? (
                <>
                  <input
                    value={editAreaName}
                    onChange={e => setEditAreaName(e.target.value)}
                    style={{ flex: 1, fontWeight: 600, fontSize: '1rem' }}
                    onKeyDown={e => e.key === 'Enter' && saveAreaEdit()}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {PALETTE.map(c => (
                      <button key={c} onClick={() => setEditAreaColor(c)} style={{
                        width: 18, height: 18, borderRadius: '50%', background: c, padding: 0,
                        border: editAreaColor === c ? '3px solid #1f2937' : '2px solid transparent', cursor: 'pointer',
                      }} />
                    ))}
                    <input type="color" value={editAreaColor} onChange={e => setEditAreaColor(e.target.value)}
                      style={{ width: 24, height: 24, padding: 0, border: 'none', borderRadius: 3, cursor: 'pointer' }}
                    />
                  </div>
                  <button className="btn-primary btn-sm" onClick={saveAreaEdit}>{t('common.save')}</button>
                  <button className="btn-sm" onClick={() => setEditAreaId(null)}>{t('common.cancel')}</button>
                </>
              ) : (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: area.color, flexShrink: 0 }} />
                  <h3 style={{ margin: 0, flex: 1 }}>{area.name}</h3>
                  {area.boundaryJson && (
                    <span style={{ fontSize: '0.75rem', color: '#10b981', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, padding: '2px 6px' }}>
                      ✓ حدود محددة
                    </span>
                  )}
                  <button className="btn-sm" onClick={() => setBoundaryArea(area)}>
                    تحديد الحدود
                  </button>
                  <button className="btn-sm" onClick={() => { setEditAreaId(area.id); setEditAreaName(area.name); setEditAreaColor(area.color) }}>{t('common.edit')}</button>
                  <button className="btn-sm btn-danger" onClick={() => deleteArea(area.id)}>{t('common.delete')}</button>
                </>
              )}
            </div>

            {/* Streets list */}
            <table className="table" style={{ marginBottom: 10 }}>
              <thead>
                <tr><th>Street</th><th>Buildings</th><th></th></tr>
              </thead>
              <tbody>
                {area.streets.length === 0 && (
                  <tr><td colSpan={3} style={{ color: '#aaa', fontStyle: 'italic' }}>No streets yet.</td></tr>
                )}
                {area.streets.map(s => (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td>
                        {editStreet?.streetId === s.id ? (
                          <input
                            value={editStreet.name}
                            onChange={e => setEditStreet({ ...editStreet, name: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && saveStreetEdit()}
                            style={{ width: '100%' }}
                            autoFocus
                          />
                        ) : s.name}
                      </td>
                      <td>
                        <button
                          className="btn-sm"
                          onClick={() => setExpandedStreet(expandedStreet === s.id ? null : s.id)}
                          style={{ fontSize: '0.78rem' }}
                        >
                          {s.buildings.length > 0 ? `🏢 ${s.buildings.length}` : '+ مباني'}
                          {expandedStreet === s.id ? ' ▲' : ' ▼'}
                        </button>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {editStreet?.streetId === s.id ? (
                          <>
                            <button className="btn-sm btn-primary" onClick={saveStreetEdit}>{t('common.save')}</button>{' '}
                            <button className="btn-sm" onClick={() => setEditStreet(null)}>{t('common.cancel')}</button>
                          </>
                        ) : (
                          <>
                            <button className="btn-sm" onClick={() => setEditStreet({ areaId: area.id, streetId: s.id, name: s.name })}>{t('common.edit')}</button>{' '}
                            <button className="btn-sm btn-danger" onClick={() => deleteStreet(area.id, s.id)}>{t('common.delete')}</button>
                          </>
                        )}
                      </td>
                    </tr>

                    {expandedStreet === s.id && (
                      <tr>
                        <td colSpan={3} style={{ background: '#f8fafc', padding: '10px 16px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: s.buildings.length ? 8 : 0 }}>
                            {s.buildings.map(b => (
                              <span key={b.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', background: 'white', border: '1px solid #d1d5db',
                                borderRadius: 6, fontSize: '0.82rem',
                              }}>
                                {b.name}
                                <button
                                  onClick={() => deleteBuilding(area.id, s.id, b.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, lineHeight: 1 }}
                                >×</button>
                              </span>
                            ))}
                            {s.buildings.length === 0 && (
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>لا توجد مباني بعد.</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              value={newBuilding[s.id] ?? ''}
                              onChange={e => setNewBuilding(prev => ({ ...prev, [s.id]: e.target.value }))}
                              placeholder="اسم أو رقم المبنى"
                              onKeyDown={e => e.key === 'Enter' && addBuilding(area.id, s.id)}
                              style={{ flex: 1, fontSize: '0.85rem' }}
                            />
                            <button className="btn-sm btn-primary" onClick={() => addBuilding(area.id, s.id)}>+ إضافة</button>
                          </div>
                          {buildingError && <div className="error" style={{ marginTop: 4, fontSize: '0.8rem' }}>{buildingError}</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {streetError && <div className="error" style={{ marginBottom: 6 }}>{streetError}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newStreet[area.id] ?? ''}
                onChange={e => setNewStreet(prev => ({ ...prev, [area.id]: e.target.value }))}
                placeholder="New street name"
                onKeyDown={e => e.key === 'Enter' && addStreet(area.id)}
                style={{ flex: 1 }}
              />
              <button className="btn-sm btn-primary" onClick={() => addStreet(area.id)}>+ Street</button>
            </div>
          </div>
        ))}
      </div>

      {boundaryArea && (
        <BoundaryModal
          area={boundaryArea}
          onSaved={() => {
            setBoundaryArea(null)
            load()
          }}
          onClose={() => setBoundaryArea(null)}
        />
      )}
    </div>
  )
}
