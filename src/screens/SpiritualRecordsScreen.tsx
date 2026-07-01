import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface SpiritualRecord {
  id: string; memberId: string; memberName?: string; type: string
  date: string; notes?: string; recordedByName?: string
}
interface MemberSearch { id: string; fullName: string; familyId: string }

const RECORD_TYPES = ['Confession', 'Communion', 'Mass', 'Call']
const TYPE_AR: Record<string, string>    = { Confession: 'اعتراف', Communion: 'تناول', Mass: 'قداس', Call: 'تواصل' }
const TYPE_COLOR: Record<string, string> = { Confession: '#7c3aed', Communion: '#dc2626', Mass: '#d97706', Call: '#0891b2' }
const TYPE_ICON: Record<string, any>     = { Confession: 'ear-outline', Communion: 'wine-outline', Mass: 'church', Call: 'call-outline' }

export default function SpiritualRecordsScreen() {
  const [records,    setRecords]    = useState<SpiritualRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [page,       setPage]       = useState(1)
  const [hasMore,    setHasMore]    = useState(true)

  // Form state
  const [memberSearch,  setMemberSearch]  = useState('')
  const [memberResults, setMemberResults] = useState<MemberSearch[]>([])
  const [selMember,     setSelMember]     = useState<MemberSearch | null>(null)
  const [recType,       setRecType]       = useState('Confession')
  const [recDate,       setRecDate]       = useState(new Date().toISOString().split('T')[0])
  const [recNotes,      setRecNotes]      = useState('')
  const [saving,        setSaving]        = useState(false)

  const load = useCallback(async (p = 1) => {
    try {
      const r = await api.get<{ items: SpiritualRecord[]; totalCount: number }>('/spiritual-records', { params: { page: p, pageSize: 25, type: typeFilter || undefined } })
      const items = r.data.items ?? (r.data as any)
      if (p === 1) setRecords(items)
      else setRecords(prev => [...prev, ...items])
      const totalPages = Math.ceil((r.data.totalCount ?? 0) / 25)
      setHasMore(p < totalPages)
    } catch {}
    setLoading(false)
  }, [typeFilter])

  useEffect(() => { setPage(1); setRecords([]); setLoading(true); load(1) }, [typeFilter])
  const onRefresh = async () => { setRefreshing(true); setPage(1); await load(1); setRefreshing(false) }

  const loadMore = () => {
    if (!hasMore || loading) return
    const next = page + 1
    setPage(next); load(next)
  }

  const searchMembers = async (q: string) => {
    setMemberSearch(q)
    if (q.length < 2) return setMemberResults([])
    try {
      const r = await api.get<{ items: MemberSearch[] }>('/members/search', { params: { q, pageSize: 15 } })
      setMemberResults(r.data.items ?? [])
    } catch {}
  }

  const resetForm = () => {
    setSelMember(null); setMemberSearch(''); setMemberResults([])
    setRecType('Confession'); setRecDate(new Date().toISOString().split('T')[0]); setRecNotes('')
  }

  const handleSave = async () => {
    if (!selMember) return Alert.alert('', 'اختر العضو')
    setSaving(true)
    try {
      await api.post('/spiritual-records', { memberId: selMember.id, type: recType, date: recDate, notes: recNotes || undefined })
      setShowCreate(false); resetForm(); onRefresh()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const handleDelete = (rec: SpiritualRecord) => {
    Alert.alert('حذف السجل', 'هل تريد حذف هذا السجل؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/spiritual-records/${rec.id}`); onRefresh() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const renderItem = ({ item }: { item: SpiritualRecord }) => {
    const color = TYPE_COLOR[item.type] ?? '#6b7280'
    return (
      <View style={s.card}>
        <View style={[s.typeIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={TYPE_ICON[item.type] ?? 'star-outline'} size={18} color={color} />
        </View>
        <View style={s.cardBody}>
          <Text style={s.memberName}>{item.memberName ?? '—'}</Text>
          <View style={s.cardRow}>
            <Text style={[s.typeBadge, { color, borderColor: color + '40', backgroundColor: color + '12' }]}>{TYPE_AR[item.type] ?? item.type}</Text>
            <Text style={s.date}>{new Date(item.date).toLocaleDateString('ar-EG')}</Text>
          </View>
          {item.notes && <Text style={s.notes} numberOfLines={2}>{item.notes}</Text>}
          {item.recordedByName && <Text style={s.recorder}>بواسطة: {item.recordedByName}</Text>}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.root}>
      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        <TouchableOpacity style={[s.filterPill, !typeFilter && s.filterPillActive]} onPress={() => setTypeFilter('')}>
          <Text style={[s.filterPillText, !typeFilter && s.filterPillTextActive]}>الكل</Text>
        </TouchableOpacity>
        {RECORD_TYPES.map(t => (
          <TouchableOpacity key={t} style={[s.filterPill, typeFilter === t && s.filterPillActive]} onPress={() => setTypeFilter(typeFilter === t ? '' : t)}>
            <Ionicons name={TYPE_ICON[t]} size={12} color={typeFilter === t ? '#fff' : TYPE_COLOR[t]} />
            <Text style={[s.filterPillText, typeFilter === t && s.filterPillTextActive]}>{TYPE_AR[t]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && records.length === 0 ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          onEndReached={loadMore} onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={s.empty}>لا توجد سجلات</Text>}
          ListFooterComponent={loading && records.length > 0 ? <ActivityIndicator color="#6366f1" style={{ margin: 12 }} /> : null}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCreate(false); resetForm() }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setShowCreate(false); resetForm() }}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>سجل روحي جديد</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>العضو</Text>
            {selMember ? (
              <TouchableOpacity style={s.selectedChip} onPress={() => { setSelMember(null); setMemberSearch(''); setMemberResults([]) }}>
                <Ionicons name="close-circle" size={16} color="#6366f1" />
                <Text style={s.selectedChipText}>{selMember.fullName}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput style={s.input} value={memberSearch} onChangeText={searchMembers} placeholder="ابحث باسم العضو..." placeholderTextColor="#9ca3af" textAlign="right" />
                {memberResults.map(m => (
                  <TouchableOpacity key={m.id} style={s.memberOpt} onPress={() => { setSelMember(m); setMemberResults([]) }}>
                    <Text style={s.memberOptText}>{m.fullName}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={s.fieldLabel}>النوع</Text>
            <View style={s.typeGrid}>
              {RECORD_TYPES.map(t => {
                const active = recType === t
                const color  = TYPE_COLOR[t]
                return (
                  <TouchableOpacity key={t} style={[s.typeBtn, active && { backgroundColor: color, borderColor: color }]} onPress={() => setRecType(t)}>
                    <Ionicons name={TYPE_ICON[t]} size={18} color={active ? '#fff' : color} />
                    <Text style={[s.typeBtnText, active && { color: '#fff' }]}>{TYPE_AR[t]}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={s.fieldLabel}>التاريخ</Text>
            <TextInput style={s.input} value={recDate} onChangeText={setRecDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={[s.input, { height: 80 }]} value={recNotes} onChangeText={setRecNotes} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" multiline textAlignVertical="top" />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#f8fafc' },
  filterBar:         { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterContent:     { flexDirection: 'row', gap: 8, padding: 10 },
  filterPill:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterPillActive:  { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterPillText:    { fontSize: 13, color: '#6b7280' },
  filterPillTextActive:{ color: '#fff', fontWeight: '600' },
  list:              { padding: 12, paddingBottom: 90 },
  card:              { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  typeIcon:          { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody:          { flex: 1, gap: 4, alignItems: 'flex-end' },
  memberName:        { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  cardRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge:         { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  date:              { fontSize: 12, color: '#9ca3af' },
  notes:             { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  recorder:          { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  empty:             { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:               { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:        { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:       { fontSize: 15, color: '#9ca3af' },
  modalSave:         { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:         { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:             { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  memberOpt:         { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  memberOptText:     { fontSize: 14, color: '#374151', textAlign: 'right' },
  selectedChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ede9fe', borderRadius: 10, padding: 10 },
  selectedChipText:  { flex: 1, fontSize: 14, color: '#6366f1', fontWeight: '600', textAlign: 'right' },
  typeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:           { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  typeBtnText:       { fontSize: 13, color: '#374151', fontWeight: '600' },
})
