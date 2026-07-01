import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface ClassItem { id: string; className: string; memberCount: number }
interface Member    { id: string; fullName: string; familyName?: string }
interface AttRec    { memberId: string; isPresent: boolean }

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function getWeekDates(): string[] {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d); dd.setDate(d.getDate() - i)
    return dd.toISOString().slice(0, 10)
  })
}

export default function AttendanceScreen() {
  const [classes, setClasses]       = useState<ClassItem[]>([])
  const [selClass, setSelClass]     = useState<ClassItem | null>(null)
  const [selDate, setSelDate]       = useState(todayISO())
  const [members, setMembers]       = useState<Member[]>([])
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [loadingCls, setLoadingCls] = useState(true)
  const [loadingMem, setLoadingMem] = useState(false)
  const [saving, setSaving]         = useState(false)

  const weekDates = getWeekDates()

  useEffect(() => {
    api.get<{ items: ClassItem[] }>('/classes?pageSize=100')
      .then(r => setClasses(r.data.items ?? []))
      .catch(() => {})
      .finally(() => setLoadingCls(false))
  }, [])

  const loadMembers = useCallback(async () => {
    if (!selClass) return
    setLoadingMem(true)
    try {
      // Load enrolled members
      const [mRes, aRes] = await Promise.all([
        api.get<{ members: Member[] }>(`/classes/${selClass.id}`),
        api.get<AttRec[]>('/attendance', { params: { classId: selClass.id, date: selDate, pageSize: 200 } }).catch(() => ({ data: [] as AttRec[] })),
      ])
      const memberList: Member[] = mRes.data.members ?? []
      setMembers(memberList)
      // Build attendance map: if record exists and present → true, else false
      const aMap: Record<string, boolean> = {}
      memberList.forEach(m => aMap[m.id] = false)
      const aData = Array.isArray(aRes.data) ? aRes.data : (aRes.data as any)?.items ?? []
      aData.forEach((r: AttRec) => { aMap[r.memberId] = r.isPresent })
      setAttendance(aMap)
    } catch {}
    setLoadingMem(false)
  }, [selClass, selDate])

  useEffect(() => { loadMembers() }, [loadMembers])

  const toggle = (id: string) =>
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }))

  const selectAll = () => {
    const allTrue = members.every(m => attendance[m.id])
    const next: Record<string, boolean> = {}
    members.forEach(m => next[m.id] = !allTrue)
    setAttendance(next)
  }

  const save = async () => {
    if (!selClass) return
    setSaving(true)
    try {
      const records = members.map(m => ({ memberId: m.id, isPresent: attendance[m.id] ?? false }))
      await api.post('/attendance/bulk', { classId: selClass.id, date: selDate, records, attendanceType: 'SundaySchool' })
      Alert.alert('✅', 'تم حفظ الحضور')
    } catch {
      Alert.alert('خطأ', 'تعذر حفظ الحضور')
    }
    setSaving(false)
  }

  const presentCount = members.filter(m => attendance[m.id]).length

  if (loadingCls) return <ActivityIndicator size="large" color="#6366f1" style={{ flex: 1, marginTop: 60 }} />

  // Step 1: pick a class
  if (!selClass) {
    return (
      <View style={s.root}>
        <Text style={s.stepTitle}>اختر الفصل</Text>
        <FlatList
          data={classes}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>لا توجد فصول مسندة إليك</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.classCard} onPress={() => setSelClass(item)}>
              <View style={s.classInfo}>
                <Text style={s.className}>{item.className}</Text>
                <Text style={s.classMeta}>{item.memberCount ?? '—'} عضو</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        />
      </View>
    )
  }

  // Step 2: pick date + mark attendance
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => setSelClass(null)} style={s.backBtn}>
          <Ionicons name="arrow-forward" size={20} color="#6366f1" />
          <Text style={s.backText}>{selClass.className}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={s.saveBtnText}>{saving ? '…' : 'حفظ'}</Text>
        </TouchableOpacity>
      </View>

      {/* Date scroll */}
      <FlatList
        horizontal
        data={weekDates}
        keyExtractor={d => d}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dateList}
        renderItem={({ item }) => {
          const isToday = item === todayISO()
          const isSel   = item === selDate
          return (
            <TouchableOpacity
              style={[s.dateChip, isSel && s.dateChipSel]}
              onPress={() => setSelDate(item)}
            >
              <Text style={[s.dateText, isSel && s.dateTextSel]}>
                {new Date(item + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'short' })}
              </Text>
              <Text style={[s.dateDayText, isSel && s.dateTextSel]}>
                {new Date(item + 'T12:00:00').getDate()}
              </Text>
              {isToday && <View style={s.todayDot} />}
            </TouchableOpacity>
          )
        }}
      />

      {/* Present count + select all */}
      <View style={s.countRow}>
        <TouchableOpacity onPress={selectAll} style={s.selAllBtn}>
          <Text style={s.selAllText}>{members.every(m => attendance[m.id]) ? 'إلغاء الكل' : 'تحديد الكل'}</Text>
        </TouchableOpacity>
        <Text style={s.countText}>
          <Text style={{ color: '#16a34a', fontWeight: '800' }}>{presentCount}</Text>
          <Text style={{ color: '#9ca3af' }}> / {members.length} حاضر</Text>
        </Text>
      </View>

      {loadingMem ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={m => m.id}
          contentContainerStyle={s.memberList}
          ListEmptyComponent={<Text style={s.empty}>لا يوجد أعضاء في هذا الفصل</Text>}
          renderItem={({ item }) => {
            const present = attendance[item.id] ?? false
            return (
              <TouchableOpacity style={s.memberRow} onPress={() => toggle(item.id)}>
                <View style={[s.checkbox, present && s.checkboxOn]}>
                  {present && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <View style={s.memberInfo}>
                  <Text style={[s.memberName, present && s.memberNamePresent]}>{item.fullName}</Text>
                  {item.familyName && <Text style={s.memberFamily}>{item.familyName}</Text>}
                </View>
                <View style={[s.statusBadge, present ? s.statusPresent : s.statusAbsent]}>
                  <Text style={[s.statusText, present ? s.statusPresentText : s.statusAbsentText]}>
                    {present ? 'حاضر' : 'غائب'}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f8fafc' },
  list:             { padding: 14 },
  stepTitle:        { fontSize: 16, fontWeight: '700', color: '#374151', textAlign: 'right', padding: 16, paddingBottom: 8 },
  classCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  classInfo:        { flex: 1, alignItems: 'flex-end' },
  className:        { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  classMeta:        { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  empty:            { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  // Header
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingTop: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText:         { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  saveBtn:          { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Date strip
  dateList:         { padding: 12, gap: 8 },
  dateChip:         { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', minWidth: 56 },
  dateChipSel:      { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  dateText:         { fontSize: 11, color: '#9ca3af' },
  dateTextSel:      { color: '#fff' },
  dateDayText:      { fontSize: 18, fontWeight: '800', color: '#1f2937', marginTop: 2 },
  todayDot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: '#6366f1', marginTop: 3 },
  // Count row
  countRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  countText:        { fontSize: 14 },
  selAllBtn:        { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#ede9fe' },
  selAllText:       { fontSize: 13, fontWeight: '600', color: '#7c3aed' },
  // Members
  memberList:       { paddingHorizontal: 14, paddingVertical: 8, paddingBottom: 30 },
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  checkbox:         { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn:       { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  memberInfo:       { flex: 1, alignItems: 'flex-end', gap: 2 },
  memberName:       { fontSize: 14, fontWeight: '600', color: '#374151' },
  memberNamePresent:{ color: '#15803d' },
  memberFamily:     { fontSize: 11, color: '#9ca3af' },
  statusBadge:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusPresent:    { backgroundColor: '#f0fdf4' },
  statusAbsent:     { backgroundColor: '#fff7ed' },
  statusText:       { fontSize: 12, fontWeight: '600' },
  statusPresentText:{ color: '#16a34a' },
  statusAbsentText: { color: '#c2410c' },
})
