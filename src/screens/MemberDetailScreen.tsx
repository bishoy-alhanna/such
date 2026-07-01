import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Image, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute } from '@react-navigation/native'
import QRCode from 'react-native-qrcode-svg'
import { useAuth } from '../context/AuthContext'
import api, { getServerBaseUrl } from '../services/api'

interface ScoreSummary {
  totalScore: number; count: number; averageScore: number
  byCategory: { categoryId?: string; categoryName: string; totalScore: number }[]
}
interface MemberDetail {
  id: string; fullName: string; gender?: string; dateOfBirth?: string; mobile?: string
  nationalId?: string; relation?: string; occupationStatus?: string; jobTitle?: string
  jobDetails?: string; qualification?: string; studyYear?: string; college?: string
  church?: string; confessionFather?: string; serviceType?: string; isServant?: boolean
  status?: string; familyId?: string; photoUrl?: string | null
}
interface SpiritualRecord {
  id: string; type: string; date: string; notes?: string; recordedByName?: string
}
interface AttendanceRecord {
  id: string; attendanceType: string; date: string; notes?: string
}
interface Milestone {
  id: string; type: string; date: string; notes?: string; recordedByName?: string
}

const MILESTONE_TYPES = [
  { value: 'Baptism',         label: 'عماد',          icon: '💧' },
  { value: 'Chrismation',     label: 'ميرون',          icon: '🕊️' },
  { value: 'FirstCommunion',  label: 'أول تناول',     icon: '🍷' },
  { value: 'FirstConfession', label: 'أول اعتراف',    icon: '✝️' },
  { value: 'Wedding',         label: 'زواج',           icon: '💍' },
  { value: 'Ordination',      label: 'رسامة',          icon: '👐' },
  { value: 'Tonsure',         label: 'قصة شعر',        icon: '✂️' },
  { value: 'Consecration',    label: 'تكريس',          icon: '🕌' },
  { value: 'Other',           label: 'أخرى',           icon: '⭐' },
]
const MS_MAP = Object.fromEntries(MILESTONE_TYPES.map(t => [t.value, t]))

const TYPE_AR: Record<string, string>    = { Confession: 'اعتراف', Communion: 'تناول', Mass: 'قداس', Call: 'تواصل' }
const TYPE_COLOR: Record<string, string> = { Confession: '#7c3aed', Communion: '#dc2626', Mass: '#d97706', Call: '#0891b2' }
const ATT_AR: Record<string, string>     = { Mass: 'قداس', SundaySchool: 'مدارس الأحد' }
const GENDER_AR: Record<string, string>  = { Male: 'ذكر', Female: 'أنثى' }
const OCCUPATION_AR: Record<string, string> = { Working: 'يعمل', Student: 'طالب', Unemployed: 'غير عامل', Retired: 'متقاعد' }

const SERVANT_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader', 'Servant', 'DataEntry']
type Tab = 'info' | 'records' | 'milestones'

function Row({ icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={s.row}>
      <Text style={s.rowValue}>{value}</Text>
      <Text style={s.rowLabel}>{label}</Text>
      <Ionicons name={icon} size={15} color="#9ca3af" />
    </View>
  )
}

export default function MemberDetailScreen() {
  const route     = useRoute<any>()
  const { id }    = route.params
  const { user }  = useAuth()
  const isServant = SERVANT_ROLES.includes(user?.role ?? '')

  const [member,        setMember]        = useState<MemberDetail | null>(null)
  const [scoreSummary,  setScoreSummary]  = useState<ScoreSummary | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [showQR,        setShowQR]        = useState(false)
  const [tab,           setTab]           = useState<Tab>('info')

  // Records tab
  const [spiritual,     setSpiritual]     = useState<SpiritualRecord[]>([])
  const [attendance,    setAttendance]    = useState<AttendanceRecord[]>([])
  const [recLoaded,     setRecLoaded]     = useState(false)
  const [recLoading,    setRecLoading]    = useState(false)

  // Milestones tab
  const [milestones,    setMilestones]    = useState<Milestone[]>([])
  const [msLoaded,      setMsLoaded]      = useState(false)
  const [msLoading,     setMsLoading]     = useState(false)
  const [showMsForm,    setShowMsForm]    = useState(false)
  const [msType,        setMsType]        = useState('Baptism')
  const [msDate,        setMsDate]        = useState(new Date().toISOString().split('T')[0])
  const [msNote,        setMsNote]        = useState('')
  const [msSaving,      setMsSaving]      = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<MemberDetail>(`/members/${id}`),
      api.get<ScoreSummary>(`/scores/member/${id}/summary`).catch(() => null),
    ]).then(([memberR, scoreR]) => {
      setMember(memberR.data)
      if (scoreR) setScoreSummary(scoreR.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const loadRecords = useCallback(async () => {
    if (recLoaded) return
    setRecLoading(true)
    try {
      const [spR, attR] = await Promise.all([
        api.get<SpiritualRecord[]>(`/spiritual-records/by-member/${id}`),
        api.get<AttendanceRecord[]>(`/attendance/by-member/${id}`),
      ])
      setSpiritual(Array.isArray(spR.data) ? spR.data.slice(0, 30) : [])
      setAttendance(Array.isArray(attR.data) ? attR.data.slice(0, 30) : [])
      setRecLoaded(true)
    } catch {}
    setRecLoading(false)
  }, [id, recLoaded])

  const loadMilestones = useCallback(async () => {
    if (msLoaded) return
    setMsLoading(true)
    try {
      const r = await api.get<Milestone[]>(`/members/${id}/milestones`)
      setMilestones(Array.isArray(r.data) ? r.data : [])
      setMsLoaded(true)
    } catch {}
    setMsLoading(false)
  }, [id, msLoaded])

  useEffect(() => {
    if (tab === 'records')    loadRecords()
    if (tab === 'milestones') loadMilestones()
  }, [tab])

  const addMilestone = async () => {
    setMsSaving(true)
    try {
      const r = await api.post<Milestone>(`/members/${id}/milestones`, { type: msType, date: msDate, notes: msNote || undefined })
      setMilestones(prev => [...prev, r.data].sort((a, b) => a.date.localeCompare(b.date)))
      setShowMsForm(false); setMsNote('')
    } catch (e: any) { Alert.alert('خطأ', e?.response?.data?.message ?? 'تعذّر الحفظ') }
    finally { setMsSaving(false) }
  }

  const deleteMilestone = (msId: string) => {
    Alert.alert('حذف المحطة', 'هل تريد حذف هذه المحطة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/milestones/${msId}`); setMilestones(prev => prev.filter(m => m.id !== msId)) }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ flex: 1, marginTop: 60 }} />
  if (!member)  return <Text style={{ textAlign: 'center', marginTop: 60, color: '#9ca3af' }}>لا توجد بيانات</Text>

  const initials = (member.fullName ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('')
  const photoUri = member.photoUrl ? `${getServerBaseUrl()}${member.photoUrl}` : null

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          {photoUri ? <Image source={{ uri: photoUri }} style={s.avatarImg} /> : <Text style={s.avatarText}>{initials}</Text>}
        </View>
        <Text style={s.name}>{member.fullName}</Text>
        {member.relation && <Text style={s.role}>{member.relation}</Text>}
        {member.status   && <Text style={s.status}>{member.status}</Text>}
        <TouchableOpacity style={s.qrToggleBtn} onPress={() => setShowQR(v => !v)}>
          <Ionicons name={showQR ? 'close-outline' : 'qr-code-outline'} size={15} color="#6366f1" />
          <Text style={s.qrToggleTxt}>{showQR ? 'إخفاء الرمز' : 'رمز QR'}</Text>
        </TouchableOpacity>
        {showQR && (
          <View style={s.qrBox}>
            <QRCode value={member.id} size={160} color="#1f2937" backgroundColor="#ffffff" />
            <Text style={s.qrLabel}>{member.fullName}</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {([
          { key: 'info',       label: 'البيانات' },
          { key: 'records',    label: 'السجلات' },
          { key: 'milestones', label: 'المراحل' },
        ] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabBtnText, tab === t.key && s.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>

        {/* ── Info tab ── */}
        {tab === 'info' && (
          <>
            <View style={s.card}>
              <Text style={s.section}>المعلومات الشخصية</Text>
              <Row icon="person-outline"    label="الجنس"           value={member.gender ? GENDER_AR[member.gender] ?? member.gender : null} />
              <Row icon="calendar-outline"  label="تاريخ الميلاد"   value={member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString('ar-EG') : null} />
              <Row icon="card-outline"      label="الرقم القومي"     value={member.nationalId} />
              <Row icon="briefcase-outline" label="الحالة الوظيفية"  value={member.occupationStatus ? OCCUPATION_AR[member.occupationStatus] ?? member.occupationStatus : null} />
              <Row icon="hammer-outline"    label="المسمى الوظيفي"   value={member.jobTitle} />
              <Row icon="business-outline"  label="جهة العمل"        value={member.jobDetails} />
              <Row icon="school-outline"    label="المؤهل"           value={member.qualification} />
              <Row icon="book-outline"      label="السنة الدراسية"   value={member.studyYear} />
              <Row icon="library-outline"   label="الكلية"           value={member.college} />
            </View>

            <View style={s.card}>
              <Text style={s.section}>التواصل</Text>
              {member.mobile ? (
                <TouchableOpacity style={s.row} onPress={() => Linking.openURL(`tel:${member!.mobile}`)}>
                  <Text style={[s.rowValue, { color: '#6366f1' }]}>{member.mobile}</Text>
                  <Text style={s.rowLabel}>الهاتف</Text>
                  <Ionicons name="call-outline" size={15} color="#6366f1" />
                </TouchableOpacity>
              ) : <Text style={s.noData}>لا يوجد هاتف</Text>}
            </View>

            {(member.church || member.confessionFather) && (
              <View style={s.card}>
                <Text style={s.section}>الحياة الروحية</Text>
                <Row icon="business-outline" label="الكنيسة"     value={member.church} />
                <Row icon="person-outline"   label="أب الاعتراف" value={member.confessionFather} />
              </View>
            )}

            {member.isServant && (
              <View style={s.card}>
                <Text style={s.section}>الخدمة</Text>
                <Row icon="hand-left-outline" label="نوع الخدمة" value={member.serviceType} />
              </View>
            )}

            {scoreSummary && scoreSummary.count > 0 && (
              <View style={s.card}>
                <Text style={s.section}>النقاط</Text>
                <View style={s.scoreTotalRow}>
                  <View style={s.scoreMetaCol}>
                    <Text style={s.scoreCountTxt}>{scoreSummary.count} سجل</Text>
                    <Text style={s.scoreAvgTxt}>متوسط {scoreSummary.averageScore.toFixed(1)}</Text>
                  </View>
                  <View style={s.scoreBadge}>
                    <Text style={s.scoreBadgeNum}>{scoreSummary.totalScore}</Text>
                    <Text style={s.scoreBadgeLbl}>نقطة</Text>
                  </View>
                </View>
                {scoreSummary.byCategory.map((c, i) => (
                  <View key={c.categoryId ?? i} style={s.catRow}>
                    <Text style={s.catScore}>{c.totalScore}</Text>
                    <Text style={s.catName} numberOfLines={1}>{c.categoryName}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Records tab ── */}
        {tab === 'records' && (
          <>
            {recLoading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 30 }} />
            ) : (
              <>
                {/* Spiritual records */}
                <Text style={s.sectionHeader}>السجلات الروحية</Text>
                {spiritual.length === 0 ? (
                  <Text style={s.noData}>لا توجد سجلات روحية</Text>
                ) : (
                  spiritual.map(r => (
                    <View key={r.id} style={s.recCard}>
                      <View style={[s.recIcon, { backgroundColor: (TYPE_COLOR[r.type] ?? '#6b7280') + '18' }]}>
                        <Ionicons name="star-outline" size={14} color={TYPE_COLOR[r.type] ?? '#6b7280'} />
                      </View>
                      <View style={s.recBody}>
                        <Text style={s.recType}>{TYPE_AR[r.type] ?? r.type}</Text>
                        <Text style={s.recDate}>{new Date(r.date).toLocaleDateString('ar-EG')}</Text>
                        {r.notes ? <Text style={s.recNotes} numberOfLines={1}>{r.notes}</Text> : null}
                      </View>
                    </View>
                  ))
                )}

                {/* Attendance records */}
                <Text style={[s.sectionHeader, { marginTop: 16 }]}>سجل الحضور</Text>
                {attendance.length === 0 ? (
                  <Text style={s.noData}>لا توجد سجلات حضور</Text>
                ) : (
                  attendance.map(r => (
                    <View key={r.id} style={s.recCard}>
                      <View style={[s.recIcon, { backgroundColor: '#ede9fe' }]}>
                        <Ionicons name="checkbox-outline" size={14} color="#6366f1" />
                      </View>
                      <View style={s.recBody}>
                        <Text style={s.recType}>{ATT_AR[r.attendanceType] ?? r.attendanceType}</Text>
                        <Text style={s.recDate}>{new Date(r.date).toLocaleDateString('ar-EG')}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </>
        )}

        {/* ── Milestones tab ── */}
        {tab === 'milestones' && (
          <>
            {msLoading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 30 }} />
            ) : (
              <>
                {isServant && (
                  <TouchableOpacity style={s.addMsBtn} onPress={() => setShowMsForm(true)}>
                    <Ionicons name="add-circle-outline" size={18} color="#6366f1" />
                    <Text style={s.addMsBtnText}>إضافة محطة روحية</Text>
                  </TouchableOpacity>
                )}
                {milestones.length === 0 ? (
                  <Text style={s.noData}>لا توجد محطات مسجلة</Text>
                ) : (
                  milestones.map(m => {
                    const ms = MS_MAP[m.type] ?? { label: m.type, icon: '⭐' }
                    return (
                      <View key={m.id} style={s.msCard}>
                        <Text style={s.msIcon}>{ms.icon}</Text>
                        <View style={s.msBody}>
                          <Text style={s.msLabel}>{ms.label}</Text>
                          <Text style={s.msDate}>{new Date(m.date).toLocaleDateString('ar-EG')}</Text>
                          {m.notes ? <Text style={s.msNotes}>{m.notes}</Text> : null}
                        </View>
                        {user?.role && ['SuperAdmin','Priest','SeniorPriest'].includes(user.role) && (
                          <TouchableOpacity onPress={() => deleteMilestone(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={15} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )
                  })
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Add milestone modal */}
      <Modal visible={showMsForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMsForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowMsForm(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>محطة روحية جديدة</Text>
            <TouchableOpacity onPress={addMilestone} disabled={msSaving}>
              {msSaving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>النوع</Text>
            <View style={s.msTypeGrid}>
              {MILESTONE_TYPES.map(t => (
                <TouchableOpacity key={t.value} style={[s.msTypeBtn, msType === t.value && s.msTypeBtnActive]} onPress={() => setMsType(t.value)}>
                  <Text style={s.msTypeBtnIcon}>{t.icon}</Text>
                  <Text style={[s.msTypeBtnText, msType === t.value && s.msTypeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLabel}>التاريخ</Text>
            <TextInput style={s.input} value={msDate} onChangeText={setMsDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />
            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]} value={msNote} onChangeText={setMsNote} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" multiline />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f8fafc' },
  header:         { backgroundColor: '#fff', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  avatar:         { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  avatarImg:      { width: 80, height: 80, borderRadius: 40 },
  avatarText:     { fontSize: 28, fontWeight: '800', color: '#6366f1' },
  name:           { fontSize: 20, fontWeight: '800', color: '#1f2937', textAlign: 'center' },
  role:           { fontSize: 13, color: '#6b7280', marginTop: 2 },
  status:         { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  qrToggleBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: '#6366f1', backgroundColor: '#ede9fe' },
  qrToggleTxt:    { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  qrBox:          { alignItems: 'center', marginTop: 14, padding: 14, backgroundColor: '#f8fafc', borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  qrLabel:        { fontSize: 11, color: '#6b7280' },
  tabBar:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabBtn:         { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: '#6366f1' },
  tabBtnText:     { fontSize: 13, color: '#9ca3af', fontWeight: '500' },
  tabBtnTextActive:{ color: '#6366f1', fontWeight: '700' },
  body:           { flex: 1 },
  bodyContent:    { padding: 14, paddingBottom: 40 },
  card:           { width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  section:        { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 6 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, justifyContent: 'flex-end' },
  rowLabel:       { fontSize: 12, color: '#9ca3af' },
  rowValue:       { fontSize: 14, color: '#374151', flex: 1, textAlign: 'right' },
  // Score
  scoreTotalRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  scoreBadge:     { backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', minWidth: 64 },
  scoreBadgeNum:  { color: '#fff', fontSize: 22, fontWeight: '900' },
  scoreBadgeLbl:  { color: '#c7d2fe', fontSize: 11 },
  scoreMetaCol:   { alignItems: 'flex-end', gap: 2 },
  scoreCountTxt:  { fontSize: 13, color: '#374151', fontWeight: '600' },
  scoreAvgTxt:    { fontSize: 12, color: '#6b7280' },
  catRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  catName:        { flex: 1, fontSize: 13, color: '#374151', textAlign: 'right' },
  catScore:       { fontSize: 14, fontWeight: '700', color: '#6366f1', marginLeft: 8 },
  // Records tab
  sectionHeader:  { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 8 },
  recCard:        { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 6, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  recIcon:        { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recBody:        { flex: 1, alignItems: 'flex-end', gap: 2 },
  recType:        { fontSize: 13, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  recDate:        { fontSize: 11, color: '#9ca3af' },
  recNotes:       { fontSize: 11, color: '#6b7280', textAlign: 'right' },
  // Milestones tab
  addMsBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ede9fe', borderRadius: 12, padding: 12, marginBottom: 12 },
  addMsBtnText:   { fontSize: 14, color: '#6366f1', fontWeight: '700' },
  msCard:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  msIcon:         { fontSize: 24 },
  msBody:         { flex: 1, alignItems: 'flex-end', gap: 2 },
  msLabel:        { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  msDate:         { fontSize: 12, color: '#9ca3af' },
  msNotes:        { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  noData:         { textAlign: 'center', color: '#9ca3af', marginTop: 12, fontSize: 14 },
  // Modal
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:     { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:    { fontSize: 15, color: '#9ca3af' },
  modalSave:      { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:      { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:          { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  msTypeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  msTypeBtn:      { width: '30%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', padding: 10, alignItems: 'center', gap: 4 },
  msTypeBtnActive:{ backgroundColor: '#6366f1', borderColor: '#6366f1' },
  msTypeBtnIcon:  { fontSize: 20 },
  msTypeBtnText:  { fontSize: 11, color: '#374151', fontWeight: '600', textAlign: 'center' },
  msTypeBtnTextActive: { color: '#fff' },
})
