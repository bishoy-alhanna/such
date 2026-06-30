import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { mapValidationErrors } from '../utils/validation'
import { useGoogleMaps } from '../hooks/useGoogleMaps'
import type { Family } from '../types'
import { useT } from '../i18n'

interface BuildingItem { id: string; name: string }
interface StreetItem   { id: string; name: string; buildings: BuildingItem[] }
interface AreaItem     { id: string; name: string; boundaryJson?: string | null; streets: StreetItem[] }

interface Props {
  family?: Family | null
  onSaved: (f: Family) => void
  onCancel: () => void
}

function boundaryCentroid(json: string): { lat: number; lng: number } | null {
  try {
    const pts: { lat: number; lng: number }[] = JSON.parse(json)
    if (!pts.length) return null
    return {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    }
  } catch { return null }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=eg`
    const res = await fetch(url, { headers: { 'Accept-Language': 'ar', 'User-Agent': 'ShepherdCare/1.0' } })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0)
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { }
  return null
}

export default function FamilyFormModal({ family, onSaved, onCancel }: Props) {
  const { t } = useT()
  const isEdit = !!family

  const parseStreet   = (addr?: string) => addr?.split(',')[0]?.trim() ?? ''
  const parseAddrRest = (addr?: string) => addr?.split(',').slice(1).join(',').trim() ?? ''

  const [areas, setAreas]               = useState<AreaItem[]>([])
  const [familyName, setFamilyName]     = useState(family?.familyName ?? '')
  const [area, setArea]                 = useState(family?.area ?? '')
  const [street, setStreet]             = useState(parseStreet(family?.address))
  const [addrExtra, setAddrExtra]       = useState(parseAddrRest(family?.address))
  const [phoneNumbers, setPhoneNumbers] = useState(family?.phoneNumbers ?? '')
  const [status, setStatus]             = useState(family?.status ?? 'Active')
  const [errors, setErrors]             = useState<Record<string, string[]>>({})
  const [saving, setSaving]             = useState(false)

  // Location state
  const [lat, setLat] = useState<number | null>(family?.latitude ?? null)
  const [lng, setLng] = useState<number | null>(family?.longitude ?? null)
  const [geocoding, setGeocoding] = useState(false)

  // Map refs
  const mapsLoaded = useGoogleMaps()
  const mapDivRef  = useRef<HTMLDivElement>(null)
  const mapRef     = useRef<any>(null)
  const markerRef  = useRef<any>(null)

  useEffect(() => {
    api.get<AreaItem[]>('/areas').then(r => setAreas(r.data)).catch(() => {})
  }, [])

  // Reset street (and building) when area changes
  useEffect(() => {
    const found = areas.find(a => a.name === area)
    if (street && found && !found.streets.some(s => s.name === street)) {
      setStreet('')
      setAddrExtra('')
    }
  }, [area, areas])

  // Reset building when street changes
  useEffect(() => {
    setAddrExtra('')
  }, [street])

  // Initialise map once API is loaded
  useEffect(() => {
    if (!mapsLoaded || !mapDivRef.current || mapRef.current) return

    const G = (window as any).google.maps
    const center = lat && lng ? { lat, lng } : { lat: 30.0626, lng: 31.2497 }

    const map = new G.Map(mapDivRef.current, {
      center,
      zoom: lat && lng ? 16 : 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapId: 'DEMO_MAP_ID',
    })
    mapRef.current = map

    const marker = new G.marker.AdvancedMarkerElement({
      position: center,
      map: lat && lng ? map : null,
      gmpDraggable: true,
    })
    markerRef.current = marker

    marker.addListener('gmp-dragend', () => {
      const pos = (marker as any).position
      setLat(pos.lat)
      setLng(pos.lng)
    })

    map.addListener('click', (e: any) => {
      const pos = e.latLng
      marker.position = pos
      marker.map = map
      setLat(pos.lat())
      setLng(pos.lng())
    })
  }, [mapsLoaded])

  // Keep marker in sync when lat/lng change (e.g. from auto-geocode)
  useEffect(() => {
    if (!markerRef.current || lat === null || lng === null) return
    const pos = { lat, lng }
    markerRef.current.position = pos
    markerRef.current.map = mapRef.current
    mapRef.current?.panTo(pos)
    mapRef.current?.setZoom(16)
  }, [lat, lng])

  // Progressive geocode: area → street → building number.
  useEffect(() => {
    if (!area) return
    const hasBuilding = addrExtra.trim().length > 0
    const hasStreet   = street.length > 0

    // Area-only: use boundary centroid instantly — no API call needed
    if (!hasStreet && !hasBuilding) {
      const areaObj = areas.find(a => a.name === area)
      if (areaObj?.boundaryJson) {
        const c = boundaryCentroid(areaObj.boundaryJson)
        if (c) { setLat(c.lat); setLng(c.lng) }
        return
      }
    }

    // Street / building: Nominatim — omit area name so it doesn't confuse OSM
    const delay = hasBuilding ? 900 : 450
    const t = setTimeout(async () => {
      setGeocoding(true)
      const q = hasBuilding && hasStreet
        ? `${addrExtra.trim()} ${street}, Egypt`
        : `${street}, Egypt`
      const coords = await geocodeAddress(q)
      if (coords) { setLat(coords.lat); setLng(coords.lng) }
      setGeocoding(false)
    }, delay)
    return () => clearTimeout(t)
  }, [area, street, addrExtra, areas])

  const clearLocation = () => {
    setLat(null)
    setLng(null)
    if (markerRef.current) markerRef.current.map = null
  }

  const streets = areas.find(a => a.name === area)?.streets ?? []

  const buildAddress = () => {
    const parts = [street, addrExtra].filter(Boolean)
    return parts.join(', ') || undefined
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const payload = {
      familyName,
      address:      buildAddress(),
      area:         area         || undefined,
      phoneNumbers: phoneNumbers || undefined,
      status,
      latitude:     lat  ?? undefined,
      longitude:    lng  ?? undefined,
    }
    try {
      if (isEdit) {
        const r = await api.put<Family>(`/families/${family!.id}`, payload)
        onSaved({ ...family!, ...payload, ...(r.data ?? {}) })
      } else {
        const r = await api.post<Family>('/families', payload)
        onSaved(r.data)
      }
    } catch (err: unknown) {
      setErrors(mapValidationErrors(err))
    } finally {
      setSaving(false)
    }
  }

  const hasKey = !!(window as any).GOOGLE_MAPS_API_KEY
  const geocodingLabel = addrExtra.trim() && street ? 'المبنى' : street ? 'الشارع' : 'المنطقة'

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 620 }}>
        <h3>{isEdit ? `${t('common.edit')} — ${family!.familyName}` : t('familyForm.title')}</h3>
        <form onSubmit={submit}>

          <label>{t('familyForm.nameLabel')}</label>
          <input
            value={familyName}
            onChange={e => setFamilyName(e.target.value)}
            placeholder={t('familyForm.namePlaceholder')}
            autoFocus
          />
          {errors.FamilyName && <div className="error">{errors.FamilyName.join(', ')}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>{t('familyForm.area')}</label>
              <select value={area} onChange={e => setArea(e.target.value)}>
                <option value="">{t('familyForm.selectArea')}</option>
                {areas.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label>{t('familyForm.street')}</label>
              <select value={street} onChange={e => setStreet(e.target.value)} disabled={!area}>
                <option value="">{area ? t('familyForm.selectStreet') : t('familyForm.pickAreaFirst')}</option>
                {streets.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <label>{t('familyForm.building')}</label>
          {streets.find(s => s.name === street)?.buildings?.length ? (
            <select
              value={addrExtra}
              onChange={e => setAddrExtra(e.target.value)}
            >
              <option value="">— اختر المبنى —</option>
              {streets.find(s => s.name === street)!.buildings.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
              <option value="__other__">— أخرى (اكتب يدوياً) —</option>
            </select>
          ) : (
            <input
              value={addrExtra}
              onChange={e => setAddrExtra(e.target.value)}
              placeholder="e.g. Bldg 12, Apt 3"
            />
          )}
          {addrExtra === '__other__' && (
            <input
              value={''}
              onChange={e => setAddrExtra(e.target.value)}
              placeholder="اكتب اسم أو رقم المبنى"
              autoFocus
              style={{ marginTop: 6 }}
            />
          )}

          {/* Map location picker */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ margin: 0 }}>
                {t('familyForm.mapLocation')}
                {geocoding && <span style={{ marginRight: 6, fontSize: '0.78rem', color: '#6b7280' }}>جاري تحديد موقع {geocodingLabel}…</span>}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {lat && lng && (
                  <>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={clearLocation}
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 8px', fontSize: '0.78rem', cursor: 'pointer', color: '#6b7280' }}
                    >
                      مسح
                    </button>
                  </>
                )}
              </div>
            </div>

            {!hasKey ? (
              <div style={{ padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.82rem', color: '#78350f' }}>
                لم يتم تعيين مفتاح Google Maps في إعدادات النظام.
              </div>
            ) : (
              <div
                ref={mapDivRef}
                style={{
                  height: 220, borderRadius: 8, border: '1px solid #d1d5db',
                  background: '#f3f4f6', overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {!mapsLoaded && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#9ca3af', fontSize: '0.85rem', background: '#f9fafb'
                  }}>
                    جاري تحميل الخريطة…
                  </div>
                )}
              </div>
            )}

            {!lat && !lng && hasKey && mapsLoaded && (
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                اختر المنطقة والشارع لتحديد الموقع تلقائياً، أو انقر على الخريطة لتحديده يدوياً.
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label>{t('familyForm.phone')}</label>
              <input
                value={phoneNumbers}
                onChange={e => setPhoneNumbers(e.target.value)}
                placeholder="+20 100 000 0000"
              />
            </div>
            <div>
              <label>{t('familyForm.status')}</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Active">{t('familyForm.active')}</option>
                <option value="Inactive">{t('familyForm.inactive')}</option>
                <option value="New">{t('familyForm.new')}</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : isEdit ? t('familyForm.saveChanges') : t('familyForm.createFamily')}
            </button>
            <button type="button" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
