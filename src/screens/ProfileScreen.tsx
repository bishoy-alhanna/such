import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import QRCode from 'react-native-qrcode-svg'
import { useAuth } from '../context/AuthContext'
import api, { getServerBaseUrl } from '../services/api'

interface ScoreSummary {
  memberId: string; memberName: string; totalScore: number; count: number; averageScore: number
  byCategory: { categoryId?: string; categoryName: string; totalScore: number; count: number; averageScore: number }[]
}
interface AvailableCategory { id: string; name: string; description?: string; maxScore?: number }
interface MyPendingScore {
  id: string; categoryId?: string; categoryName?: string; date: string
  note?: string; status: string; submittedAt: string; reviewNote?: string
}

interface MemberProfile {
  id: string
  fullName: string
  nationalId?: string
  familyName?: string
  gender?: string
  dateOfBirth?: string
  mobile?: string
  occupationStatus?: string
  studyYear?: string
  college?: string
  jobTitle?: string
  qualification?: string
  church?: string
  confessionFather?: string
  lastConfessionDate?: string
  lastCommunionDate?: string
  notes?: string
  photoUrl?: string | null
}

type EditForm = Pick<MemberProfile,
  'gender' | 'dateOfBirth' | 'mobile' | 'occupationStatus' |
  'college' | 'jobTitle' | 'qualification' | 'church' |
  'confessionFather' | 'lastConfessionDate' | 'lastCommunionDate' | 'notes'
>

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  const [profile,       setProfile]       = useState<MemberProfile | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [form,          setForm]          = useState<EditForm>({})
  const [error,         setError]         = useState('')

  const [showQR,        setShowQR]        = useState(false)

  // Score state
  const [scoreSummary,  setScoreSummary]  = useState<ScoreSummary | null>(null)
  const [myPending,     setMyPending]     = useState<MyPendingScore[]>([])
  const [categories,    setCategories]    = useState<AvailableCategory[]>([])
  const [catLoaded,     setCatLoaded]     = useState(false)
  const [showSelfReport, setShowSelfReport] = useState(false)
  const [selfCatId,     setSelfCatId]     = useState<string | null>(null)
  const [selfDate,      setSelfDate]      = useState(new Date().toISOString().split('T')[0])
  const [selfNote,      setSelfNote]      = useState('')
  const [selfSaving,    setSelfSaving]    = useState(false)

  // Profile update request (member self-edit pending approval)
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<{ status: string; submittedAt: string; reviewNote?: string } | null>(null)
  const [showUpdateRequest,    setShowUpdateRequest]    = useState(false)
  const [updateForm,           setUpdateForm]           = useState<Record<string, string>>({})
  const [updateSaving,         setUpdateSaving]         = useState(false)

  const load = async () => {
    try {
      const r = await api.get<MemberProfile>('/members/profile')
      setProfile(r.data)
      populateForm(r.data)
      const [summaryR, pendingR] = await Promise.all([
        api.get<ScoreSummary>(`/scores/member/${r.data.id}/summary`).catch(() => null),
        api.get<MyPendingScore[]>('/scores/my-pending').catch(() => null),
      ])
      if (summaryR) setScoreSummary(summaryR.data)
      if (pendingR) setMyPending(Array.isArray(pendingR.data) ? pendingR.data : [])
      const pendingUpdateR = await api.get('/members/me/pending-update').catch(() => null)
      if (pendingUpdateR?.data) setPendingProfileUpdate(pendingUpdateR.data)
    } catch { /* user may not have a linked member yet */ }
    setLoading(false)
  }

  const populateForm = (p: MemberProfile) => setForm({
    gender:             p.gender,
    dateOfBirth:        p.dateOfBirth ? p.dateOfBirth.split('T')[0] : undefined,
    mobile:             p.mobile,
    occupationStatus:   p.occupationStatus,
    college:            p.college,
    jobTitle:           p.jobTitle,
    qualification:      p.qualification,
    church:             p.church,
    confessionFather:   p.confessionFather,
    lastConfessionDate: p.lastConfessionDate ? p.lastConfessionDate.split('T')[0] : undefined,
    lastCommunionDate:  p.lastCommunionDate  ? p.lastCommunionDate.split('T')[0]  : undefined,
    notes:              p.notes,
  })

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setError(''); setSaving(true)
    try {
      await api.put('/members/profile', form)
      await load()
      setEditing(false)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'فشل الحفظ. يرجى المحاولة مرة أخرى.')
    } finally { setSaving(false) }
  }

  const cancelEdit = () => {
    if (profile) populateForm(profile)
    setEditing(false)
    setError('')
  }

  const f = (k: keyof EditForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  const openSelfReport = async () => {
    if (!catLoaded) {
      const r = await api.get<AvailableCategory[]>('/scores/my-available-categories').catch(() => null)
      const cats = r && Array.isArray(r.data) ? r.data : []
      setCategories(cats)
      setCatLoaded(true)
      if (cats.length === 0) {
        Alert.alert('', 'لا توجد فئات متاحة للتسجيل الذاتي في الوقت الحالي')
        return
      }
    } else if (categories.length === 0) {
      Alert.alert('', 'لا توجد فئات متاحة للتسجيل الذاتي في الوقت الحالي')
      return
    }
    setSelfCatId(null)
    setSelfDate(new Date().toISOString().split('T')[0])
    setSelfNote('')
    setShowSelfReport(true)
  }

  const handleSelfReport = async () => {
    if (!selfCatId) return Alert.alert('', 'اختر فئة')
    if (!profile)   return
    setSelfSaving(true)
    try {
      await api.post(`/scores/member/${profile.id}/self-report`, {
        categoryId: selfCatId,
        date:       selfDate,
        note:       selfNote || undefined,
      })
      setShowSelfReport(false)
      const r = await api.get<MyPendingScore[]>('/scores/my-pending').catch(() => null)
      if (r) setMyPending(Array.isArray(r.data) ? r.data : [])
      Alert.alert('تم الإرسال', 'تم إرسال طلب النقطة بنجاح، في انتظار موافقة المشرف')
    } catch { Alert.alert('خطأ', 'تعذّر إرسال الطلب') }
    finally { setSelfSaving(false) }
  }

  const openUpdateRequest = () => {
    if (!profile) return
    setUpdateForm({
      mobile:           profile.mobile ?? '',
      church:           profile.church ?? '',
      confessionFather: profile.confessionFather ?? '',
      jobTitle:         profile.jobTitle ?? '',
      jobDetails:       '',
      college:          profile.college ?? '',
      studyYear:        '',
      qualification:    profile.qualification ?? '',
      notes:            profile.notes ?? '',
    })
    setShowUpdateRequest(true)
  }

  const submitUpdateRequest = async () => {
    setUpdateSaving(true)
    try {
      const body: Record<string, string> = {}
      Object.entries(updateForm).forEach(([k, v]) => { if (v.trim()) body[k] = v.trim() })
      await api.post('/members/me/request-update', body)
      const r = await api.get('/members/me/pending-update').catch(() => null)
      if (r?.data) setPendingProfileUpdate(r.data)
      setShowUpdateRequest(false)
      Alert.alert('تم الإرسال', 'تم إرسال طلب التعديل بنجاح، في انتظار موافقة المشرف')
    } catch (e: any) { Alert.alert('خطأ', e?.response?.data?.message ?? 'تعذّر إرسال الطلب') }
    finally { setUpdateSaving(false) }
  }

  const pickAndUploadPhoto = async () => {
    if (!profile) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح بالوصول إلى مكتبة الصور')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const form  = new FormData()
    form.append('file', { uri: asset.uri, name: 'photo.jpg', type: 'image/jpeg' } as any)
    try {
      const r = await api.post<{ photoUrl: string }>(`/members/${profile.id}/photo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setProfile(p => p ? { ...p, photoUrl: r.data.photoUrl } : p)
    } catch {
      Alert.alert('خطأ', 'تعذّر رفع الصورة')
    }
  }

  const displayName = user?.displayName || user?.username || ''

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ flex: 1, marginTop: 60 }} />

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container}>
      {/* Avatar & name */}
      <View style={s.avatarSection}>
        <TouchableOpacity style={s.avatarWrap} onPress={profile ? pickAndUploadPhoto : undefined} activeOpacity={0.8}>
          {profile?.photoUrl
            ? <Image source={{ uri: `${getServerBaseUrl()}${profile.photoUrl}` }} style={s.avatarImg} />
            : <View style={s.avatar}><Text style={s.avatarText}>{displayName[0]?.toUpperCase() ?? '?'}</Text></View>
          }
          <View style={s.cameraBtn}>
            <Ionicons name="camera" size={13} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={s.name}>{profile?.fullName ?? displayName}</Text>
        {profile?.familyName && <Text style={s.sub}>عائلة {profile.familyName}</Text>}
        <Text style={s.role}>{user?.role}</Text>

        {profile && (
          <TouchableOpacity style={s.qrToggleBtn} onPress={() => setShowQR(v => !v)}>
            <Ionicons name={showQR ? 'close-outline' : 'qr-code-outline'} size={16} color="#6366f1" />
            <Text style={s.qrToggleTxt}>{showQR ? 'إخفاء الرمز' : 'رمز QR للحضور'}</Text>
          </TouchableOpacity>
        )}

        {profile && showQR && (
          <View style={s.qrBox}>
            <QRCode value={profile.id} size={180} color="#1f2937" backgroundColor="#ffffff" />
            <Text style={s.qrLabel}>{profile.fullName} — اعرض هذا الرمز للخادم</Text>
          </View>
        )}

        {profile && pendingProfileUpdate?.status === 'Pending' && (
          <View style={s.pendingUpdateBanner}>
            <Ionicons name="time-outline" size={14} color="#d97706" />
            <Text style={s.pendingUpdateText}>طلب تعديل بياناتك قيد المراجعة</Text>
          </View>
        )}
        {profile && pendingProfileUpdate?.status === 'Rejected' && (
          <View style={[s.pendingUpdateBanner, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
            <Text style={[s.pendingUpdateText, { color: '#dc2626' }]}>رُفض طلب التعديل السابق{pendingProfileUpdate.reviewNote ? `: ${pendingProfileUpdate.reviewNote}` : ''}</Text>
          </View>
        )}
        {profile && (!pendingProfileUpdate || pendingProfileUpdate.status !== 'Pending') && (
          <TouchableOpacity style={s.updateRequestBtn} onPress={openUpdateRequest}>
            <Ionicons name="create-outline" size={15} color="#6366f1" />
            <Text style={s.updateRequestTxt}>طلب تعديل بياناتي</Text>
          </TouchableOpacity>
        )}
      </View>

      {!profile && (
        <View style={s.noProfile}>
          <Text style={s.noProfileText}>لم يتم ربط حسابك بعضو حتى الآن. تواصل مع المشرف.</Text>
        </View>
      )}

      {profile && (
        <>
          {/* Read-only info */}
          <View style={s.card}>
            <Text style={s.section}>بيانات ثابتة</Text>
            {profile.nationalId && <InfoRow label="الرقم القومي" value={profile.nationalId} />}
            {profile.fullName    && <InfoRow label="الاسم الكامل"  value={profile.fullName} />}
          </View>

          {/* Editable info */}
          <View style={s.card}>
            <View style={s.sectionRow}>
              <Text style={s.section}>البيانات الشخصية</Text>
              {!editing && (
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Ionicons name="pencil-outline" size={18} color="#6366f1" />
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <>
                <Field label="الجنس">
                  <View style={s.segmentRow}>
                    {['Male', 'Female'].map(g => (
                      <TouchableOpacity key={g} style={[s.segment, form.gender === g && s.segmentActive]} onPress={() => f('gender', g)}>
                        <Text style={[s.segmentText, form.gender === g && s.segmentTextActive]}>{g === 'Male' ? 'ذكر' : 'أنثى'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
                <EField label="تاريخ الميلاد"  value={form.dateOfBirth}      onChangeText={v => f('dateOfBirth', v)}        placeholder="YYYY-MM-DD" />
                <EField label="الهاتف"          value={form.mobile}           onChangeText={v => f('mobile', v)}             placeholder="01xxxxxxxxx" keyboardType="phone-pad" />
                <EField label="الحالة الوظيفية" value={form.occupationStatus} onChangeText={v => f('occupationStatus', v)}   placeholder="طالب / موظف / ..." />
                <EField label="الكلية / الجامعة" value={form.college}         onChangeText={v => f('college', v)}            />
                <EField label="المسمى الوظيفي"  value={form.jobTitle}         onChangeText={v => f('jobTitle', v)}           />
                <EField label="المؤهل"          value={form.qualification}    onChangeText={v => f('qualification', v)}      />
                <EField label="الكنيسة"         value={form.church}           onChangeText={v => f('church', v)}             />
                <EField label="أب الاعتراف"     value={form.confessionFather} onChangeText={v => f('confessionFather', v)}   />
                <EField label="آخر اعتراف"      value={form.lastConfessionDate} onChangeText={v => f('lastConfessionDate', v)} placeholder="YYYY-MM-DD" />
                <EField label="آخر تناول"       value={form.lastCommunionDate}  onChangeText={v => f('lastCommunionDate', v)}  placeholder="YYYY-MM-DD" />
                <EField label="ملاحظات"         value={form.notes}            onChangeText={v => f('notes', v)}              multiline />

                {!!error && <Text style={s.error}>{error}</Text>}

                <View style={s.actionRow}>
                  <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>حفظ</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                    <Text style={s.cancelBtnText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <InfoRow label="الجنس"           value={form.gender === 'Male' ? 'ذكر' : form.gender === 'Female' ? 'أنثى' : undefined} />
                <InfoRow label="تاريخ الميلاد"   value={form.dateOfBirth} />
                <InfoRow label="الهاتف"          value={form.mobile} />
                <InfoRow label="الحالة الوظيفية" value={form.occupationStatus} />
                <InfoRow label="الكلية"          value={form.college} />
                <InfoRow label="المسمى الوظيفي"  value={form.jobTitle} />
                <InfoRow label="المؤهل"          value={form.qualification} />
                <InfoRow label="الكنيسة"         value={form.church} />
                <InfoRow label="أب الاعتراف"     value={form.confessionFather} />
                <InfoRow label="آخر اعتراف"      value={form.lastConfessionDate?.split('T')[0]} />
                <InfoRow label="آخر تناول"       value={form.lastCommunionDate?.split('T')[0]} />
                {form.notes && <InfoRow label="ملاحظات" value={form.notes} />}
              </>
            )}
          </View>
        </>
      )}

      {/* Score section */}
      {profile && (scoreSummary || myPending.length > 0) && (
        <View style={s.card}>
          <View style={s.sectionRow}>
            <TouchableOpacity onPress={openSelfReport} style={s.selfReportBtn}>
              <Ionicons name="add-circle-outline" size={18} color="#6366f1" />
              <Text style={s.selfReportBtnText}>تسجيل نقطة</Text>
            </TouchableOpacity>
            <Text style={s.section}>النقاط</Text>
          </View>

          {scoreSummary && (
            <>
              <View style={s.scoreTotalRow}>
                <View style={s.scoreMetaCol}>
                  {scoreSummary.count > 0 && (
                    <>
                      <Text style={s.scoreCountTxt}>{scoreSummary.count} سجل</Text>
                      <Text style={s.scoreAvgTxt}>متوسط {scoreSummary.averageScore.toFixed(1)}</Text>
                    </>
                  )}
                  {scoreSummary.count === 0 && myPending.length === 0 && (
                    <Text style={s.scoreEmpty}>لا توجد نقاط مسجلة بعد</Text>
                  )}
                </View>
                <View style={s.scoreBadge}>
                  <Text style={s.scoreBadgeNum}>{scoreSummary.totalScore}</Text>
                  <Text style={s.scoreBadgeLbl}>نقطة</Text>
                </View>
              </View>

              {scoreSummary.byCategory.length > 0 && (
                <View style={s.catList}>
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

          {myPending.length > 0 && (
            <>
              <Text style={[s.section, { marginTop: 12, marginBottom: 6 }]}>
                طلبات معلقة ({myPending.length})
              </Text>
              {myPending.map(p => (
                <View key={p.id} style={s.pendingRow}>
                  <View style={[
                    s.pendingBadge,
                    p.status === 'Approved' ? s.pendingApproved
                      : p.status === 'Rejected' ? s.pendingRejected
                      : s.pendingPending,
                  ]}>
                    <Text style={s.pendingBadgeTxt}>
                      {p.status === 'Approved' ? 'مقبول' : p.status === 'Rejected' ? 'مرفوض' : 'معلق'}
                    </Text>
                  </View>
                  <View style={s.pendingInfo}>
                    <Text style={s.pendingCat}>{p.categoryName ?? '—'}</Text>
                    <Text style={s.pendingDate}>{new Date(p.date).toLocaleDateString('ar-EG')}</Text>
                    {p.reviewNote ? <Text style={s.pendingNote}>{p.reviewNote}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'خروج', style: 'destructive', onPress: logout },
      ])}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={s.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>

      {/* Self-report score modal */}
      <Modal visible={showSelfReport} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSelfReport(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowSelfReport(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>تسجيل نقطة</Text>
            <TouchableOpacity onPress={handleSelfReport} disabled={selfSaving}>
              {selfSaving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>إرسال</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.editLabel}>الفئة</Text>
            <View style={s.catGrid}>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catBtn, selfCatId === c.id && s.catBtnActive]}
                  onPress={() => setSelfCatId(c.id)}
                >
                  <Text style={[s.catBtnText, selfCatId === c.id && s.catBtnTextActive]} numberOfLines={2}>{c.name}</Text>
                  {c.maxScore != null && (
                    <Text style={[s.catBtnMax, selfCatId === c.id && { color: '#c7d2fe' }]}>حتى {c.maxScore}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.editLabel}>التاريخ</Text>
            <TextInput
              style={s.editInput}
              value={selfDate}
              onChangeText={setSelfDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
              textAlign="right"
            />

            <Text style={s.editLabel}>ملاحظة (اختياري)</Text>
            <TextInput
              style={[s.editInput, { height: 72, textAlignVertical: 'top' }]}
              value={selfNote}
              onChangeText={setSelfNote}
              placeholder="أضف ملاحظة..."
              placeholderTextColor="#9ca3af"
              textAlign="right"
              multiline
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile update request modal */}
      <Modal visible={showUpdateRequest} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowUpdateRequest(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowUpdateRequest(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>طلب تعديل البيانات</Text>
            <TouchableOpacity onPress={submitUpdateRequest} disabled={updateSaving}>
              {updateSaving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>إرسال</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.modalNote}>التعديلات ستُرسل للمراجعة قبل التطبيق</Text>
            {([
              ['mobile',           'رقم الموبايل'],
              ['church',           'الكنيسة'],
              ['confessionFather', 'أب الاعتراف'],
              ['jobTitle',         'الوظيفة'],
              ['jobDetails',       'تفاصيل العمل'],
              ['college',          'الكلية'],
              ['studyYear',        'سنة الدراسة'],
              ['qualification',    'المؤهل'],
            ] as [string, string][]).map(([key, label]) => (
              <View key={key}>
                <Text style={s.modalFieldLabel}>{label}</Text>
                <TextInput
                  style={s.modalInput}
                  value={updateForm[key] ?? ''}
                  onChangeText={v => setUpdateForm(f => ({ ...f, [key]: v }))}
                  placeholder={`أدخل ${label}`}
                  placeholderTextColor="#9ca3af"
                  textAlign="right"
                />
              </View>
            ))}
            <Text style={s.modalFieldLabel}>ملاحظات</Text>
            <TextInput
              style={[s.modalInput, { height: 72, textAlignVertical: 'top' }]}
              value={updateForm['notes'] ?? ''}
              onChangeText={v => setUpdateForm(f => ({ ...f, notes: v }))}
              placeholder="ملاحظات اختيارية..."
              placeholderTextColor="#9ca3af"
              textAlign="right"
              multiline
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={s.infoRow}>
      <Text style={s.infoValue}>{value}</Text>
      <Text style={s.infoLabel}>{label}</Text>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={s.editLabel}>{label}</Text>
      {children}
    </>
  )
}

function EField({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value?: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: any; multiline?: boolean
}) {
  return (
    <>
      <Text style={s.editLabel}>{label}</Text>
      <TextInput
        style={[s.editInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value ?? ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlign="right"
      />
    </>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f8fafc' },
  container:        { padding: 20, paddingBottom: 48 },
  avatarSection:    { alignItems: 'center', marginBottom: 24 },
  avatarWrap:       { position: 'relative', marginBottom: 12 },
  avatar:           { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  avatarImg:        { width: 80, height: 80, borderRadius: 40 },
  avatarText:       { fontSize: 32, fontWeight: '800', color: '#6366f1' },
  cameraBtn:        { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f8fafc' },
  name:             { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  sub:              { fontSize: 13, color: '#6b7280', marginTop: 4 },
  role:             { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  qrToggleBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#6366f1', backgroundColor: '#ede9fe' },
  qrToggleTxt:      { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  qrBox:            { alignItems: 'center', marginTop: 16, padding: 20, backgroundColor: '#fff', borderRadius: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  qrLabel:          { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  noProfile:        { backgroundColor: '#fffbeb', borderRadius: 12, padding: 16, marginBottom: 16 },
  noProfileText:    { color: '#92400e', textAlign: 'center', fontSize: 14 },
  card:             { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  section:          { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 10 },
  sectionRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel:        { fontSize: 12, color: '#9ca3af' },
  infoValue:        { fontSize: 14, color: '#374151', flex: 1, textAlign: 'right', marginRight: 8 },
  editLabel:        { fontSize: 12, fontWeight: '600', color: '#6b7280', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  editInput:        { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  segmentRow:       { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segment:          { flex: 1, paddingVertical: 9, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  segmentActive:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  segmentText:      { fontSize: 14, color: '#374151' },
  segmentTextActive:{ color: '#fff', fontWeight: '600' },
  actionRow:        { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveBtn:          { flex: 1, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn:        { paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  cancelBtnText:    { color: '#374151', fontSize: 15 },
  error:            { color: '#dc2626', fontSize: 13, textAlign: 'right', marginTop: 8 },
  logoutBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, backgroundColor: '#fff5f5', marginTop: 8 },
  logoutText:       { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  // Score styles
  selfReportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selfReportBtnText:{ fontSize: 13, color: '#6366f1', fontWeight: '600' },
  scoreTotalRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  scoreBadge:       { backgroundColor: '#6366f1', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 70 },
  scoreBadgeNum:    { color: '#fff', fontSize: 26, fontWeight: '900' },
  scoreBadgeLbl:    { color: '#c7d2fe', fontSize: 11, marginTop: 1 },
  scoreMetaCol:     { alignItems: 'flex-end', gap: 3 },
  scoreCountTxt:    { fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'right' },
  scoreAvgTxt:      { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  scoreEmpty:       { fontSize: 13, color: '#9ca3af', textAlign: 'right' },
  catList:          { gap: 6, marginBottom: 4 },
  catRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  catName:          { flex: 1, fontSize: 13, color: '#374151', textAlign: 'right' },
  catScore:         { fontSize: 14, fontWeight: '700', color: '#6366f1', marginLeft: 8 },
  pendingRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pendingBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  pendingPending:   { backgroundColor: '#fef3c7' },
  pendingApproved:  { backgroundColor: '#d1fae5' },
  pendingRejected:  { backgroundColor: '#fee2e2' },
  pendingBadgeTxt:  { fontSize: 11, fontWeight: '700', color: '#374151' },
  pendingInfo:      { flex: 1, alignItems: 'flex-end', gap: 1 },
  pendingCat:       { fontSize: 13, fontWeight: '600', color: '#1f2937', textAlign: 'right' },
  pendingDate:      { fontSize: 11, color: '#9ca3af' },
  pendingNote:      { fontSize: 11, color: '#ef4444', textAlign: 'right' },
  // Self-report modal
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:       { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:      { fontSize: 15, color: '#9ca3af' },
  modalSave:        { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:        { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catBtn:           { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', padding: 12, alignItems: 'center', gap: 4 },
  catBtnActive:     { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  catBtnText:       { fontSize: 13, color: '#374151', fontWeight: '600', textAlign: 'center' },
  catBtnTextActive: { color: '#fff' },
  catBtnMax:        { fontSize: 11, color: '#9ca3af' },
  // Profile update request
  pendingUpdateBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#fef3c7' },
  pendingUpdateText:   { fontSize: 12, color: '#d97706', fontWeight: '500', flex: 1, textAlign: 'right' },
  updateRequestBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#6366f1', backgroundColor: '#ede9fe' },
  updateRequestTxt:    { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  modalNote:           { fontSize: 13, color: '#6b7280', textAlign: 'right', marginBottom: 12 },
  modalFieldLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  modalInput:          { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
})
