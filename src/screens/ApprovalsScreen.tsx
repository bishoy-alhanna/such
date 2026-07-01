import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'

interface PendingUser {
  id: string; username: string; displayName?: string; createdAt: string; roleName?: string
}
interface Role { id: string; name: string; description?: string }
interface PendingScore {
  id: string; memberId: string; memberName: string | null; categoryId: string
  categoryName: string | null; date: string; note: string | null
  status: string; submittedAt: string; submittedByName: string | null
}
interface PendingUpdate {
  id: string; memberId: string; memberName: string | null; changesJson: string
  status: string; submittedAt: string; submittedByName: string | null
}

type Tab = 'users' | 'scores' | 'profiles'

const ROLE_AR: Record<string, string> = {
  SuperAdmin: 'مدير النظام', Priest: 'كاهن', SeniorPriest: 'الأب الكاهن',
  ServiceLeader: 'رئيس الخدمة', Servant: 'خادم', DataEntry: 'إدخال بيانات', Member: 'عضو',
}

const FIELD_LABELS: Record<string, string> = {
  mobile: 'هاتف', gender: 'جنس', dateOfBirth: 'تاريخ ميلاد',
  occupationStatus: 'حالة عمل', studyYear: 'سنة دراسية', college: 'كلية',
  jobTitle: 'وظيفة', jobDetails: 'تفاصيل عمل', qualification: 'مؤهل',
  church: 'كنيسة', confessionFather: 'أب اعتراف', notes: 'ملاحظات',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
}
function parseChanges(json: string): Record<string, string> {
  try { return JSON.parse(json) ?? {} } catch { return {} }
}

export default function ApprovalsScreen() {
  const navigation = useNavigation<any>()
  const [tab, setTab]         = useState<Tab>('users')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  const [pendingUsers,   setPendingUsers]   = useState<PendingUser[]>([])
  const [pendingScores,  setPendingScores]  = useState<PendingScore[]>([])
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([])
  const [roles,          setRoles]          = useState<Role[]>([])
  const [approveRoleId,  setApproveRoleId]  = useState<Record<string, string>>({})
  const [reviewNote,     setReviewNote]     = useState<Record<string, string>>({})

  // Role picker modal for user approvals
  const [roleModal,     setRoleModal]     = useState(false)
  const [roleModalUser, setRoleModalUser] = useState<PendingUser | null>(null)

  const load = useCallback(async () => {
    try {
      const [usersR, rolesR, scoresR, updatesR] = await Promise.all([
        api.get<PendingUser[]>('/users/pending'),
        api.get<Role[]>('/roles'),
        api.get<PendingScore[]>('/scores/pending'),
        api.get<PendingUpdate[]>('/members/pending-updates'),
      ])
      setPendingUsers(usersR.data ?? [])
      setRoles(rolesR.data ?? [])
      const memberRole = (rolesR.data ?? []).find((r: Role) => r.name === 'Member')
      const defaults: Record<string, string> = {}
      ;(usersR.data ?? []).forEach((u: PendingUser) => {
        defaults[u.id] = memberRole?.id ?? rolesR.data?.[0]?.id ?? ''
      })
      setApproveRoleId(defaults)
      setPendingScores(scoresR.data ?? [])
      setPendingUpdates(updatesR.data ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const approveUser = async (u: PendingUser) => {
    const roleId = approveRoleId[u.id]
    if (!roleId) { Alert.alert('', 'يرجى اختيار الدور'); return }
    setProcessing(u.id)
    try {
      await api.post(`/users/${u.id}/approve`, { roleId })
      setPendingUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (e: any) { Alert.alert('خطأ', e?.response?.data?.message ?? 'حدث خطأ') }
    setProcessing(null)
  }

  const rejectUser = (u: PendingUser) => {
    Alert.alert('رفض الطلب', `رفض وحذف حساب "${u.username}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'رفض', style: 'destructive', onPress: async () => {
        setProcessing(u.id)
        try { await api.delete(`/users/${u.id}/reject`); setPendingUsers(prev => prev.filter(x => x.id !== u.id)) }
        catch { Alert.alert('خطأ', 'حدث خطأ') }
        setProcessing(null)
      }},
    ])
  }

  const approveScore = async (id: string) => {
    setProcessing(id)
    try {
      await api.post(`/scores/pending/${id}/approve`, { note: reviewNote[id] ?? null })
      setPendingScores(prev => prev.filter(s => s.id !== id))
    } catch { Alert.alert('خطأ', 'حدث خطأ') }
    setProcessing(null)
  }

  const rejectScore = async (id: string) => {
    const note = reviewNote[id]?.trim()
    if (!note) { Alert.alert('', 'يرجى كتابة سبب الرفض'); return }
    setProcessing(id)
    try {
      await api.post(`/scores/pending/${id}/reject`, { note })
      setPendingScores(prev => prev.filter(s => s.id !== id))
    } catch { Alert.alert('خطأ', 'حدث خطأ') }
    setProcessing(null)
  }

  const approveUpdate = async (id: string) => {
    setProcessing(id)
    try {
      await api.post(`/members/pending-updates/${id}/approve`, { note: reviewNote[id] ?? null })
      setPendingUpdates(prev => prev.filter(u => u.id !== id))
    } catch { Alert.alert('خطأ', 'حدث خطأ') }
    setProcessing(null)
  }

  const rejectUpdate = async (id: string) => {
    const note = reviewNote[id]?.trim()
    if (!note) { Alert.alert('', 'يرجى كتابة سبب الرفض'); return }
    setProcessing(id)
    try {
      await api.post(`/members/pending-updates/${id}/reject`, { note })
      setPendingUpdates(prev => prev.filter(u => u.id !== id))
    } catch { Alert.alert('خطأ', 'حدث خطأ') }
    setProcessing(null)
  }

  const totalPending = pendingUsers.length + pendingScores.length + pendingUpdates.length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'users',    label: 'التسجيل',   count: pendingUsers.length },
    { key: 'scores',   label: 'الدرجات',   count: pendingScores.length },
    { key: 'profiles', label: 'تعديل البيانات', count: pendingUpdates.length },
  ]

  return (
    <View style={s.root}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabContent}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {t.count > 0 && (
              <View style={[s.tabBadge, tab === t.key && s.tabBadgeActive]}>
                <Text style={[s.tabBadgeText, tab === t.key && s.tabBadgeTextActive]}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        >
          {/* ── Users tab ── */}
          {tab === 'users' && (
            pendingUsers.length === 0
              ? <EmptyState icon="checkmark-circle-outline" text="لا توجد طلبات تسجيل معلقة" />
              : pendingUsers.map(u => (
                <View key={u.id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={s.avatarCircle}>
                      <Text style={s.avatarLetter}>{(u.displayName ?? u.username).charAt(0)}</Text>
                    </View>
                    <View style={s.cardMeta}>
                      <Text style={s.cardTitle}>{u.displayName ?? u.username}</Text>
                      <Text style={s.cardSub}>@{u.username}</Text>
                      <Text style={s.cardDate}>سُجِّل في: {fmt(u.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Role picker */}
                  <TouchableOpacity
                    style={s.rolePicker}
                    onPress={() => { setRoleModalUser(u); setRoleModal(true) }}
                  >
                    <Text style={s.rolePickerText}>
                      {ROLE_AR[roles.find(r => r.id === approveRoleId[u.id])?.name ?? ''] ?? 'اختر الدور'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#6366f1" />
                  </TouchableOpacity>

                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={[s.approveBtn, processing === u.id && s.btnDisabled]}
                      onPress={() => approveUser(u)}
                      disabled={processing === u.id}
                    >
                      {processing === u.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.approveTxt}>✓ قبول</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.rejectBtn, processing === u.id && s.btnDisabled]}
                      onPress={() => rejectUser(u)}
                      disabled={processing === u.id}
                    >
                      <Text style={s.rejectTxt}>✕ رفض</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
          )}

          {/* ── Scores tab ── */}
          {tab === 'scores' && (
            pendingScores.length === 0
              ? <EmptyState icon="checkmark-circle-outline" text="لا توجد طلبات درجات معلقة" />
              : pendingScores.map(s => (
                <View key={s.id} style={ss.card}>
                  <TouchableOpacity onPress={() => navigation.navigate('MemberDetail', { id: s.memberId })}>
                    <Text style={ss.memberName}>{s.memberName ?? 'عضو'}</Text>
                  </TouchableOpacity>
                  <View style={ss.meta}>
                    <View style={ss.catBadge}><Text style={ss.catText}>{s.categoryName}</Text></View>
                    <Text style={ss.date}>{fmt(s.date)}</Text>
                  </View>
                  {s.note ? <Text style={ss.note}>"{s.note}"</Text> : null}
                  <Text style={ss.submitter}>قُدِّم بواسطة: {s.submittedByName ?? '—'}</Text>
                  <TextInput
                    style={ss.noteInput}
                    placeholder="ملاحظة (مطلوبة للرفض)"
                    placeholderTextColor="#9ca3af"
                    value={reviewNote[s.id] ?? ''}
                    onChangeText={v => setReviewNote(n => ({ ...n, [s.id]: v }))}
                    textAlign="right"
                  />
                  <View style={ss.actionRow}>
                    <TouchableOpacity style={[ss.approveBtn, processing === s.id && ss.btnDisabled]} onPress={() => approveScore(s.id)} disabled={processing === s.id}>
                      {processing === s.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.approveTxt}>✓ قبول</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={[ss.rejectBtn, processing === s.id && ss.btnDisabled]} onPress={() => rejectScore(s.id)} disabled={processing === s.id}>
                      <Text style={ss.rejectTxt}>✕ رفض</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
          )}

          {/* ── Profiles tab ── */}
          {tab === 'profiles' && (
            pendingUpdates.length === 0
              ? <EmptyState icon="checkmark-circle-outline" text="لا توجد طلبات تعديل معلقة" />
              : pendingUpdates.map(u => {
                const changes = parseChanges(u.changesJson)
                const entries = Object.entries(changes).filter(([, v]) => v != null && v !== '')
                return (
                  <View key={u.id} style={ss.card}>
                    <TouchableOpacity onPress={() => navigation.navigate('MemberDetail', { id: u.memberId })}>
                      <Text style={ss.memberName}>{u.memberName ?? 'عضو'}</Text>
                    </TouchableOpacity>
                    <Text style={ss.submitter}>قُدِّم بواسطة: {u.submittedByName ?? '—'} — {fmt(u.submittedAt)}</Text>
                    <View style={ss.changesGrid}>
                      {entries.map(([key, val]) => (
                        <View key={key} style={ss.changeItem}>
                          <Text style={ss.changeKey}>{FIELD_LABELS[key] ?? key}</Text>
                          <Text style={ss.changeVal}>{val}</Text>
                        </View>
                      ))}
                    </View>
                    <TextInput
                      style={ss.noteInput}
                      placeholder="ملاحظة (مطلوبة للرفض)"
                      placeholderTextColor="#9ca3af"
                      value={reviewNote[u.id] ?? ''}
                      onChangeText={v => setReviewNote(n => ({ ...n, [u.id]: v }))}
                      textAlign="right"
                    />
                    <View style={ss.actionRow}>
                      <TouchableOpacity style={[ss.approveBtn, processing === u.id && ss.btnDisabled]} onPress={() => approveUpdate(u.id)} disabled={processing === u.id}>
                        {processing === u.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={ss.approveTxt}>✓ قبول</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[ss.rejectBtn, processing === u.id && ss.btnDisabled]} onPress={() => rejectUpdate(u.id)} disabled={processing === u.id}>
                        <Text style={ss.rejectTxt}>✕ رفض</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })
          )}
        </ScrollView>
      )}

      {/* Role picker modal */}
      <Modal visible={roleModal} transparent animationType="fade" onRequestClose={() => setRoleModal(false)}>
        <TouchableOpacity style={rm.overlay} activeOpacity={1} onPress={() => setRoleModal(false)}>
          <View style={rm.sheet}>
            <Text style={rm.title}>اختر الدور</Text>
            {roles.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[rm.option, roleModalUser && approveRoleId[roleModalUser.id] === r.id && rm.optionActive]}
                onPress={() => {
                  if (roleModalUser) setApproveRoleId(prev => ({ ...prev, [roleModalUser.id]: r.id }))
                  setRoleModal(false)
                }}
              >
                <Text style={[rm.optionText, roleModalUser && approveRoleId[roleModalUser.id] === r.id && rm.optionTextActive]}>
                  {ROLE_AR[r.name] ?? r.name}
                </Text>
                {roleModalUser && approveRoleId[roleModalUser.id] === r.id && (
                  <Ionicons name="checkmark" size={16} color="#6366f1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function EmptyState({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={empty.wrap}>
      <Ionicons name={icon} size={48} color="#d1d5db" />
      <Text style={empty.text}>{text}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f8fafc' },
  tabBar:          { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabContent:      { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  tabActive:       { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tabText:         { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive:   { color: '#fff', fontWeight: '700' },
  tabBadge:        { backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText:    { fontSize: 11, color: '#6b7280', fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },
  body:            { flex: 1 },
  bodyContent:     { padding: 14, paddingBottom: 40 },
  card:            { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardTop:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarCircle:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  avatarLetter:    { fontSize: 18, fontWeight: '800', color: '#6366f1' },
  cardMeta:        { flex: 1, alignItems: 'flex-end', gap: 2 },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  cardSub:         { fontSize: 12, color: '#6b7280' },
  cardDate:        { fontSize: 11, color: '#9ca3af' },
  rolePicker:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  rolePickerText:  { fontSize: 14, color: '#374151', fontWeight: '500' },
  actionRow:       { flexDirection: 'row', gap: 8 },
  approveBtn:      { flex: 1, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  rejectBtn:       { flex: 1, backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approveTxt:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectTxt:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled:     { opacity: 0.6 },
})

const ss = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2, gap: 6 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  meta:       { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  catBadge:   { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  catText:    { fontSize: 12, fontWeight: '600', color: '#7c3aed' },
  date:       { fontSize: 12, color: '#6b7280' },
  note:       { fontSize: 13, color: '#374151', fontStyle: 'italic', textAlign: 'right' },
  submitter:  { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  noteInput:  { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827', marginTop: 4 },
  actionRow:  { flexDirection: 'row', gap: 8, marginTop: 4 },
  approveBtn: { flex: 1, backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  rejectBtn:  { flex: 1, backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approveTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled:{ opacity: 0.6 },
  changesGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  changeItem: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', padding: 8, minWidth: '45%', flex: 1 },
  changeKey:  { fontSize: 11, color: '#6b7280', marginBottom: 2, textAlign: 'right' },
  changeVal:  { fontSize: 13, fontWeight: '600', color: '#1f2937', textAlign: 'right' },
})

const rm = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 4 },
  title:           { fontSize: 16, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 12 },
  option:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  optionActive:    { backgroundColor: '#ede9fe' },
  optionText:      { fontSize: 15, color: '#374151' },
  optionTextActive:{ color: '#6366f1', fontWeight: '700' },
})

const empty = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  text: { fontSize: 15, color: '#9ca3af', textAlign: 'center' },
})
