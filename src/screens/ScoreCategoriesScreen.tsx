import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface ScoreCategory {
  id: string; name: string; description?: string; maxScore: number
  isPredefined: boolean; scope: 'global' | 'class' | 'group'
  classId?: string; groupId?: string; createdAt: string
}
interface ScopeOption { id: string; label: string }
type ScopeFilter = 'all' | 'global' | 'class' | 'group'

const SCOPE_AR: Record<string, string> = { global: 'عام', class: 'فصل', group: 'مجموعة' }
const SCOPE_COLOR: Record<string, string> = { global: '#6366f1', class: '#0891b2', group: '#059669' }

export default function ScoreCategoriesScreen() {
  const [categories, setCategories] = useState<ScoreCategory[]>([])
  const [classes,    setClasses]    = useState<ScopeOption[]>([])
  const [groups,     setGroups]     = useState<ScopeOption[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')

  // Form
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<ScoreCategory | null>(null)
  const [fName,      setFName]      = useState('')
  const [fDesc,      setFDesc]      = useState('')
  const [fMaxScore,  setFMaxScore]  = useState('100')
  const [fPredefined,setFPredefined]= useState(false)
  const [fScopeType, setFScopeType] = useState<'global' | 'class' | 'group'>('global')
  const [fClassId,   setFClassId]   = useState('')
  const [fGroupId,   setFGroupId]   = useState('')
  const [saving,     setSaving]     = useState(false)

  const load = useCallback(async () => {
    try {
      const [catRes, clsRes, grpRes] = await Promise.all([
        api.get<ScoreCategory[]>('/score-categories'),
        api.get<{ items: { id: string; className: string }[] }>('/classes', { params: { pageSize: 200 } }),
        api.get<{ id: string; name: string }[]>('/groups'),
      ])
      setCategories(Array.isArray(catRes.data) ? catRes.data : [])
      setClasses((clsRes.data.items ?? []).map(c => ({ id: c.id, label: c.className })))
      setGroups((Array.isArray(grpRes.data) ? grpRes.data : []).map((g: any) => ({ id: g.id, label: g.name })))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const openCreate = () => {
    setEditing(null); setFName(''); setFDesc(''); setFMaxScore('100')
    setFPredefined(false); setFScopeType('global'); setFClassId(''); setFGroupId('')
    setShowForm(true)
  }

  const openEdit = (cat: ScoreCategory) => {
    setEditing(cat); setFName(cat.name); setFDesc(cat.description ?? ''); setFMaxScore(String(cat.maxScore))
    setFPredefined(cat.isPredefined); setFScopeType(cat.scope); setFClassId(cat.classId ?? ''); setFGroupId(cat.groupId ?? '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!fName.trim()) return Alert.alert('', 'الاسم مطلوب')
    const max = parseInt(fMaxScore)
    if (isNaN(max) || max <= 0) return Alert.alert('', 'الحد الأقصى يجب أن يكون أكبر من 0')
    setSaving(true)
    try {
      const body = {
        name: fName.trim(), description: fDesc || undefined, maxScore: max, isPredefined: fPredefined,
        classId: fScopeType === 'class' ? fClassId || undefined : undefined,
        groupId: fScopeType === 'group' ? fGroupId || undefined : undefined,
      }
      if (editing) { const r = await api.put(`/score-categories/${editing.id}`, body); setCategories(prev => prev.map(c => c.id === editing.id ? { ...c, ...r.data } : c)) }
      else { const r = await api.post('/score-categories', body); setCategories(prev => [r.data, ...prev]) }
      setShowForm(false)
    } catch (e: any) { Alert.alert('خطأ', e?.response?.data?.message ?? 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const handleDelete = (cat: ScoreCategory) => {
    Alert.alert('حذف الفئة', `حذف "${cat.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/score-categories/${cat.id}`); setCategories(prev => prev.filter(c => c.id !== cat.id)) }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const filtered = scopeFilter === 'all' ? categories : categories.filter(c => c.scope === scopeFilter)

  const renderItem = ({ item }: { item: ScoreCategory }) => (
    <View style={s.card}>
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={[s.scopeBadge, { backgroundColor: SCOPE_COLOR[item.scope] + '18', borderColor: SCOPE_COLOR[item.scope] + '40' }]}>
            <Text style={[s.scopeText, { color: SCOPE_COLOR[item.scope] }]}>{SCOPE_AR[item.scope] ?? item.scope}</Text>
          </View>
          {item.isPredefined && (
            <View style={s.predefinedBadge}><Text style={s.predefinedText}>محدد مسبقاً</Text></View>
          )}
        </View>
        <Text style={s.catName}>{item.name}</Text>
        {item.description ? <Text style={s.catDesc} numberOfLines={1}>{item.description}</Text> : null}
        <Text style={s.catMax}>حتى {item.maxScore} نقطة</Text>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="pencil-outline" size={18} color="#6366f1" />
        </TouchableOpacity>
        {!item.isPredefined && (
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )

  return (
    <View style={s.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(['all', 'global', 'class', 'group'] as ScopeFilter[]).map(f => (
          <TouchableOpacity key={f} style={[s.filterPill, scopeFilter === f && s.filterPillActive]} onPress={() => setScopeFilter(f)}>
            <Text style={[s.filterPillText, scopeFilter === f && s.filterPillTextActive]}>
              {f === 'all' ? 'الكل' : SCOPE_AR[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد فئات</Text>}
        />
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{editing ? 'تعديل فئة' : 'فئة جديدة'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>الاسم *</Text>
            <TextInput style={s.input} value={fName} onChangeText={setFName} placeholder="اسم الفئة" placeholderTextColor="#9ca3af" textAlign="right" autoFocus />

            <Text style={s.fieldLabel}>الوصف</Text>
            <TextInput style={s.input} value={fDesc} onChangeText={setFDesc} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>الحد الأقصى للنقاط</Text>
            <TextInput style={s.input} value={fMaxScore} onChangeText={setFMaxScore} keyboardType="number-pad" textAlign="right" />

            <View style={s.switchRow}>
              <Switch value={fPredefined} onValueChange={setFPredefined} trackColor={{ true: '#6366f1' }} />
              <Text style={s.switchLabel}>محدد مسبقاً (يظهر للأعضاء)</Text>
            </View>

            <Text style={s.fieldLabel}>النطاق</Text>
            <View style={s.scopeRow}>
              {(['global', 'class', 'group'] as const).map(t => (
                <TouchableOpacity key={t} style={[s.scopeBtn, fScopeType === t && s.scopeBtnActive]} onPress={() => setFScopeType(t)}>
                  <Text style={[s.scopeBtnText, fScopeType === t && s.scopeBtnTextActive]}>{SCOPE_AR[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {fScopeType === 'class' && (
              <>
                <Text style={s.fieldLabel}>الفصل</Text>
                {classes.map(c => (
                  <TouchableOpacity key={c.id} style={[s.optRow, fClassId === c.id && s.optRowActive]} onPress={() => setFClassId(c.id)}>
                    <Text style={[s.optText, fClassId === c.id && { color: '#6366f1', fontWeight: '700' }]}>{c.label}</Text>
                    {fClassId === c.id && <Ionicons name="checkmark" size={16} color="#6366f1" />}
                  </TouchableOpacity>
                ))}
              </>
            )}

            {fScopeType === 'group' && (
              <>
                <Text style={s.fieldLabel}>المجموعة</Text>
                {groups.map(g => (
                  <TouchableOpacity key={g.id} style={[s.optRow, fGroupId === g.id && s.optRowActive]} onPress={() => setFGroupId(g.id)}>
                    <Text style={[s.optText, fGroupId === g.id && { color: '#6366f1', fontWeight: '700' }]}>{g.label}</Text>
                    {fGroupId === g.id && <Ionicons name="checkmark" size={16} color="#6366f1" />}
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
  root:              { flex: 1, backgroundColor: '#f8fafc' },
  filterBar:         { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterContent:     { flexDirection: 'row', gap: 8, padding: 10 },
  filterPill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterPillActive:  { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterPillText:    { fontSize: 13, color: '#6b7280' },
  filterPillTextActive: { color: '#fff', fontWeight: '600' },
  list:              { padding: 12, paddingBottom: 90 },
  card:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardBody:          { flex: 1, gap: 4 },
  cardTop:           { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  scopeBadge:        { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  scopeText:         { fontSize: 11, fontWeight: '700' },
  predefinedBadge:   { backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  predefinedText:    { fontSize: 11, color: '#d97706', fontWeight: '600' },
  catName:           { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  catDesc:           { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  catMax:            { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  cardActions:       { gap: 10, alignItems: 'center' },
  empty:             { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:               { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:        { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:       { fontSize: 15, color: '#9ca3af' },
  modalSave:         { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:         { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:             { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  switchRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  switchLabel:       { fontSize: 14, color: '#374151' },
  scopeRow:          { flexDirection: 'row', gap: 8 },
  scopeBtn:          { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center', backgroundColor: '#fff' },
  scopeBtnActive:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  scopeBtnText:      { fontSize: 13, color: '#374151', fontWeight: '600' },
  scopeBtnTextActive:{ color: '#fff' },
  optRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  optRowActive:      { borderColor: '#6366f1', backgroundColor: '#ede9fe' },
  optText:           { fontSize: 14, color: '#374151', textAlign: 'right' },
})
