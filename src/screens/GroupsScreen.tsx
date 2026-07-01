import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface Group {
  id: string; name: string; servantName?: string
  classes: { id: string; className: string; ageGroup?: string; servantCount: number; memberCount: number }[]
}

const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']

export default function GroupsScreen() {
  const navigation = useNavigation<any>()
  const { user }   = useAuth()
  const canManage  = ADMIN_ROLES.includes(user?.role ?? '')

  const [groups,     setGroups]     = useState<Group[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<Group | null>(null)
  const [expanded,   setExpanded]   = useState<string | null>(null)

  // Form
  const [name,    setName]    = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<Group[]>('/groups')
      setGroups(Array.isArray(r.data) ? r.data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const openCreate = () => { setEditing(null); setName(''); setShowForm(true) }
  const openEdit   = (g: Group) => { setEditing(g); setName(g.name); setShowForm(true) }

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('', 'اسم المجموعة مطلوب')
    setSaving(true)
    try {
      if (editing) await api.put(`/groups/${editing.id}`, { name: name.trim() })
      else         await api.post('/groups', { name: name.trim() })
      setShowForm(false); load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const handleDelete = (g: Group) => {
    Alert.alert('حذف المجموعة', `حذف "${g.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/groups/${g.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const AGE_AR: Record<string, string> = { Nursery: 'تمهيدي', Kg: 'رياض', Primary: 'ابتدائي', Preparatory: 'إعدادي', Secondary: 'ثانوي', University: 'جامعي', Adults: 'كبار' }

  const renderItem = ({ item }: { item: Group }) => {
    const isOpen = expanded === item.id
    const totalMembers = item.classes.reduce((s, c) => s + c.memberCount, 0)
    return (
      <View style={s.card}>
        <TouchableOpacity style={s.cardHeader} onPress={() => setExpanded(isOpen ? null : item.id)}>
          <View style={s.chevRow}>
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
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
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{item.name}</Text>
            {item.servantName && <Text style={s.cardSub}>{item.servantName}</Text>}
            <View style={s.statsRow}>
              <Text style={s.stat}>{item.classes.length} فصل</Text>
              <Text style={s.statDot}>·</Text>
              <Text style={s.stat}>{totalMembers} عضو</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isOpen && item.classes.length > 0 && (
          <View style={s.classList}>
            {item.classes.map(c => (
              <TouchableOpacity key={c.id} style={s.classRow} onPress={() => navigation.navigate('ClassDetail', { id: c.id, name: c.className })}>
                {c.ageGroup && <View style={s.ageBadge}><Text style={s.ageBadgeText}>{AGE_AR[c.ageGroup] ?? c.ageGroup}</Text></View>}
                <Text style={s.className}>{c.className}</Text>
                <View style={s.classStats}>
                  <Ionicons name="people-outline" size={12} color="#9ca3af" />
                  <Text style={s.classStatText}>{c.memberCount}</Text>
                </View>
                <Ionicons name="chevron-back" size={14} color="#d1d5db" />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {isOpen && item.classes.length === 0 && (
          <Text style={s.emptyClasses}>لا توجد فصول في هذه المجموعة</Text>
        )}
      </View>
    )
  }

  return (
    <View style={s.root}>
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد مجموعات</Text>}
          ListHeaderComponent={<Text style={s.count}>{groups.length} مجموعة</Text>}
        />
      )}

      {canManage && (
        <TouchableOpacity style={s.fab} onPress={openCreate}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{editing ? 'تعديل المجموعة' : 'مجموعة جديدة'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16, backgroundColor: '#f8fafc', flex: 1 }}>
            <Text style={s.fieldLabel}>اسم المجموعة *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="مثال: مرحلة الثانوي" placeholderTextColor="#9ca3af" textAlign="right" autoFocus />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f8fafc' },
  list:          { padding: 12, paddingBottom: 90 },
  count:         { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginBottom: 8 },
  card:          { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  chevRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardInfo:      { flex: 1, alignItems: 'flex-end', gap: 3 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  cardSub:       { fontSize: 12, color: '#6b7280' },
  statsRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stat:          { fontSize: 12, color: '#9ca3af' },
  statDot:       { color: '#d1d5db' },
  classList:     { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 12, paddingBottom: 8 },
  classRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  className:     { flex: 1, fontSize: 14, color: '#374151', textAlign: 'right' },
  classStats:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  classStatText: { fontSize: 12, color: '#9ca3af' },
  ageBadge:      { backgroundColor: '#ede9fe', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  ageBadgeText:  { fontSize: 10, color: '#7c3aed', fontWeight: '600' },
  emptyClasses:  { textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingVertical: 12 },
  empty:         { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:           { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:   { fontSize: 15, color: '#9ca3af' },
  modalSave:     { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  fieldLabel:    { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 4, marginBottom: 8 },
  input:         { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
})
