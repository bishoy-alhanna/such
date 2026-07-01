import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface Task {
  id: string; title: string; notes?: string; dueDate?: string
  status: 'Open' | 'Done' | 'Cancelled'
  assignedToUserId: string; assignedToName?: string
  relatedMemberId?: string; relatedMemberName?: string
  createdAt: string; completedAt?: string; isOverdue: boolean
}
interface MemberOpt { id: string; fullName: string }

const STATUS_AR:    Record<string, string> = { Open: 'مفتوحة', Done: 'منجزة', Cancelled: 'ملغاة' }
const STATUS_COLOR: Record<string, string> = { Open: '#0891b2', Done: '#059669', Cancelled: '#9ca3af' }
type Filter = 'Open' | 'Done' | 'Cancelled' | 'all'
const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']

export default function FollowUpTasksScreen() {
  const navigation  = useNavigation<any>()
  const { user }    = useAuth()
  const isAdmin     = ADMIN_ROLES.includes(user?.role ?? '')

  const [tasks,     setTasks]     = useState<Task[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [filter,    setFilter]    = useState<Filter>('Open')
  const [myOnly,    setMyOnly]    = useState(false)

  // Create form
  const [showForm,  setShowForm]  = useState(false)
  const [title,     setTitle]     = useState('')
  const [notes,     setNotes]     = useState('')
  const [dueDate,   setDueDate]   = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults,setMemberResults]= useState<MemberOpt[]>([])
  const [selMember, setSelMember] = useState<MemberOpt | null>(null)
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    try {
      const params: Record<string, any> = {}
      if (filter !== 'all') params.status = filter
      if (myOnly) params.assignedToMe = true
      const r = await api.get<Task[]>('/tasks', { params })
      setTasks(Array.isArray(r.data) ? r.data : [])
    } catch {}
    setLoading(false)
  }, [filter, myOnly])

  useEffect(() => { setLoading(true); load() }, [load])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const searchMembers = async (q: string) => {
    setMemberSearch(q)
    if (q.length < 2) return setMemberResults([])
    try {
      const r = await api.get<{ items: MemberOpt[] }>('/members/search', { params: { q, pageSize: 10 } })
      setMemberResults(r.data.items ?? [])
    } catch {}
  }

  const resetForm = () => {
    setTitle(''); setNotes(''); setDueDate('')
    setMemberSearch(''); setMemberResults([]); setSelMember(null)
  }

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('', 'العنوان مطلوب')
    setSaving(true)
    try {
      await api.post('/tasks', {
        title: title.trim(),
        notes: notes || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        relatedMemberId: selMember?.id ?? null,
      })
      setShowForm(false); resetForm(); load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const updateStatus = async (task: Task, status: Task['status']) => {
    try {
      await api.put(`/tasks/${task.id}`, { title: task.title, notes: task.notes, dueDate: task.dueDate, status })
      load()
    } catch { Alert.alert('خطأ', 'تعذّر التحديث') }
  }

  const handleDelete = (task: Task) => {
    Alert.alert('حذف المهمة', `حذف "${task.title}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/tasks/${task.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const renderTask = ({ item }: { item: Task }) => (
    <View style={s.card}>
      <View style={s.cardMain}>
        <View style={s.cardHeader}>
          <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22', borderColor: STATUS_COLOR[item.status] + '55' }]}>
            <Text style={[s.statusText, { color: STATUS_COLOR[item.status] }]}>{STATUS_AR[item.status]}</Text>
          </View>
          {item.isOverdue && (
            <View style={s.overdueBadge}><Text style={s.overdueText}>متأخرة</Text></View>
          )}
        </View>
        <Text style={s.taskTitle}>{item.title}</Text>
        {item.notes ? <Text style={s.taskNotes} numberOfLines={2}>{item.notes}</Text> : null}
        <View style={s.metaRow}>
          {item.dueDate && (
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
              <Text style={s.metaText}>{new Date(item.dueDate).toLocaleDateString('ar-EG')}</Text>
            </View>
          )}
          {item.assignedToName && (
            <View style={s.metaItem}>
              <Ionicons name="person-outline" size={12} color="#9ca3af" />
              <Text style={s.metaText}>{item.assignedToName}</Text>
            </View>
          )}
          {item.relatedMemberName && (
            <TouchableOpacity style={s.metaItem} onPress={() => navigation.navigate('MemberDetail', { id: item.relatedMemberId, name: item.relatedMemberName })}>
              <Ionicons name="link-outline" size={12} color="#6366f1" />
              <Text style={[s.metaText, { color: '#6366f1' }]}>{item.relatedMemberName}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={s.cardActions}>
        {item.status === 'Open' && (
          <>
            <TouchableOpacity style={s.doneBtn} onPress={() => updateStatus(item, 'Done')}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => updateStatus(item, 'Cancelled')}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        {item.status !== 'Open' && (
          <TouchableOpacity style={s.reopenBtn} onPress={() => updateStatus(item, 'Open')}>
            <Ionicons name="refresh" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        {isAdmin && (
          <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={15} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <View style={s.root}>
      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(['Open', 'Done', 'Cancelled', 'all'] as Filter[]).map(f => (
          <TouchableOpacity key={f} style={[s.filterPill, filter === f && s.filterPillActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterPillText, filter === f && s.filterPillTextActive]}>
              {f === 'all' ? 'الكل' : STATUS_AR[f]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.filterPill, myOnly && s.filterPillActive]} onPress={() => setMyOnly(v => !v)}>
          <Ionicons name="person" size={13} color={myOnly ? '#fff' : '#6b7280'} />
          <Text style={[s.filterPillText, myOnly && s.filterPillTextActive]}>مهامي</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={t => t.id}
          renderItem={renderTask}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد مهام</Text>}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={() => setShowForm(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowForm(false); resetForm() }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm() }}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>مهمة جديدة</Text>
            <TouchableOpacity onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>العنوان *</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="عنوان المهمة..." placeholderTextColor="#9ca3af" textAlign="right" autoFocus />

            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" multiline />

            <Text style={s.fieldLabel}>تاريخ الاستحقاق</Text>
            <TextInput style={s.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>عضو مرتبط</Text>
            {selMember ? (
              <TouchableOpacity style={s.selectedChip} onPress={() => { setSelMember(null); setMemberSearch(''); setMemberResults([]) }}>
                <Ionicons name="close-circle" size={16} color="#6366f1" />
                <Text style={s.selectedChipText}>{selMember.fullName}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput style={s.input} value={memberSearch} onChangeText={searchMembers} placeholder="ابحث عن عضو..." placeholderTextColor="#9ca3af" textAlign="right" />
                {memberResults.map(m => (
                  <TouchableOpacity key={m.id} style={s.memberOpt} onPress={() => { setSelMember(m); setMemberResults([]) }}>
                    <Text style={s.memberOptText}>{m.fullName}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f8fafc' },
  filterBar:        { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterContent:    { flexDirection: 'row', gap: 8, padding: 10 },
  filterPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterPillActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterPillText:   { fontSize: 13, color: '#6b7280' },
  filterPillTextActive: { color: '#fff', fontWeight: '600' },
  list:             { padding: 12, paddingBottom: 90 },
  card:             { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardMain:         { flex: 1, gap: 6 },
  cardHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText:       { fontSize: 11, fontWeight: '700' },
  overdueBadge:     { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  overdueText:      { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  taskTitle:        { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  taskNotes:        { fontSize: 13, color: '#6b7280', textAlign: 'right' },
  metaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  metaItem:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:         { fontSize: 11, color: '#9ca3af' },
  cardActions:      { alignItems: 'center', gap: 8 },
  doneBtn:          { width: 32, height: 32, borderRadius: 16, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  cancelBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  reopenBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0891b2', alignItems: 'center', justifyContent: 'center' },
  deleteBtn:        { padding: 4 },
  empty:            { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:              { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:       { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:      { fontSize: 15, color: '#9ca3af' },
  modalSave:        { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:        { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  memberOpt:        { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  memberOptText:    { fontSize: 14, color: '#374151', textAlign: 'right' },
  selectedChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ede9fe', borderRadius: 10, padding: 10 },
  selectedChipText: { flex: 1, fontSize: 14, color: '#6366f1', fontWeight: '600', textAlign: 'right' },
})
