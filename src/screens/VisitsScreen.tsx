import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'

interface Visit {
  id: string; visitDate: string; visitType: string; targetType: string; notes?: string
  familyName?: string; familyId?: string; memberName?: string; memberId?: string
  visitorName?: string; nextActionDate?: string; followUpRequired?: boolean
  purpose?: string; outcome?: string
}
interface FamilyOpt { id: string; familyName: string }
interface MemberOpt { id: string; fullName: string; familyId: string }

const VISIT_TYPES  = ['Home', 'Phone', 'WhatsApp', 'Message', 'InPerson']
const TARGET_TYPES = ['Family', 'Member']
const VISITOR_TYPES= ['Priest', 'Servant', 'Self']

const VISIT_TYPE_AR: Record<string, string>  = { Home: 'زيارة منزلية', Phone: 'هاتف', WhatsApp: 'واتساب', Message: 'رسالة', InPerson: 'شخصي' }
const TARGET_TYPE_AR: Record<string, string> = { Family: 'عائلة', Member: 'عضو' }
const VISITOR_TYPE_AR: Record<string, string>= { Priest: 'كاهن', Servant: 'خادم', Self: 'ذاتي' }

const TYPE_COLOR: Record<string, string> = {
  Home: '#6366f1', Phone: '#10b981', WhatsApp: '#25d366', Message: '#f59e0b', InPerson: '#0891b2',
}

export default function VisitsScreen() {
  const navigation = useNavigation<any>()
  const [visits,     setVisits]     = useState<Visit[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  // Create form state
  const [visitType,   setVisitType]   = useState('Home')
  const [targetType,  setTargetType]  = useState('Family')
  const [visitorType, setVisitorType] = useState('Servant')
  const [visitDate,   setVisitDate]   = useState(new Date().toISOString().split('T')[0])
  const [notes,       setNotes]       = useState('')
  const [purpose,     setPurpose]     = useState('')
  const [outcome,     setOutcome]     = useState('')
  const [nextAction,  setNextAction]  = useState('')
  const [followUp,    setFollowUp]    = useState(false)

  const [families,    setFamilies]    = useState<FamilyOpt[]>([])
  const [members,     setMembers]     = useState<MemberOpt[]>([])
  const [searchQ,     setSearchQ]     = useState('')
  const [selectedFam, setSelectedFam] = useState<FamilyOpt | null>(null)
  const [selectedMem, setSelectedMem] = useState<MemberOpt | null>(null)
  const [saving,      setSaving]      = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<Visit[]>('/visits', { params: { pageSize: 50 } })
      setVisits(Array.isArray(r.data) ? r.data : (r.data as any).items ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  const openCreate = async () => {
    setShowCreate(true)
    try {
      const r = await api.get<{ items: FamilyOpt[] }>('/families', { params: { pageSize: 500 } })
      setFamilies(r.data.items ?? (r.data as any))
    } catch {}
  }

  const searchMembers = async (q: string) => {
    setSearchQ(q)
    if (q.length < 2) return setMembers([])
    try {
      const r = await api.get<{ items: MemberOpt[] }>('/members/search', { params: { q, pageSize: 20 } })
      setMembers(r.data.items ?? [])
    } catch {}
  }

  const resetForm = () => {
    setVisitType('Home'); setTargetType('Family'); setVisitorType('Servant')
    setVisitDate(new Date().toISOString().split('T')[0]); setNotes(''); setPurpose('')
    setOutcome(''); setNextAction(''); setFollowUp(false)
    setSelectedFam(null); setSelectedMem(null); setSearchQ(''); setMembers([])
  }

  const handleSave = async () => {
    if (targetType === 'Family' && !selectedFam) return Alert.alert('', 'يرجى اختيار العائلة')
    if (targetType === 'Member' && !selectedMem) return Alert.alert('', 'يرجى اختيار العضو')
    setSaving(true)
    try {
      await api.post('/visits', {
        visitType, targetType, visitorType,
        familyId: targetType === 'Family' ? selectedFam?.id : selectedMem?.familyId,
        memberId: targetType === 'Member' ? selectedMem?.id : undefined,
        visitDate, notes: notes || undefined, purpose: purpose || undefined,
        outcome: outcome || undefined,
        nextActionDate: nextAction || undefined,
        followUpRequired: followUp,
      })
      setShowCreate(false); resetForm(); load()
    } catch {
      Alert.alert('خطأ', 'تعذّر حفظ الزيارة')
    } finally { setSaving(false) }
  }

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const renderItem = ({ item }: { item: Visit }) => {
    const color  = TYPE_COLOR[item.visitType] ?? '#9ca3af'
    const target = item.familyName ?? item.memberName ?? '—'
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => item.familyId && navigation.navigate('FamilyDetail', { id: item.familyId, name: item.familyName })}
      >
        <View style={[s.typePill, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[s.typeText, { color }]}>{VISIT_TYPE_AR[item.visitType] ?? item.visitType}</Text>
        </View>
        <View style={s.body}>
          <Text style={s.target}>{target}</Text>
          <Text style={s.date}>{new Date(item.visitDate).toLocaleDateString('ar-EG')}</Text>
          {item.purpose && <Text style={s.notes} numberOfLines={1}>الغرض: {item.purpose}</Text>}
          {item.notes && <Text style={s.notes} numberOfLines={2}>{item.notes}</Text>}
          {item.nextActionDate && (
            <View style={s.followUp}>
              <Ionicons name="alarm-outline" size={12} color="#f59e0b" />
              <Text style={s.followUpText}>متابعة: {new Date(item.nextActionDate).toLocaleDateString('ar-EG')}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.root}>
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={v => v.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد زيارات</Text>}
          ListHeaderComponent={<Text style={s.count}>{visits.length} زيارة</Text>}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={openCreate}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Visit Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCreate(false); resetForm() }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setShowCreate(false); resetForm() }}>
              <Text style={s.modalCancel}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>زيارة جديدة</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Visit type */}
            <Text style={s.fieldLabel}>نوع الزيارة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillRow}>
              {VISIT_TYPES.map(t => (
                <TouchableOpacity key={t} style={[s.pill, visitType === t && s.pillActive]} onPress={() => setVisitType(t)}>
                  <Text style={[s.pillText, visitType === t && s.pillTextActive]}>{VISIT_TYPE_AR[t]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Target type */}
            <Text style={s.fieldLabel}>المستهدف</Text>
            <View style={s.segRow}>
              {TARGET_TYPES.map(t => (
                <TouchableOpacity key={t} style={[s.seg, targetType === t && s.segActive]} onPress={() => setTargetType(t)}>
                  <Text style={[s.segText, targetType === t && s.segTextActive]}>{TARGET_TYPE_AR[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Family / Member picker */}
            {targetType === 'Family' ? (
              <>
                <Text style={s.fieldLabel}>اختر العائلة</Text>
                {selectedFam ? (
                  <TouchableOpacity style={s.selectedChip} onPress={() => setSelectedFam(null)}>
                    <Ionicons name="close-circle" size={16} color="#6366f1" />
                    <Text style={s.selectedChipText}>{selectedFam.familyName}</Text>
                  </TouchableOpacity>
                ) : (
                  <ScrollView style={s.familyList} nestedScrollEnabled>
                    {families.slice(0, 30).map(f => (
                      <TouchableOpacity key={f.id} style={s.familyItem} onPress={() => setSelectedFam(f)}>
                        <Text style={s.familyItemText}>{f.familyName}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>ابحث عن عضو</Text>
                <TextInput
                  style={s.input} value={searchQ} onChangeText={searchMembers}
                  placeholder="اسم العضو..." placeholderTextColor="#9ca3af" textAlign="right"
                />
                {selectedMem ? (
                  <TouchableOpacity style={s.selectedChip} onPress={() => { setSelectedMem(null); setSearchQ('') }}>
                    <Ionicons name="close-circle" size={16} color="#6366f1" />
                    <Text style={s.selectedChipText}>{selectedMem.fullName}</Text>
                  </TouchableOpacity>
                ) : (
                  members.map(m => (
                    <TouchableOpacity key={m.id} style={s.familyItem} onPress={() => setSelectedMem(m)}>
                      <Text style={s.familyItemText}>{m.fullName}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}

            {/* Visitor type */}
            <Text style={s.fieldLabel}>نوع الزائر</Text>
            <View style={s.segRow}>
              {VISITOR_TYPES.map(t => (
                <TouchableOpacity key={t} style={[s.seg, visitorType === t && s.segActive]} onPress={() => setVisitorType(t)}>
                  <Text style={[s.segText, visitorType === t && s.segTextActive]}>{VISITOR_TYPE_AR[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date */}
            <Text style={s.fieldLabel}>تاريخ الزيارة</Text>
            <TextInput style={s.input} value={visitDate} onChangeText={setVisitDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />

            {/* Purpose */}
            <Text style={s.fieldLabel}>الغرض</Text>
            <TextInput style={s.input} value={purpose} onChangeText={setPurpose} placeholder="غرض الزيارة..." placeholderTextColor="#9ca3af" textAlign="right" />

            {/* Notes */}
            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={[s.input, { height: 80 }]} value={notes} onChangeText={setNotes} placeholder="ملاحظات..." placeholderTextColor="#9ca3af" textAlign="right" multiline textAlignVertical="top" />

            {/* Outcome */}
            <Text style={s.fieldLabel}>نتيجة الزيارة</Text>
            <TextInput style={s.input} value={outcome} onChangeText={setOutcome} placeholder="نتيجة..." placeholderTextColor="#9ca3af" textAlign="right" />

            {/* Follow-up */}
            <View style={s.checkRow}>
              <TouchableOpacity style={[s.check, followUp && s.checkActive]} onPress={() => setFollowUp(p => !p)}>
                {followUp && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
              <Text style={s.checkLabel}>مطلوب متابعة</Text>
            </View>

            {followUp && (
              <>
                <Text style={s.fieldLabel}>تاريخ المتابعة</Text>
                <TextInput style={s.input} value={nextAction} onChangeText={setNextAction} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#f8fafc' },
  list:            { padding: 14, paddingBottom: 80 },
  count:           { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginBottom: 8 },
  card:            { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  typePill:        { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  typeText:        { fontSize: 12, fontWeight: '600' },
  body:            {},
  target:          { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  date:            { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 2 },
  notes:           { fontSize: 13, color: '#6b7280', textAlign: 'right', marginTop: 6 },
  followUp:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' },
  followUpText:    { fontSize: 12, color: '#f59e0b' },
  empty:           { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:             { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  // Modal
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:      { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:     { fontSize: 15, color: '#9ca3af' },
  modalSave:       { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:       { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:           { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  pillRow:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pill:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive:      { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:        { fontSize: 13, color: '#6b7280' },
  pillTextActive:  { color: '#fff', fontWeight: '600' },
  segRow:          { flexDirection: 'row', gap: 8 },
  seg:             { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, alignItems: 'center', backgroundColor: '#fff' },
  segActive:       { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  segText:         { fontSize: 13, color: '#374151' },
  segTextActive:   { color: '#fff', fontWeight: '600' },
  familyList:      { maxHeight: 160, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  familyItem:      { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  familyItemText:  { fontSize: 14, color: '#374151', textAlign: 'right' },
  selectedChip:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ede9fe', borderRadius: 10, padding: 10 },
  selectedChipText:{ flex: 1, fontSize: 14, color: '#6366f1', fontWeight: '600', textAlign: 'right' },
  checkRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  check:           { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  checkActive:     { backgroundColor: '#6366f1' },
  checkLabel:      { fontSize: 14, color: '#374151' },
})
