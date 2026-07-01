import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Platform, Linking, Alert, ScrollView, Animated,
} from 'react-native'
import MapView, { Marker, Polygon, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface FamilyPin {
  id: string; familyName: string; area?: string; address?: string
  latitude: number; longitude: number; members: string[]
}
interface MapArea {
  id: string; name: string; color: string
  boundaryJson?: string | null
  streets: { id: string; name: string }[]
}

// ── helpers ────────────────────────────────────────────────────────────────

async function openSingleNavigation(lat: number, lng: number, label: string) {
  const encoded = encodeURIComponent(label)
  const native = Platform.select({
    ios:     `maps://app?daddr=${lat},${lng}&q=${encoded}`,
    android: `google.navigation:q=${lat},${lng}`,
  })!
  const canOpen = await Linking.canOpenURL(native).catch(() => false)
  Linking.openURL(canOpen ? native : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
    .catch(() => Alert.alert('خطأ', 'تعذّر فتح تطبيق الخرائط'))
}

function openMultiStopNavigation(stops: FamilyPin[]) {
  if (stops.length === 0) return
  // Google Maps multi-stop URL (works on both platforms via browser if app not installed)
  const legs = stops.map(s => `${s.latitude},${s.longitude}`).join('/')
  const url = `https://www.google.com/maps/dir/${legs}`
  Linking.openURL(url).catch(() => Alert.alert('خطأ', 'تعذّر فتح تطبيق الخرائط'))
}

function nearestNeighbor(stops: FamilyPin[]): FamilyPin[] {
  if (stops.length < 3) return stops
  const remaining = [...stops]
  const result: FamilyPin[] = [remaining.shift()!]
  while (remaining.length) {
    const last = result[result.length - 1]
    let nearestIdx = 0
    let minDist = Infinity
    remaining.forEach((p, i) => {
      const d = Math.hypot(p.latitude - last.latitude, p.longitude - last.longitude)
      if (d < minDist) { minDist = d; nearestIdx = i }
    })
    result.push(remaining.splice(nearestIdx, 1)[0])
  }
  return result
}

// ── component ──────────────────────────────────────────────────────────────

export default function MapScreen() {
  const mapRef      = useRef<MapView>(null)
  const panelHeight = useRef(new Animated.Value(0)).current

  const [families,       setFamilies]       = useState<FamilyPin[]>([])
  const [areas,          setAreas]          = useState<MapArea[]>([])
  const [loading,        setLoading]        = useState(true)
  const [selectedArea,   setSelectedArea]   = useState<MapArea | null>(null)
  const [showAreaPicker, setShowAreaPicker] = useState(false)

  // Route planner state
  const [routeMode,  setRouteMode]  = useState(false)
  const [routeStops, setRouteStops] = useState<FamilyPin[]>([])
  const [optimized,  setOptimized]  = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<FamilyPin[]>('/families/map-data'),
      api.get<MapArea[]>('/areas'),
    ]).then(([f, a]) => {
      setFamilies(f.data.filter(x => x.latitude && x.longitude))
      setAreas(a.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Animate route panel in/out
  useEffect(() => {
    Animated.spring(panelHeight, {
      toValue: routeMode ? 1 : 0,
      useNativeDriver: false,
      tension: 65, friction: 11,
    }).start()
  }, [routeMode])

  const zoomToArea = (area: MapArea) => {
    setSelectedArea(area)
    setShowAreaPicker(false)
    if (!area.boundaryJson) return
    try {
      const pts: { lat: number; lng: number }[] = JSON.parse(area.boundaryJson)
      if (pts.length) mapRef.current?.fitToCoordinates(
        pts.map(p => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: 60, left: 40, bottom: 60, right: 40 }, animated: true }
      )
    } catch {}
  }

  const toggleStop = (pin: FamilyPin) => {
    setOptimized(false)
    setRouteStops(prev => {
      const idx = prev.findIndex(p => p.id === pin.id)
      return idx >= 0 ? prev.filter(p => p.id !== pin.id) : [...prev, pin]
    })
  }

  const optimize = () => {
    setRouteStops(prev => nearestNeighbor(prev))
    setOptimized(true)
    // Zoom to fit all stops
    if (routeStops.length > 1) {
      mapRef.current?.fitToCoordinates(
        routeStops.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
        { edgePadding: { top: 80, left: 40, bottom: 260, right: 40 }, animated: true }
      )
    }
  }

  const clearRoute = () => { setRouteStops([]); setOptimized(false) }

  const exitRouteMode = () => { setRouteMode(false); clearRoute() }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={{ color: '#9ca3af', marginTop: 12 }}>جاري تحميل الخريطة…</Text>
    </View>
  )

  const initialRegion = families.length > 0
    ? { latitude: families[0].latitude, longitude: families[0].longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 30.0626, longitude: 31.2497, latitudeDelta: 0.08, longitudeDelta: 0.08 }

  const panelMaxH = panelHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 280] })

  return (
    <View style={s.root}>
      <MapView
        ref={mapRef}
        style={s.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={!routeMode}
      >
        {/* Area polygons */}
        {areas.filter(a => a.boundaryJson).map(area => {
          try {
            const pts: { lat: number; lng: number }[] = JSON.parse(area.boundaryJson!)
            return (
              <Polygon key={area.id}
                coordinates={pts.map(p => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={area.color} strokeWidth={2} fillColor={area.color + '22'}
              />
            )
          } catch { return null }
        })}

        {/* Route polyline */}
        {routeMode && routeStops.length > 1 && (
          <Polyline
            coordinates={routeStops.map(s => ({ latitude: s.latitude, longitude: s.longitude }))}
            strokeColor="#6366f1"
            strokeWidth={4}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Family markers */}
        {families.map(f => {
          const stopIdx = routeStops.findIndex(s => s.id === f.id)
          const isSelected = stopIdx >= 0

          if (routeMode) {
            // Route mode: custom numbered marker, tap to toggle
            // Key includes stopIdx so native re-renders when selection changes
            return (
              <Marker
                key={`${f.id}-${stopIdx}`}
                coordinate={{ latitude: f.latitude, longitude: f.longitude }}
                onPress={() => toggleStop(f)}
              >
                <View style={[s.pinWrap, isSelected && s.pinWrapSel]}>
                  {isSelected
                    ? <Text style={s.pinNum}>{stopIdx + 1}</Text>
                    : <View style={s.pinDot} />
                  }
                </View>
              </Marker>
            )
          }

          // Normal mode: callout with navigate option
          return (
            <Marker
              key={f.id}
              coordinate={{ latitude: f.latitude, longitude: f.longitude }}
              pinColor="#6366f1"
              onCalloutPress={() => openSingleNavigation(f.latitude, f.longitude, f.familyName)}
            >
              <Callout tooltip={false}>
                <View style={s.callout}>
                  <View style={s.navBtn}>
                    <Ionicons name="navigate" size={13} color="#fff" />
                    <Text style={s.navBtnText}>اتجه إليها</Text>
                  </View>
                  <Text style={s.calloutTitle}>{f.familyName}</Text>
                  {f.area && (
                    <View style={s.calloutRow}>
                      <Ionicons name="location-outline" size={11} color="#9ca3af" />
                      <Text style={s.calloutSub}>{f.area}</Text>
                    </View>
                  )}
                  {f.address && (
                    <View style={s.calloutRow}>
                      <Ionicons name="map-outline" size={11} color="#9ca3af" />
                      <Text style={s.calloutSub} numberOfLines={1}>{f.address}</Text>
                    </View>
                  )}
                  {f.members?.length > 0 && (
                    <Text style={s.calloutMembers}>
                      {f.members.slice(0, 2).join(' · ')}
                      {f.members.length > 2 ? ` +${f.members.length - 2}` : ''}
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          )
        })}
      </MapView>

      {/* ── top bar ──────────────────────────────────────────────── */}
      <View style={s.topBar}>
        {!routeMode ? (
          <>
            <TouchableOpacity style={s.routeModeBtn} onPress={() => setRouteMode(true)}>
              <Ionicons name="git-branch-outline" size={16} color="#6366f1" />
              <Text style={s.routeModeBtnText}>خطة زيارات</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.filterBtn} onPress={() => setShowAreaPicker(p => !p)}>
              <Ionicons name="location-outline" size={16} color="#6366f1" />
              <Text style={s.filterBtnText}>{selectedArea ? selectedArea.name : 'منطقة'}</Text>
              <Ionicons name={showAreaPicker ? 'chevron-up' : 'chevron-down'} size={13} color="#9ca3af" />
            </TouchableOpacity>
            {selectedArea && (
              <TouchableOpacity style={s.iconBtn} onPress={() => setSelectedArea(null)}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity style={s.iconBtn} onPress={exitRouteMode}>
              <Ionicons name="close" size={20} color="#dc2626" />
            </TouchableOpacity>
            <Text style={s.routeModeLabel}>
              {routeStops.length === 0 ? 'اضغط على العائلات لإضافتها' : `${routeStops.length} محطة`}
            </Text>
            {routeStops.length > 0 && (
              <TouchableOpacity style={s.clearBtn2} onPress={clearRoute}>
                <Text style={s.clearBtn2Text}>مسح</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Area picker dropdown */}
      {showAreaPicker && !routeMode && (
        <View style={s.picker}>
          {areas.map(a => (
            <TouchableOpacity key={a.id} style={s.pickerItem} onPress={() => zoomToArea(a)}>
              <View style={[s.colorDot, { backgroundColor: a.color }]} />
              <Text style={s.pickerText}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── route planner panel ──────────────────────────────────── */}
      <Animated.View style={[s.routePanel, { maxHeight: panelMaxH }]}>
        {routeMode && (
          <>
            {/* Stop list */}
            <ScrollView
              horizontal={false}
              style={s.stopList}
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator={false}
            >
              {routeStops.length === 0 ? (
                <Text style={s.stopListEmpty}>اضغط على الدبابيس على الخريطة لإضافة محطات</Text>
              ) : (
                routeStops.map((stop, idx) => (
                  <View key={stop.id} style={s.stopRow}>
                    <TouchableOpacity onPress={() => toggleStop(stop)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color="#dc2626" />
                    </TouchableOpacity>
                    <View style={s.stopInfo}>
                      <Text style={s.stopName} numberOfLines={1}>{stop.familyName}</Text>
                      {stop.address && <Text style={s.stopAddr} numberOfLines={1}>{stop.address}</Text>}
                    </View>
                    <View style={s.stopNum}>
                      <Text style={s.stopNumText}>{idx + 1}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Action buttons */}
            {routeStops.length >= 2 && (
              <View style={s.routeActions}>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnSecondary, optimized && { opacity: 0.5 }]}
                  onPress={optimize}
                  disabled={optimized || routeStops.length < 3}
                >
                  <Ionicons name="shuffle" size={16} color="#6366f1" />
                  <Text style={s.actionBtnSecondaryText}>
                    {optimized ? '✓ محسّن' : 'تحسين الترتيب'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnPrimary]}
                  onPress={() => openMultiStopNavigation(routeStops)}
                >
                  <Ionicons name="navigate" size={16} color="#fff" />
                  <Text style={s.actionBtnPrimaryText}>بدء الملاحة</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </Animated.View>

      {/* Family count badge */}
      {!routeMode && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{families.length} عائلة</Text>
        </View>
      )}
    </View>
  )
}

// ── styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  map:    { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar:           { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeModeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  routeModeBtnText: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  filterBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  filterBtnText:    { flex: 1, fontSize: 13, color: '#374151', textAlign: 'right' },
  iconBtn:          { backgroundColor: '#fff', borderRadius: 10, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  routeModeLabel:   { flex: 1, fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'center', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
  clearBtn2:        { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  clearBtn2Text:    { fontSize: 12, fontWeight: '700', color: '#dc2626' },

  // Area picker
  picker:     { position: 'absolute', top: 60, left: 12, right: 12, backgroundColor: '#fff', borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6, zIndex: 10, maxHeight: 260 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colorDot:   { width: 12, height: 12, borderRadius: 6 },
  pickerText: { fontSize: 14, color: '#374151', flex: 1, textAlign: 'right' },

  // Family count badge
  badge:     { position: 'absolute', bottom: 24, left: 12, backgroundColor: '#6366f1', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Callout (normal mode)
  callout:        { width: 190, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  calloutTitle:   { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right', marginBottom: 4 },
  calloutRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginBottom: 2 },
  calloutSub:     { fontSize: 11, color: '#6b7280', textAlign: 'right', flex: 1 },
  calloutMembers: { fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 2, marginBottom: 6 },
  navBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#6366f1', borderRadius: 7, paddingVertical: 6, marginBottom: 8 },
  navBtnText:     { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Custom pins (route mode)
  pinWrap:    { width: 30, height: 30, borderRadius: 15, backgroundColor: '#cbd5e1', borderWidth: 2, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  pinWrapSel: { backgroundColor: '#6366f1', borderColor: '#4f46e5' },
  pinNum:     { color: '#fff', fontSize: 13, fontWeight: '800' },
  pinDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748b' },

  // Route panel
  routePanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, overflow: 'hidden' },
  stopList:       { maxHeight: 180, paddingHorizontal: 16, paddingTop: 16 },
  stopListEmpty:  { textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingVertical: 12 },
  stopRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  stopNum:        { width: 26, height: 26, borderRadius: 13, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stopNumText:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  stopInfo:       { flex: 1, alignItems: 'flex-end' },
  stopName:       { fontSize: 14, fontWeight: '600', color: '#1f2937', textAlign: 'right' },
  stopAddr:       { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 1 },
  routeActions:   { flexDirection: 'row', gap: 10, padding: 12, paddingTop: 8 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12 },
  actionBtnPrimary:       { backgroundColor: '#6366f1' },
  actionBtnPrimaryText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionBtnSecondary:     { backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#c4b5fd' },
  actionBtnSecondaryText: { color: '#6366f1', fontWeight: '700', fontSize: 14 },
})
