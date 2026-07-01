import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface ClassRow { id: string; className: string; ageGroup?: string; groupName?: string; servantCount: number; memberCount: number }
interface Group    { id: string; name: string }

const AGE_GROUPS = ['Nursery', 'Kg', 'Primary', 'Preparatory', 'Secondary', 'University', 'Adults']
const AGE_AR: Record<string, string> = { Nursery: 'تمهيدي', Kg: 'رياض', Primary: 'ابتدائي', Preparatory: 'إعدادي', Secondary: 'ثانوي', University: 'جامعي', Adults: 'كبار' }

const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']

export default function ClassesScreen() {
  const navigation = useNavigation<any>()
  const { user }   = useAuth()
  const canManage  = ADMIN_ROLES.includes(user?.role ?? '')

  const [classes,    setClasses]    = useState<ClassRow[]>([])
  const [groups,     setGroups]     = useState<Group[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQ,    setSearchQ]    = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<ClassRow | null>(null)

  // Form
  const [className,  setClassName]  = useState('')
  const [ageGroup,   setAgeGroup]   = useState('')
  const [groupId,    setGroupId]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const load = useCallback(async () => {
    try {
      const [cr, gr] = await Promise.all([
        api.get<{ items: ClassRow[] }>('/classes', { params: { q: searchQ || undefined, pageSize: 100 } }),
        api.get<Group[]>('/groups'),
      ])
      setClasses(cr.data.items ?? (cr.data as any))
      setGroups(Array.isArray(gr.data) ? gr.data : [])
    } catch {}
    setLoading(false)
  }, [searchQ])

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null); setClassName(''); setAgeGroup(''); setGroupId('')
    setShowForm(true)
  }

  const openEdit = (c: ClassRow) => {
    setEditing(c); setClassName(c.className); setAgeGroup(c.ageGroup ?? ''); setGroupId('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!className.trim()) return Alert.alert('', 'اسم الفصل مطلوب')
    setSaving(true)
    try {
      const body = { className: className.trim(), ageGroup: ageGroup || undefined, groupId: groupId || undefined }
      if (editing) await api.put(`/classes/${editing.id}`, body)
      else         await api.post('/classes', body)
      setShowForm(false); load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const handleDelete = (c: ClassRow) => {
    Alert.alert('حذف الفصل', `هل تريد حذف "${c.className}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/classes/${c.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const filtered = classes.filter(c =>
    !searchQ || c.className.toLowerCase().includes(searchQ.toLowerCase())
  )

  const renderItem = ({ item }: { item: ClassRow }) => (
    <TouchableOpacity style={s.card} onPress={() => navigation.navigate('ClassDetail', { id: item.id, name: item.className })}>
      <View style={s.cardRight}>
        {item.ageGroup && (
          <View style={s.ageBadge}><Text style={s.ageBadgeText}>{AGE_AR[item.ageGroup] ?? item.ageGroup}</Text></View>
        )}
        <Text style={s.cardTitle}>{item.className}</Text>
        {item.groupName && <Text style={s.cardSub}>{item.groupName}</Text>}
      </View>
      <View style={s.cardStats}>
        <View style={s.stat}>
          <Text style={s.statNum}>{item.memberCount}</Text>
          <Text style={s.statLabel}>عضو</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statNum}>{item.servantCount}</Text>
          <Text style={s.statLabel}>خادم</Text>
        </View>
        <View style={s.cardChevRow}>
          <Ionicons name="chevron-back" size={16} color="#d1d5db" />
          {canManage && (
            <>
              <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Ionicons name="pencil-outline" size={16} color="#6366f1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={s.root}>
      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" />
        <TextInput
          style={s.searchInput} value={searchQ} onChangeText={setSearchQ}
          placeholder="بحث في الفصول..." placeholderTextColor="#9ca3af" textAlign="right"
          onSubmitEditing={load} returnKeyType="search"
        />
        {searchQ ? <TouchableOpacity onPress={() => { setSearchQ(''); load() }}><Ionicons name="close-circle" size={16} color="#9ca3af" /></TouchableOpacity> : null}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد فصول</Text>}
          ListHeaderComponent={<Text style={s.count}>{filtered.length} فصل</Text>}
        />
      )}

      {canManage && (
        <TouchableOpacity style={s.fab} onPress={openCreate}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{editing ? 'تعديل الفصل' : 'فصل جديد'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>اسم الفصل *</Text>
            <TextInput style={s.input} value={className} onChangeText={setClassName} placeholder="اسم الفصل..." placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>المرحلة العمرية</Text>
            <View style={s.gridPills}>
              {AGE_GROUPS.map(g => (
                <TouchableOpacity key={g} style={[s.pill, ageGroup === g && s.pillActive]} onPress={() => setAgeGroup(ageGroup === g ? '' : g)}>
                  <Text style={[s.pillText, ageGroup === g && s.pillTextActive]}>{AGE_AR[g]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>المجموعة</Text>
            <View style={s.gridPills}>
              {groups.map(g => (
                <TouchableOpacity key={g.id} style={[s.pill, groupId === g.id && s.pillActive]} onPress={() => setGroupId(groupId === g.id ? '' : g.id)}>
                  <Text style={[s.pillText, groupId === g.id && s.pillTextActive]}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f8fafc' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', margin: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  searchInput:    { flex: 1, fontSize: 14, color: '#374151' },
  list:           { paddingHorizontal: 12, paddingBottom: 90 },
  count:          { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginBottom: 8 },
  card:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardRight:      { flex: 1, alignItems: 'flex-end', gap: 4 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  cardSub:        { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  ageBadge:       { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  ageBadgeText:   { fontSize: 11, color: '#7c3aed', fontWeight: '600' },
  cardStats:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat:           { alignItems: 'center' },
  statNum:        { fontSize: 16, fontWeight: '800', color: '#6366f1' },
  statLabel:      { fontSize: 10, color: '#9ca3af' },
  cardChevRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty:          { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:            { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:     { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:    { fontSize: 15, color: '#9ca3af' },
  modalSave:      { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:      { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:          { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  gridPills:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive:     { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:       { fontSize: 13, color: '#6b7280' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
})
