import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, RefreshControl, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface ClassDetail {
  id: string; className: string; ageGroup?: string; groupName?: string
  servants: { id: string; userId: string; name: string }[]
  members:  { id: string; memberId: string; fullName: string; gender?: string }[]
}
interface Category { id: string; name: string; maxScore: number }
interface LeaderEntry { rank: number; memberId: string; memberName: string; totalScore: number; count: number }
interface MemberSearch { id: string; fullName: string; familyId: string }

const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader', 'Servant']

type Tab = 'members' | 'leaderboard' | 'servants'

export default function ClassDetailScreen() {
  const route      = useRoute<any>()
  const navigation = useNavigation<any>()
  const { user }   = useAuth()
  const canManage  = ADMIN_ROLES.includes(user?.role ?? '')
  const { id }     = route.params

  const [cls,        setCls]        = useState<ClassDetail | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [leaderboard,setLeaderboard]= useState<LeaderEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<Tab>('members')
  const [refreshing, setRefreshing] = useState(false)

  // Add score modal
  const [showScore,     setShowScore]     = useState(false)
  const [scoreSearch,   setScoreSearch]   = useState('')
  const [scoreMembers,  setScoreMembers]  = useState<MemberSearch[]>([])
  const [selMember,     setSelMember]     = useState<MemberSearch | null>(null)
  const [selCategory,   setSelCategory]   = useState('')
  const [scoreValue,    setScoreValue]    = useState('')
  const [scoreDate,     setScoreDate]     = useState(new Date().toISOString().split('T')[0])
  const [scoreDesc,     setScoreDesc]     = useState('')
  const [savingScore,   setSavingScore]   = useState(false)

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberSearch,  setMemberSearch]  = useState('')
  const [memberResults, setMemberResults] = useState<MemberSearch[]>([])

  const load = useCallback(async () => {
    try {
      const [cr, cat, lb] = await Promise.all([
        api.get<ClassDetail>(`/classes/${id}`),
        api.get<Category[]>('/score-categories', { params: { classId: id } }),
        api.get<LeaderEntry[]>(`/scores/class/${id}/leaderboard`),
      ])
      setCls(cr.data)
      setCategories(Array.isArray(cat.data) ? cat.data : [])
      setLeaderboard(Array.isArray(lb.data) ? lb.data : (lb.data as any)?.members ?? [])
    } catch {}
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const searchForScore = async (q: string) => {
    setScoreSearch(q)
    if (q.length < 2) return setScoreMembers([])
    try {
      const r = await api.get<{ items: MemberSearch[] }>('/members/search', { params: { q, pageSize: 10 } })
      setScoreMembers(r.data.items ?? [])
    } catch {}
  }

  const searchForAdd = async (q: string) => {
    setMemberSearch(q)
    if (q.length < 2) return setMemberResults([])
    try {
      const r = await api.get<{ items: MemberSearch[] }>('/members/search', { params: { q, pageSize: 15 } })
      setMemberResults(r.data.items ?? [])
    } catch {}
  }

  const handleAddMember = async (m: MemberSearch) => {
    try {
      await api.post(`/classes/${id}/members`, { memberId: m.id })
      setShowAddMember(false); setMemberSearch(''); setMemberResults([])
      load()
    } catch { Alert.alert('خطأ', 'تعذّر الإضافة') }
  }

  const handleRemoveMember = (enrollment: ClassDetail['members'][0]) => {
    Alert.alert('إزالة العضو', `إزالة "${enrollment.fullName}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إزالة', style: 'destructive', onPress: async () => {
        try { await api.delete(`/classes/${id}/members/${enrollment.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الإزالة') }
      }},
    ])
  }

  const handleSaveScore = async () => {
    if (!selMember) return Alert.alert('', 'اختر عضواً')
    if (!selCategory) return Alert.alert('', 'اختر الفئة')
    if (!scoreValue || isNaN(Number(scoreValue))) return Alert.alert('', 'أدخل قيمة صحيحة')
    setSavingScore(true)
    try {
      await api.post('/scores', {
        memberId: selMember.id, categoryId: selCategory,
        scoreValue: Number(scoreValue), date: scoreDate, description: scoreDesc || undefined,
      })
      setShowScore(false)
      setSelMember(null); setScoreSearch(''); setScoreMembers([])
      setSelCategory(''); setScoreValue(''); setScoreDesc('')
      setScoreDate(new Date().toISOString().split('T')[0])
      load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSavingScore(false) }
  }

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ flex: 1, marginTop: 60 }} />
  if (!cls)    return <Text style={{ textAlign: 'center', marginTop: 60, color: '#9ca3af' }}>لا توجد بيانات</Text>

  const MEDAL = ['🥇', '🥈', '🥉']

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {/* Header */}
        <View style={s.header}>
          {cls.ageGroup && <View style={s.ageBadge}><Text style={s.ageBadgeText}>{cls.ageGroup}</Text></View>}
          {cls.groupName && <Text style={s.groupText}>{cls.groupName}</Text>}
          <View style={s.statsRow}>
            <View style={s.stat}><Text style={s.statN}>{cls.members.length}</Text><Text style={s.statL}>عضو</Text></View>
            <View style={s.stat}><Text style={s.statN}>{cls.servants.length}</Text><Text style={s.statL}>خادم</Text></View>
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['members', 'leaderboard', 'servants'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'members' ? 'الأعضاء' : t === 'leaderboard' ? 'المتصدرون' : 'الخدام'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Members tab */}
        {tab === 'members' && (
          <View style={s.section}>
            {canManage && (
              <TouchableOpacity style={s.addBtn} onPress={() => setShowAddMember(true)}>
                <Ionicons name="person-add-outline" size={16} color="#6366f1" />
                <Text style={s.addBtnText}>إضافة عضو</Text>
              </TouchableOpacity>
            )}
            {cls.members.map(m => (
              <TouchableOpacity key={m.id} style={s.memberRow} onPress={() => navigation.navigate('MemberDetail', { id: m.memberId, name: m.fullName })}>
                <View style={s.memberAv}><Text style={s.memberAvText}>{m.fullName[0]}</Text></View>
                <Text style={s.memberName}>{m.fullName}</Text>
                {canManage && (
                  <TouchableOpacity onPress={() => handleRemoveMember(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="remove-circle-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
            {cls.members.length === 0 && <Text style={s.empty}>لا يوجد أعضاء</Text>}
          </View>
        )}

        {/* Leaderboard tab */}
        {tab === 'leaderboard' && (
          <View style={s.section}>
            {canManage && (
              <TouchableOpacity style={s.addBtn} onPress={() => setShowScore(true)}>
                <Ionicons name="star-outline" size={16} color="#6366f1" />
                <Text style={s.addBtnText}>إضافة نقاط</Text>
              </TouchableOpacity>
            )}
            {leaderboard.map((e, i) => (
              <View key={e.memberId} style={s.rankRow}>
                <View style={s.rankScore}><Text style={s.rankScoreText}>{e.totalScore}</Text></View>
                <View style={s.rankInfo}>
                  <Text style={s.rankName}>{e.memberName}</Text>
                  <Text style={s.rankCount}>{e.count} إدخال</Text>
                </View>
                <Text style={s.rankMedal}>{MEDAL[i] ?? `${e.rank}`}</Text>
              </View>
            ))}
            {leaderboard.length === 0 && <Text style={s.empty}>لا توجد نقاط بعد</Text>}
          </View>
        )}

        {/* Servants tab */}
        {tab === 'servants' && (
          <View style={s.section}>
            {cls.servants.map(sv => (
              <View key={sv.id} style={s.memberRow}>
                <View style={[s.memberAv, { backgroundColor: '#d1fae5' }]}>
                  <Text style={[s.memberAvText, { color: '#059669' }]}>{sv.name[0]}</Text>
                </View>
                <Text style={s.memberName}>{sv.name}</Text>
              </View>
            ))}
            {cls.servants.length === 0 && <Text style={s.empty}>لا يوجد خدام</Text>}
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowAddMember(false); setMemberSearch(''); setMemberResults([]) }}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => { setShowAddMember(false); setMemberSearch(''); setMemberResults([]) }}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
          <Text style={s.modalTitle}>إضافة عضو للفصل</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 16, flex: 1, backgroundColor: '#f8fafc' }}>
          <TextInput
            style={s.input} value={memberSearch} onChangeText={searchForAdd}
            placeholder="ابحث باسم العضو..." placeholderTextColor="#9ca3af" textAlign="right" autoFocus
          />
          <FlatList
            data={memberResults}
            keyExtractor={m => m.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.memberRow} onPress={() => handleAddMember(item)}>
                <View style={s.memberAv}><Text style={s.memberAvText}>{item.fullName[0]}</Text></View>
                <Text style={s.memberName}>{item.fullName}</Text>
                <Ionicons name="add-circle-outline" size={20} color="#6366f1" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={memberSearch.length >= 2 ? <Text style={s.empty}>لا نتائج</Text> : <Text style={s.empty}>ابدأ الكتابة للبحث</Text>}
          />
        </View>
      </Modal>

      {/* Add Score Modal */}
      <Modal visible={showScore} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowScore(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowScore(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>إضافة نقاط</Text>
            <TouchableOpacity onPress={handleSaveScore} disabled={savingScore}>
              {savingScore ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>العضو</Text>
            {selMember ? (
              <TouchableOpacity style={s.selectedChip} onPress={() => { setSelMember(null); setScoreSearch(''); setScoreMembers([]) }}>
                <Ionicons name="close-circle" size={16} color="#6366f1" />
                <Text style={s.selectedChipText}>{selMember.fullName}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput style={s.input} value={scoreSearch} onChangeText={searchForScore} placeholder="ابحث عن عضو..." placeholderTextColor="#9ca3af" textAlign="right" />
                {scoreMembers.map(m => (
                  <TouchableOpacity key={m.id} style={s.memberRow} onPress={() => { setSelMember(m); setScoreMembers([]) }}>
                    <View style={s.memberAv}><Text style={s.memberAvText}>{m.fullName[0]}</Text></View>
                    <Text style={s.memberName}>{m.fullName}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={s.fieldLabel}>الفئة</Text>
            <View style={s.gridPills}>
              {categories.map(c => (
                <TouchableOpacity key={c.id} style={[s.pill, selCategory === c.id && s.pillActive]} onPress={() => setSelCategory(c.id)}>
                  <Text style={[s.pillText, selCategory === c.id && s.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>القيمة</Text>
            <TextInput style={s.input} value={scoreValue} onChangeText={setScoreValue} placeholder="مثال: 10" placeholderTextColor="#9ca3af" keyboardType="numeric" textAlign="right" />

            <Text style={s.fieldLabel}>التاريخ</Text>
            <TextInput style={s.input} value={scoreDate} onChangeText={setScoreDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>ملاحظة</Text>
            <TextInput style={s.input} value={scoreDesc} onChangeText={setScoreDesc} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f8fafc' },
  container:       { padding: 16, paddingBottom: 40 },
  header:          { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'flex-end', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  ageBadge:        { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  ageBadgeText:    { fontSize: 12, color: '#7c3aed', fontWeight: '700' },
  groupText:       { fontSize: 13, color: '#6b7280' },
  statsRow:        { flexDirection: 'row', gap: 24 },
  stat:            { alignItems: 'center' },
  statN:           { fontSize: 22, fontWeight: '800', color: '#6366f1' },
  statL:           { fontSize: 11, color: '#9ca3af' },
  tabs:            { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  tab:             { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive:       { backgroundColor: '#6366f1' },
  tabText:         { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive:   { color: '#fff', fontWeight: '700' },
  section:         {},
  addBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', backgroundColor: '#ede9fe', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  addBtnText:      { fontSize: 14, fontWeight: '600', color: '#6366f1' },
  memberRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  memberAv:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvText:    { fontSize: 14, fontWeight: '700', color: '#6366f1' },
  memberName:      { flex: 1, fontSize: 14, fontWeight: '600', color: '#1f2937', textAlign: 'right' },
  rankRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  rankMedal:       { fontSize: 22, flexShrink: 0 },
  rankInfo:        { flex: 1, alignItems: 'flex-end' },
  rankName:        { fontSize: 14, fontWeight: '600', color: '#1f2937', textAlign: 'right' },
  rankCount:       { fontSize: 11, color: '#9ca3af' },
  rankScore:       { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44, alignItems: 'center' },
  rankScoreText:   { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty:           { textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 14 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:      { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:     { fontSize: 15, color: '#9ca3af' },
  modalSave:       { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:           { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', marginBottom: 4 },
  selectedChip:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ede9fe', borderRadius: 10, padding: 10, marginBottom: 8 },
  selectedChipText:{ flex: 1, fontSize: 14, color: '#6366f1', fontWeight: '600', textAlign: 'right' },
  gridPills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  pill:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive:      { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:        { fontSize: 13, color: '#6b7280' },
  pillTextActive:  { color: '#fff', fontWeight: '600' },
})
