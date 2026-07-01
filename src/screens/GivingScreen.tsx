import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface GivingRecord {
  id: string; familyId: string; familyName?: string; amount: number; date: string
  type: string; notes?: string; isConfidential: boolean
}
interface GivingSummary { totalGiven: number; pledgedAmount?: number; byType: { type: string; total: number }[] }
interface FamilyOpt { id: string; familyName: string }

const GIVING_TYPES    = ['Tithe', 'Pledge', 'Donation', 'Building', 'Other']
const GIVING_TYPE_AR: Record<string, string>    = { Tithe: 'عشور', Pledge: 'نذر', Donation: 'تبرع', Building: 'البناء', Other: 'أخرى' }
const GIVING_TYPE_COLOR: Record<string, string> = { Tithe: '#7c3aed', Pledge: '#0891b2', Donation: '#059669', Building: '#d97706', Other: '#6b7280' }

const YEAR_NOW = new Date().getFullYear()

export default function GivingScreen() {
  const [families,   setFamilies]   = useState<FamilyOpt[]>([])
  const [selFamily,  setSelFamily]  = useState<FamilyOpt | null>(null)
  const [year,       setYear]       = useState(YEAR_NOW)
  const [records,    setRecords]    = useState<GivingRecord[]>([])
  const [summary,    setSummary]    = useState<GivingSummary | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showFamily, setShowFamily] = useState(false)
  const [famSearch,  setFamSearch]  = useState('')

  // Form
  const [amount,     setAmount]     = useState('')
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0])
  const [giveType,   setGiveType]   = useState('Tithe')
  const [notes,      setNotes]      = useState('')
  const [isConfid,   setIsConfid]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    api.get<{ items: FamilyOpt[] }>('/families', { params: { pageSize: 500 } })
      .then(r => setFamilies(r.data.items ?? (r.data as any)))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    if (!selFamily) return
    setLoading(true)
    try {
      const [rr, rs] = await Promise.all([
        api.get<GivingRecord[]>('/giving', { params: { familyId: selFamily.id, year } }),
        api.get<GivingSummary>('/giving/summary', { params: { familyId: selFamily.id, year } }),
      ])
      setRecords(Array.isArray(rr.data) ? rr.data : [])
      setSummary(rs.data)
    } catch { setRecords([]); setSummary(null) }
    setLoading(false)
  }, [selFamily, year])

  useEffect(() => { load() }, [selFamily, year])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const handleSave = async () => {
    if (!selFamily) return Alert.alert('', 'اختر عائلة')
    if (!amount || isNaN(Number(amount))) return Alert.alert('', 'أدخل مبلغاً صحيحاً')
    setSaving(true)
    try {
      await api.post('/giving', { familyId: selFamily.id, amount: Number(amount), date, type: giveType, notes: notes || undefined, isConfidential: isConfid })
      setShowCreate(false)
      setAmount(''); setDate(new Date().toISOString().split('T')[0]); setGiveType('Tithe'); setNotes(''); setIsConfid(false)
      load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const handleDelete = (rec: GivingRecord) => {
    Alert.alert('حذف السجل', `حذف ${GIVING_TYPE_AR[rec.type]} ${rec.amount} جنيه؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/giving/${rec.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const filteredFamilies = famSearch ? families.filter(f => f.familyName.toLowerCase().includes(famSearch.toLowerCase())) : families

  const renderRecord = ({ item }: { item: GivingRecord }) => {
    const color = GIVING_TYPE_COLOR[item.type] ?? '#6b7280'
    return (
      <View style={s.card}>
        <View style={[s.typeDot, { backgroundColor: color }]} />
        <View style={s.cardBody}>
          <View style={s.cardRow}>
            <Text style={[s.cardType, { color }]}>{GIVING_TYPE_AR[item.type] ?? item.type}</Text>
            <Text style={s.cardDate}>{new Date(item.date).toLocaleDateString('ar-EG')}</Text>
          </View>
          <Text style={s.cardAmount}>{item.amount.toLocaleString('ar-EG')} جنيه</Text>
          {item.notes && <Text style={s.cardNotes} numberOfLines={1}>{item.notes}</Text>}
          {item.isConfidential && (
            <View style={s.confRow}>
              <Ionicons name="lock-closed-outline" size={11} color="#9ca3af" />
              <Text style={s.confText}>سري</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.root}>
      {/* Family + Year selector */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.yearBtn} onPress={() => setYear(y => y - 1)}>
          <Ionicons name="chevron-back" size={18} color="#6366f1" />
        </TouchableOpacity>
        <Text style={s.yearText}>{year}</Text>
        <TouchableOpacity style={s.yearBtn} onPress={() => setYear(y => y + 1)}>
          <Ionicons name="chevron-forward" size={18} color="#6366f1" />
        </TouchableOpacity>
        <TouchableOpacity style={s.familyBtn} onPress={() => setShowFamily(true)}>
          <Ionicons name="people-outline" size={16} color="#6366f1" />
          <Text style={s.familyBtnText} numberOfLines={1}>{selFamily ? selFamily.familyName : 'اختر عائلة'}</Text>
          <Ionicons name="chevron-down" size={14} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {!selFamily ? (
        <View style={s.placeholder}>
          <Ionicons name="people-outline" size={48} color="#d1d5db" />
          <Text style={s.placeholderText}>اختر عائلة لعرض التبرعات</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={r => r.id}
          renderItem={renderRecord}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد سجلات لهذا العام</Text>}
          ListHeaderComponent={
            summary ? (
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>ملخص {year}</Text>
                <Text style={s.summaryTotal}>{summary.totalGiven.toLocaleString('ar-EG')} جنيه</Text>
                {summary.pledgedAmount ? (
                  <Text style={s.summaryPledge}>النذر: {summary.pledgedAmount.toLocaleString('ar-EG')} جنيه</Text>
                ) : null}
                <View style={s.summaryByType}>
                  {summary.byType.map(bt => (
                    <View key={bt.type} style={s.summaryTypeRow}>
                      <Text style={s.summaryTypeAmt}>{bt.total.toLocaleString('ar-EG')}</Text>
                      <Text style={s.summaryTypeLabel}>{GIVING_TYPE_AR[bt.type] ?? bt.type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}

      {selFamily && (
        <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Family picker modal */}
      <Modal visible={showFamily} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFamily(false)}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => setShowFamily(false)}><Text style={s.modalCancel}>إغلاق</Text></TouchableOpacity>
          <Text style={s.modalTitle}>اختر عائلة</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={s.famSearchBar}>
            <Ionicons name="search-outline" size={16} color="#9ca3af" />
            <TextInput style={s.famSearchInput} value={famSearch} onChangeText={setFamSearch} placeholder="بحث..." placeholderTextColor="#9ca3af" textAlign="right" />
          </View>
          <FlatList
            data={filteredFamilies}
            keyExtractor={f => f.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.famItem} onPress={() => { setSelFamily(item); setShowFamily(false); setFamSearch('') }}>
                <Ionicons name={selFamily?.id === item.id ? 'checkmark-circle' : 'ellipse-outline'} size={20} color="#6366f1" />
                <Text style={s.famItemText}>{item.familyName}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>سجل تبرع جديد</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>النوع</Text>
            <View style={s.typeGrid}>
              {GIVING_TYPES.map(t => (
                <TouchableOpacity key={t} style={[s.pill, giveType === t && s.pillActive]} onPress={() => setGiveType(t)}>
                  <Text style={[s.pillText, giveType === t && s.pillTextActive]}>{GIVING_TYPE_AR[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLabel}>المبلغ (جنيه)</Text>
            <TextInput style={s.input} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="numeric" textAlign="right" />
            <Text style={s.fieldLabel}>التاريخ</Text>
            <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" textAlign="right" />
            <Text style={s.fieldLabel}>ملاحظات</Text>
            <TextInput style={s.input} value={notes} onChangeText={setNotes} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" />
            <TouchableOpacity style={s.checkRow} onPress={() => setIsConfid(p => !p)}>
              <View style={[s.check, isConfid && s.checkActive]}>{isConfid && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
              <Text style={s.checkLabel}>سري (لا يظهر للآخرين)</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#f8fafc' },
  topBar:            { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  yearBtn:           { padding: 6 },
  yearText:          { fontSize: 16, fontWeight: '700', color: '#1f2937', minWidth: 44, textAlign: 'center' },
  familyBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  familyBtnText:     { flex: 1, fontSize: 13, color: '#374151', textAlign: 'right' },
  placeholder:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  placeholderText:   { color: '#9ca3af', fontSize: 15 },
  list:              { padding: 12, paddingBottom: 90 },
  summaryCard:       { backgroundColor: '#6366f1', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'flex-end' },
  summaryTitle:      { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  summaryTotal:      { color: '#fff', fontSize: 28, fontWeight: '800', marginVertical: 4 },
  summaryPledge:     { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  summaryByType:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, width: '100%' },
  summaryTypeRow:    { alignItems: 'flex-end' },
  summaryTypeLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  summaryTypeAmt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  card:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  typeDot:           { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 4 },
  cardBody:          { flex: 1, alignItems: 'flex-end', gap: 4 },
  cardRow:           { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cardType:          { fontSize: 12, fontWeight: '700' },
  cardDate:          { fontSize: 12, color: '#9ca3af' },
  cardAmount:        { fontSize: 18, fontWeight: '800', color: '#1f2937', textAlign: 'right' },
  cardNotes:         { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  confRow:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  confText:          { fontSize: 11, color: '#9ca3af' },
  empty:             { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:               { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  famSearchBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  famSearchInput:    { flex: 1, fontSize: 14, color: '#374151' },
  famItem:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  famItemText:       { flex: 1, fontSize: 14, color: '#374151', textAlign: 'right' },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:        { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:       { fontSize: 15, color: '#9ca3af' },
  modalSave:         { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:         { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:             { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  typeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:              { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive:        { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:          { fontSize: 13, color: '#6b7280' },
  pillTextActive:    { color: '#fff', fontWeight: '600' },
  checkRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  check:             { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  checkActive:       { backgroundColor: '#6366f1' },
  checkLabel:        { fontSize: 14, color: '#374151' },
})
