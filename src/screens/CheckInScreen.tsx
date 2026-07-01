import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Vibration,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface SearchResult {
  id: string
  fullName: string
  familyName: string
  checkedInMass: boolean
  checkedInSchool: boolean
}

interface CheckInRecord {
  id: string
  memberName: string
  familyName: string
  attendanceType: string
  checkedInAt: string
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function extractUUID(raw: string): string | null {
  // bare UUID
  if (UUID_RE.test(raw)) {
    const m = raw.match(UUID_RE)
    return m ? m[0] : null
  }
  // URL with ?member=... or ?id=...
  try {
    const url = new URL(raw)
    return url.searchParams.get('member') ?? url.searchParams.get('id')
  } catch {
    return null
  }
}

type AttendanceType = 'Mass' | 'SundaySchool'
const TYPE_LABELS: Record<AttendanceType, string> = {
  Mass: '⛪ القداس',
  SundaySchool: '📚 مدارس الأحد',
}

export default function CheckInScreen() {
  const [type, setType]           = useState<AttendanceType>('Mass')
  const [scanning, setScanning]   = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [today, setToday]         = useState<CheckInRecord[]>([])
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)
  const lastScan                  = useRef<string>('')
  const lastScanTime              = useRef(0)
  const searchTimer               = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [permission, requestPermission] = useCameraPermissions()

  // Category IDs for attendance scores (fetched once, keyed by attendance type)
  const scoreCatIds = useRef<Partial<Record<AttendanceType, string>>>({})

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/score-categories')
      .then(r => {
        const mass   = r.data.find(c => c.name === 'القداس')
        const school = r.data.find(c => c.name === 'الاجتماع')
        if (mass)   scoreCatIds.current.Mass         = mass.id
        if (school) scoreCatIds.current.SundaySchool = school.id
      })
      .catch(() => {})
  }, [])

  const loadToday = useCallback(async () => {
    try {
      const r = await api.get<CheckInRecord[]>('/checkin/today', { params: { type } })
      setToday(r.data.filter((x) => x.attendanceType === type))
    } catch { setToday([]) }
  }, [type])

  useEffect(() => { loadToday() }, [loadToday])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.length < 2) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get<SearchResult[]>('/checkin/search', { params: { q: query } })
        setResults(r.data)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [query])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const doCheckIn = async (memberId: string, name?: string) => {
    try {
      const r = await api.post<{ memberName: string }>('/checkin', { memberId, type })
      Vibration.vibrate(80)
      showToast(`✓ ${r.data.memberName ?? name ?? 'تم'} — حضور مسجل`, true)
      setQuery(''); setResults([])
      loadToday()
      // Best-effort: record attendance score for this type
      const catId = scoreCatIds.current[type]
      if (catId) {
        api.post('/scores', {
          memberId,
          categoryId: catId,
          scoreValue: 1,
          date:       new Date().toISOString(),
          description: type === 'Mass' ? 'حضور القداس' : 'حضور الاجتماع',
        }).catch(() => {})
      }
    } catch (err: any) {
      const status = err?.response?.status
      const memberName = name ?? ''
      if (status === 409) showToast(`⚠️ ${memberName} مسجل مسبقاً`, false)
      else if (status === 404) showToast('❌ العضو غير موجود', false)
      else showToast('حدث خطأ، حاول مرة أخرى', false)
    }
  }

  const handleBarcode = ({ data }: { data: string }) => {
    const now = Date.now()
    if (data === lastScan.current && now - lastScanTime.current < 2000) return
    const uuid = extractUUID(data)
    if (!uuid) return
    lastScan.current = data
    lastScanTime.current = now
    setScanning(false)
    doCheckIn(uuid)
  }

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission()
      if (!res.granted) { Alert.alert('تحتاج إذن الكاميرا لمسح رمز QR'); return }
    }
    setScanning(true)
  }

  const undoCheckIn = async (id: string) => {
    try { await api.delete(`/checkin/${id}`); loadToday() }
    catch { showToast('تعذر التراجع', false) }
  }

  const todayCount = today.length

  return (
    <View style={s.root}>
      {/* Toast */}
      {toast && (
        <View style={[s.toast, { backgroundColor: toast.ok ? '#16a34a' : '#dc2626' }]}>
          <Text style={s.toastText}>{toast.msg}</Text>
        </View>
      )}

      {/* Scanner overlay */}
      {scanning && (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcode}
          />
          <View style={s.scanOverlay}>
            <View style={s.scanFrame} />
            <Text style={s.scanHint}>وجّه الكاميرا نحو رمز QR الخاص بالعضو</Text>
            {/* Manual fallback — works on simulator and as a backup on real device */}
            <View style={s.manualBox}>
              <Text style={s.manualLabel}>أو أدخل رقم العضو يدوياً</Text>
              <TextInput
                style={s.manualInput}
                placeholder="UUID أو رمز العضو"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={({ nativeEvent: { text } }) => {
                  const uuid = extractUUID(text.trim())
                  if (uuid) { setScanning(false); doCheckIn(uuid) }
                  else Alert.alert('', 'رمز غير صالح')
                }}
              />
            </View>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={() => setScanning(false)}>
            <Ionicons name="close-circle" size={44} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Type selector */}
      <View style={s.typeSel}>
        {(['Mass', 'SundaySchool'] as AttendanceType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.typeBtn, type === t && s.typeBtnActive]}
            onPress={() => { setType(t); setQuery(''); setResults([]) }}
          >
            <Text style={[s.typeBtnText, type === t && s.typeBtnTextActive]}>{TYPE_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search row */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث باسم العضو…"
          placeholderTextColor="#9ca3af"
          textAlign="right"
          autoCorrect={false}
        />
        <TouchableOpacity style={s.scanBtn} onPress={openScanner}>
          <Ionicons name="qr-code-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search results dropdown */}
      {searching && <ActivityIndicator color="#6366f1" style={{ marginTop: 8 }} />}
      {results.length > 0 && (
        <View style={s.results}>
          {results.map(m => {
            const already = type === 'Mass' ? m.checkedInMass : m.checkedInSchool
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.resultRow, already && s.resultRowDone]}
                onPress={() => !already && doCheckIn(m.id, m.fullName)}
                disabled={already}
              >
                <View style={s.resultInfo}>
                  <Text style={s.resultName}>{m.fullName}</Text>
                  <Text style={s.resultFamily}>{m.familyName}</Text>
                </View>
                {already
                  ? <View style={s.doneBadge}><Text style={s.doneBadgeText}>✓ مسجل</Text></View>
                  : <View style={s.checkBadge}><Text style={s.checkBadgeText}>تسجيل</Text></View>
                }
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Today's count header */}
      <View style={s.todayHeader}>
        <View style={s.countBadge}><Text style={s.countText}>{todayCount}</Text></View>
        <Text style={s.todayTitle}>حضور اليوم — {TYPE_LABELS[type]}</Text>
      </View>

      {/* Today's list */}
      <FlatList
        data={today}
        keyExtractor={r => r.id}
        contentContainerStyle={s.todayList}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>لا يوجد حضور بعد</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.todayCard}>
            <View style={s.todayInfo}>
              <Text style={s.todayName}>{item.memberName}</Text>
              <Text style={s.todayTime}>
                {new Date(item.checkedInAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => undoCheckIn(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f8fafc' },
  toast:           { position: 'absolute', top: 16, left: 20, right: 20, zIndex: 999, borderRadius: 12, padding: 14, alignItems: 'center' },
  toastText:       { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  // Scanner
  scanOverlay:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.5)' },
  scanFrame:       { width: 220, height: 220, borderWidth: 3, borderColor: '#6366f1', borderRadius: 16 },
  scanHint:        { color: '#fff', marginTop: 20, fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
  manualBox:       { marginTop: 28, width: 260, alignItems: 'center', gap: 8 },
  manualLabel:     { color: '#cbd5e1', fontSize: 12 },
  manualInput:     { width: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14, textAlign: 'center' },
  closeBtn:        { position: 'absolute', top: 56, right: 20 },
  // Type selector
  typeSel:         { flexDirection: 'row', gap: 10, padding: 14 },
  typeBtn:         { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center' },
  typeBtnActive:   { borderColor: '#6366f1', backgroundColor: '#6366f1' },
  typeBtnText:     { fontWeight: '700', fontSize: 14, color: '#6b7280' },
  typeBtnTextActive: { color: '#fff' },
  // Search
  searchRow:       { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 6 },
  searchInput:     { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1f2937' },
  scanBtn:         { backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  // Results
  results:         { marginHorizontal: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  resultRow:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', justifyContent: 'space-between' },
  resultRowDone:   { backgroundColor: '#f0fdf4' },
  resultInfo:      { flex: 1, alignItems: 'flex-end', gap: 2 },
  resultName:      { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  resultFamily:    { fontSize: 11, color: '#9ca3af' },
  doneBadge:       { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  doneBadgeText:   { fontSize: 12, fontWeight: '700', color: '#16a34a' },
  checkBadge:      { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  checkBadgeText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  // Today header
  todayHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'flex-end' },
  todayTitle:      { fontSize: 13, fontWeight: '700', color: '#374151' },
  countBadge:      { backgroundColor: '#6366f1', borderRadius: 10, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText:       { color: '#fff', fontWeight: '800', fontSize: 13 },
  // Today list
  todayList:       { paddingHorizontal: 14, paddingBottom: 30 },
  emptyBox:        { alignItems: 'center', paddingVertical: 30 },
  emptyIcon:       { fontSize: 32, marginBottom: 8 },
  emptyText:       { color: '#9ca3af', fontSize: 14 },
  todayCard:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  todayInfo:       { alignItems: 'flex-end', gap: 2 },
  todayName:       { fontSize: 13, fontWeight: '700', color: '#15803d' },
  todayTime:       { fontSize: 11, color: '#9ca3af' },
})
