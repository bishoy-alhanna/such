import React, { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import Header from '../components/Header'
import { useGoogleMaps } from '../hooks/useGoogleMaps'
import { useT } from '../i18n'

interface MapFamily {
  id: string
  familyName: string
  address?: string
  area?: string
  latitude?: number | null
  longitude?: number | null
  members: string[]
}

interface StreetItem { id: string; name: string }
interface MapArea {
  id: string
  name: string
  color: string
  boundaryJson?: string | null
  streets: StreetItem[]
}

declare global {
  interface Window {
    GOOGLE_MAPS_API_KEY?: string
    __gmapsReady__?: () => void
    google?: any
  }
}

async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=eg`
    const res = await fetch(url, { headers: { 'Accept-Language': 'ar', 'User-Agent': 'ShepherdCare/1.0' } })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0)
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { }
  return null
}

function boundaryCentroidAndBounds(json: string): { center: { lat: number; lng: number }; bounds: { north: number; south: number; east: number; west: number } } | null {
  try {
    const pts: { lat: number; lng: number }[] = JSON.parse(json)
    if (!pts.length) return null
    const lats = pts.map(p => p.lat)
    const lngs = pts.map(p => p.lng)
    return {
      center: {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      },
      bounds: {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east:  Math.max(...lngs),
        west:  Math.min(...lngs),
      },
    }
  } catch { return null }
}

export default function MapPage() {
  const { t } = useT()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<any>(null)
  const mapsLoaded = useGoogleMaps()
  const [families, setFamilies] = useState<MapFamily[]>([])
  const [areas, setAreas]       = useState<MapArea[]>([])
  const [noKey, setNoKey]       = useState(false)
  const mapInitialised          = useRef(false)

  // Filter state
  const [selectedArea,   setSelectedArea]   = useState('')
  const [selectedStreet, setSelectedStreet] = useState('')
  const [zooming, setZooming]               = useState(false)

  useEffect(() => {
    if (!window.GOOGLE_MAPS_API_KEY) setNoKey(true)
    api.get<MapFamily[]>('/families/map-data').then(r => setFamilies(r.data)).catch(() => {})
    api.get<MapArea[]>('/areas').then(r => setAreas(r.data)).catch(() => {})
  }, [])

  // Initialise map once
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || mapInitialised.current) return
    if (families.length === 0 && areas.length === 0 && !noKey) return

    mapInitialised.current = true
    const G = window.google.maps

    const withCoords = families.filter(f => f.latitude && f.longitude)
    const center = withCoords.length > 0
      ? { lat: withCoords[0].latitude!, lng: withCoords[0].longitude! }
      : { lat: 30.0626, lng: 31.2497 }

    const map = new G.Map(mapContainerRef.current, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      mapId: 'DEMO_MAP_ID',
    })
    mapRef.current = map

    // Area boundary polygons
    areas.forEach(a => {
      if (!a.boundaryJson) return
      try {
        const pts: { lat: number; lng: number }[] = JSON.parse(a.boundaryJson)
        const polygon = new G.Polygon({
          paths: pts,
          strokeColor: a.color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: a.color,
          fillOpacity: 0.12,
          map,
        })
        const iw = new G.InfoWindow({ content: `<strong>${a.name}</strong>` })
        polygon.addListener('click', (e: any) => iw.open({ map, anchor: { getPosition: () => e.latLng } as any }))
      } catch { }
    })

    const infoWindow = new G.InfoWindow()

    withCoords.forEach(f => {
      const marker = new G.marker.AdvancedMarkerElement({
        position: { lat: f.latitude!, lng: f.longitude! },
        map,
        title: f.familyName,
      })
      marker.addListener('gmp-click', () => {
        const memberList = f.members.length
          ? `<ul style="margin:6px 0 0;padding-right:16px;font-size:0.85rem">${f.members.map(m => `<li>${m}</li>`).join('')}</ul>`
          : ''
        infoWindow.setContent(`
          <div dir="rtl" style="font-family:sans-serif;min-width:160px;max-width:220px">
            <strong style="font-size:0.95rem">${f.familyName}</strong>
            ${f.area    ? `<div style="color:#6b7280;font-size:0.78rem;margin-top:2px">${f.area}</div>`    : ''}
            ${f.address ? `<div style="color:#9ca3af;font-size:0.78rem">${f.address}</div>` : ''}
            ${memberList}
          </div>`)
        infoWindow.open({ map, anchor: marker })
      })
    })
  }, [mapsLoaded, families, areas, noKey])

  // Zoom to area
  useEffect(() => {
    if (!selectedArea || !mapRef.current) return
    setSelectedStreet('')
    const map = mapRef.current
    const G   = window.google.maps
    const areaObj = areas.find(a => a.name === selectedArea)

    if (areaObj?.boundaryJson) {
      const result = boundaryCentroidAndBounds(areaObj.boundaryJson)
      if (result) {
        map.fitBounds(new G.LatLngBounds(
          { lat: result.bounds.south, lng: result.bounds.west },
          { lat: result.bounds.north, lng: result.bounds.east }
        ))
        return
      }
    }
    // Fallback: Nominatim
    setZooming(true)
    geocodePlace(`${selectedArea}, Egypt`).then(coords => {
      if (coords) { map.panTo(coords); map.setZoom(14) }
      setZooming(false)
    })
  }, [selectedArea])

  // Zoom to street
  useEffect(() => {
    if (!selectedStreet || !mapRef.current) return
    const map = mapRef.current
    setZooming(true)
    geocodePlace(`${selectedStreet}, Egypt`).then(coords => {
      if (coords) { map.panTo(coords); map.setZoom(17) }
      setZooming(false)
    })
  }, [selectedStreet])

  const areaObj  = areas.find(a => a.name === selectedArea)
  const streets  = areaObj?.streets ?? []
  const withCoords    = families.filter(f => f.latitude && f.longitude)
  const withoutCoords = families.filter(f => !f.latitude || !f.longitude)

  return (
    <div>
      <Header />
      <div className="container" style={{ maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1f2937' }}>
            {t('map.title')}
          </h2>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {t('map.familiesOnMap', { n: withCoords.length })}
            {withoutCoords.length > 0 && ` · ${t('map.withoutCoords', { n: withoutCoords.length })}`}
          </div>
        </div>

        {/* Area / Street filter bar */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12,
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '10px 14px', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px' }}>
            <span style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{t('map.area')}</span>
            <select
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
              style={{ flex: 1, fontSize: '0.88rem' }}
            >
              <option value="">{t('map.allAreas')}</option>
              {areas.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px' }}>
            <span style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{t('map.street')}</span>
            <select
              value={selectedStreet}
              onChange={e => setSelectedStreet(e.target.value)}
              disabled={!selectedArea || streets.length === 0}
              style={{ flex: 1, fontSize: '0.88rem' }}
            >
              <option value="">
                {!selectedArea ? t('map.pickAreaFirst') : streets.length === 0 ? t('map.noStreets') : t('map.allStreets')}
              </option>
              {streets.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {(selectedArea || selectedStreet) && (
            <button
              onClick={() => { setSelectedArea(''); setSelectedStreet('') }}
              style={{
                background: 'none', border: '1px solid #d1d5db', borderRadius: 6,
                padding: '4px 12px', fontSize: '0.82rem', cursor: 'pointer', color: '#6b7280',
                whiteSpace: 'nowrap',
              }}
            >
              {t('map.clearFilter')}
            </button>
          )}

          {zooming && (
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>جاري التحديد…</span>
          )}
        </div>

        {noKey && (
          <div style={{
            padding: '10px 16px', background: '#fef9c3', border: '1px solid #fde68a',
            borderRadius: 8, marginBottom: 12, fontSize: '0.88rem', color: '#78350f'
          }}>
            لم يتم تعيين مفتاح Google Maps — أضف <code>GOOGLE_MAPS_API_KEY</code> في ملف docker-compose.yml ثم أعد تشغيل الحاوية.
          </div>
        )}

        <div style={{ position: 'relative', height: '65vh', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          {(!mapsLoaded && !noKey) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{t('map.loading')}</span>
            </div>
          )}
          {noKey && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>لا توجد خريطة بدون مفتاح API</span>
            </div>
          )}
        </div>

        {withoutCoords.length > 0 && (
          <div style={{
            marginTop: 16, background: 'white', border: '1px solid #e5e7eb',
            borderRadius: 12, padding: 16
          }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 700, color: '#6b7280' }}>
              {t('map.withoutCoordsTitle')} ({withoutCoords.length})
            </h4>
            <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#9ca3af' }}>
              {t('map.withoutCoordsHint')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {withoutCoords.map(f => (
                <span key={f.id} style={{
                  padding: '4px 10px', background: '#f1f5f9',
                  borderRadius: 6, fontSize: '0.82rem', color: '#374151',
                  border: '1px solid #e2e8f0'
                }}>
                  {f.familyName}{f.area ? ` · ${f.area}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
