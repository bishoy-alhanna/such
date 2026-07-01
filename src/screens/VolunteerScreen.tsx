import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface Assignment {
  id: string; memberId: string; memberName?: string; role: string
  assignedDate?: string; notes?: string; isRecurring: boolean
}
interface HoursRecord {
  id: string; memberId: string; memberName?: string
  date: string; hours: number; activity: string; notes?: string
}

const ROLES    = ['Deacon', 'Reader', 'Cantor', 'Setup', 'Childcare', 'Hospitality', 'Other']
const ROLES_AR: Record<string, string> = { Deacon: 'شماس', Reader: 'قارئ', Cantor: 'مرتل', Setup: 'تجهيز', Childcare: 'رعاية', Hospitality: 'استقبال', Other: 'أخرى' }
const ROLE_COLOR: Record<string, string> = { Deacon: '#7c3aed', Reader: '#0891b2', Cantor: '#d97706', Setup: '#059669', Childcare: '#e11d48', Hospitality: '#6366f1', Other: '#6b7280' }

type Tab = 'roster' | 'hours'
const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']

export default function VolunteerScreen() {
  const { user }   = useAuth()
  const canManage  = ADMIN_ROLES.includes(user?.role ?? '')

  const [tab,         setTab]         = useState<Tab>('roster')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [hours,       setHours]       = useState<HoursRecord[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [roleFilter,  setRoleFilter]  = useState('')

  // Add assignment form
  const [showAssign,  setShowAssign]  = useState(false)
  const [aSearch,     setASearch]     = useState('')
  const [aResults,    setAResults]    = useState<{ id: string; fullName: string }[]>([])
  const [aSelMember,  setASelMember]  = useState<{ id: string; fullName: string } | null>(null)
  const [aRole,       setARole]       = useState('Deacon')
  const [aDate,       setADate]       = useState('')
  const [aNotes,      setANotes]      = useState('')
  const [aRecurring,  setARecurring]  = useState(false)
  const [aSaving,     setASaving]     = useState(false)

  // Add hours form
  const [showHours,   setShowHours]   = useState(false)
  const [hSearch,     setHSearch]     = useState('')
  const [hResults,    setHResults]    = useState<{ id: string; fullName: string }[]>([])
  const [hSelMember,  setHSelMember]  = useState<{ id: string; fullName: string } | null>(null)
  const [hDate,       setHDate]       = useState(new Date().toISOString().split('T')[0])
  const [hHours,      setHHours]      = useState('')
  const [hActivity,   setHActivity]   = useState('')
  const [hNotes,      setHNotes]      = useState('')
  const [hSaving,     setHSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'roster') {
        const r = await api.get<Assignment[]>('/volunteer', { params: { role: roleFilter || undefined } })
        setAssignments(Array.isArray(r.data) ? r.data : [])
      } else {
        const r = await api.get<HoursRecord[]>('/volunteer/service-hours')
        setHours(Array.isArray(r.data) ? r.data : [])
      }
    } catch {}
    setLoading(false)
  }, [tab, roleFilter])

  useEffect(() => { load() }, [tab, roleFilter])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const searchMembers = async (q: string, setter: any, resultSetter: any) => {
    setter(q)
    if (q.length < 2) return resultSetter([])
    try {
      const r = await api.get<{ items: { id: string; fullName: string }[] }>('/members/search', { params: { q, pageSize: 10 } })
      resultSetter(r.data.items ?? [])
    } catch {}
  }

  const handleSaveAssignment = async () => {
    if (!aSelMember) return Alert.alert('', 'اختر عضواً')
    setASaving(true)
    try {
      await api.post('/volunteer', { memberId: aSelMember.id, role: aRole, assignedDate: aDate || undefined, notes: aNotes || undefined, isRecurring: aRecurring })
      setShowAssign(false)
      setASelMember(null); setASearch(''); setAResults([]); setARole('Deacon'); setADate(''); setANotes(''); setARecurring(false)
      load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setASaving(false) }
  }

  const handleSaveHours = async () => {
    if (!hSelMember)  return Alert.alert('', 'اختر عضواً')
    if (!hHours || isNaN(Number(hHours))) return Alert.alert('', 'أدخل عدد الساعات')
    if (!hActivity.trim()) return Alert.alert('', 'أدخل النشاط')
    setHSaving(true)
    try {
      await api.post('/volunteer/service-hours', { memberId: hSelMember.id, date: hDate, hours: Number(hHours), activity: hActivity, notes: hNotes || undefined })
      setShowHours(false)
      setHSelMember(null); setHSearch(''); setHResults([]); setHDate(new Date().toISOString().split('T')[0]); setHHours(''); setHActivity(''); setHNotes('')
      load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setHSaving(false) }
  }

  const handleDeleteAssignment = (a: Assignment) => {
    Alert.alert('إزالة التعيين', `إزالة ${a.memberName}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إزالة', style: 'destructive', onPress: async () => {
        try { await api.delete(`/volunteer/${a.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الإزالة') }
      }},
    ])
  }

  const handleDeleteHours = (h: HoursRecord) => {
    Alert.alert('حذف ساعات الخدمة', 'حذف هذا السجل؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/volunteer/service-hours/${h.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const renderAssignment = ({ item }: { item: Assignment }) => {
    const color = ROLE_COLOR[item.role] ?? '#6b7280'
    return (
      <View style={s.card}>
        <View style={[s.roleIcon, { backgroundColor: color + '18' }]}>
          <Text style={[s.roleIconText, { color }]}>{ROLES_AR[item.role]?.[0] ?? '?'}</Text>
        </View>
        <View style={s.cardBody}>
          <Text style={s.memberName}>{item.memberName ?? '—'}</Text>
          <View style={s.cardRow}>
            <Text style={[s.roleBadge, { color, borderColor: color + '40', backgroundColor: color + '12' }]}>{ROLES_AR[item.role] ?? item.role}</Text>
            {item.assignedDate && <Text style={s.dateText}>{new Date(item.assignedDate).toLocaleDateString('ar-EG')}</Text>}
          </View>
          {item.notes && <Text style={s.notesText} numberOfLines={1}>{item.notes}</Text>}
          {item.isRecurring && <Text style={s.recurText}>متكرر</Text>}
        </View>
        {canManage && (
          <TouchableOpacity onPress={() => handleDeleteAssignment(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  const renderHours = ({ item }: { item: HoursRecord }) => (
    <View style={s.card}>
      <View style={[s.roleIcon, { backgroundColor: '#e0e7ff' }]}>
        <Text style={[s.roleIconText, { color: '#6366f1' }]}>{item.hours}س</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.memberName}>{item.memberName ?? '—'}</Text>
        <Text style={s.activityText}>{item.activity}</Text>
        <Text style={s.dateText}>{new Date(item.date).toLocaleDateString('ar-EG')}</Text>
        {item.notes && <Text style={s.notesText} numberOfLines={1}>{item.notes}</Text>}
      </View>
      {canManage && (
        <TouchableOpacity onPress={() => handleDeleteHours(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  )

  const MemberPicker = ({ search, setSearch, results, setResults, selMember, setSelMember }: any) => (
    <>
      {selMember ? (
        <TouchableOpacity style={s.selectedChip} onPress={() => { setSelMember(null); setSearch(''); setResults([]) }}>
          <Ionicons name="close-circle" size={16} color="#6366f1" />
          <Text style={s.selectedChipText}>{selMember.fullName}</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TextInput style={s.input} value={search} onChangeText={(q: string) => searchMembers(q, setSearch, setResults)} placeholder="ابحث باسم العضو..." placeholderTextColor="#9ca3af" textAlign="right" />
          {results.map((m: any) => (
            <TouchableOpacity key={m.id} style={s.memberOpt} onPress={() => { setSelMember(m); setResults([]) }}>
              <Text style={s.memberOptText}>{m.fullName}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </>
  )

  return (
    <View style={s.root}>
      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, tab === 'roster' && s.tabBtnActive]} onPress={() => setTab('roster')}>
          <Text style={[s.tabBtnText, tab === 'roster' && s.tabBtnTextActive]}>التعيينات</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'hours' && s.tabBtnActive]} onPress={() => setTab('hours')}>
          <Text style={[s.tabBtnText, tab === 'hours' && s.tabBtnTextActive]}>ساعات الخدمة</Text>
        </TouchableOpacity>
      </View>

      {/* Role filter (roster only) */}
      {tab === 'roster' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
          <TouchableOpacity style={[s.filterPill, !roleFilter && s.filterPillActive]} onPress={() => setRoleFilter('')}>
            <Text style={[s.filterPillText, !roleFilter && s.filterPillTextActive]}>الكل</Text>
          </TouchableOpacity>
          {ROLES.map(r => (
            <TouchableOpacity key={r} style={[s.filterPill, roleFilter === r && s.filterPillActive]} onPress={() => setRoleFilter(roleFilter === r ? '' : r)}>
              <Text style={[s.filterPillText, roleFilter === r && s.filterPillTextActive]}>{ROLES_AR[r]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList<any>
          data={tab === 'roster' ? assignments : hours}
          keyExtractor={(i: any) => i.id}
          renderItem={tab === 'roster' ? renderAssignment : renderHours}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>{tab === 'roster' ? 'لا توجد تعيينات' : 'لا توجد سجلات'}</Text>}
        />
      )}

      {canManage && (
        <TouchableOpacity style={s.fab} onPress={() => tab === 'roster' ? setShowAssign(true) : setShowHours(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Assignment Modal */}
      <Modal visible={showAssign} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAssign(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowAssign(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>تعيين خادم</Text>
            <TouchableOpacity onPress={handleSaveAssignment} disabled={aSaving}>
              {aSaving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>العضو</Text>
            <MemberPicker search={aSearch} setSearch={setASearch} results={aResults} setResults={setAResults} selMember={aSelMember} setSelMember={setASelMember} />
            <Text style={s.fieldLabel}>الدور</Text>
            <View style={s.gridPills}>
              {ROLES.map(r => (
                <TouchableOpacity key={r} style={[s.pill, aRole === r && s.pillActive]} onPress={() => setARole(r)}>
                  <Text style={[s.pillText, aRole === r && s.pillTextActive]}>{ROLES_AR[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLabel}>التاريخ</Text>
            <TextInput style={s.input} value={aDate} onChangeText={setADate} placeholder="YYYY-MM-DD (اختياري)" placeholderTextColor="#9ca3af" textAlign="right" />
            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={s.input} value={aNotes} onChangeText={setANotes} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" />
            <TouchableOpacity style={s.checkRow} onPress={() => setARecurring(p => !p)}>
              <View style={[s.check, aRecurring && s.checkActive]}>{aRecurring && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
              <Text style={s.checkLabel}>متكرر</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Hours Modal */}
      <Modal visible={showHours} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHours(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowHours(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>تسجيل ساعات خدمة</Text>
            <TouchableOpacity onPress={handleSaveHours} disabled={hSaving}>
              {hSaving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>العضو</Text>
            <MemberPicker search={hSearch} setSearch={setHSearch} results={hResults} setResults={setHResults} selMember={hSelMember} setSelMember={setHSelMember} />
            <Text style={s.fieldLabel}>التاريخ</Text>
            <TextInput style={s.input} value={hDate} onChangeText={setHDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />
            <Text style={s.fieldLabel}>عدد الساعات</Text>
            <TextInput style={s.input} value={hHours} onChangeText={setHHours} placeholder="مثال: 2.5" placeholderTextColor="#9ca3af" keyboardType="numeric" textAlign="right" />
            <Text style={s.fieldLabel}>النشاط</Text>
            <TextInput style={s.input} value={hActivity} onChangeText={setHActivity} placeholder="وصف النشاط..." placeholderTextColor="#9ca3af" textAlign="right" />
            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={s.input} value={hNotes} onChangeText={setHNotes} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#f8fafc' },
  tabBar:            { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabBtn:            { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:      { borderBottomColor: '#6366f1' },
  tabBtnText:        { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  tabBtnTextActive:  { color: '#6366f1', fontWeight: '700' },
  filterBar:         { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterContent:     { flexDirection: 'row', gap: 8, padding: 10 },
  filterPill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterPillActive:  { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterPillText:    { fontSize: 13, color: '#6b7280' },
  filterPillTextActive:{ color: '#fff', fontWeight: '600' },
  list:              { padding: 12, paddingBottom: 90 },
  card:              { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  roleIcon:          { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleIconText:      { fontSize: 14, fontWeight: '800' },
  cardBody:          { flex: 1, alignItems: 'flex-end', gap: 4 },
  memberName:        { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  cardRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge:         { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  activityText:      { fontSize: 13, color: '#6366f1', textAlign: 'right' },
  dateText:          { fontSize: 12, color: '#9ca3af' },
  notesText:         { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  recurText:         { fontSize: 11, color: '#d97706', fontWeight: '600' },
  empty:             { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:               { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:        { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:       { fontSize: 15, color: '#9ca3af' },
  modalSave:         { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:         { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:             { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', marginBottom: 4 },
  memberOpt:         { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  memberOptText:     { fontSize: 14, color: '#374151', textAlign: 'right' },
  selectedChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ede9fe', borderRadius: 10, padding: 10, marginBottom: 4 },
  selectedChipText:  { flex: 1, fontSize: 14, color: '#6366f1', fontWeight: '600', textAlign: 'right' },
  gridPills:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:              { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive:        { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:          { fontSize: 13, color: '#6b7280' },
  pillTextActive:    { color: '#fff', fontWeight: '600' },
  checkRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  check:             { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  checkActive:       { backgroundColor: '#6366f1' },
  checkLabel:        { fontSize: 14, color: '#374151' },
})
