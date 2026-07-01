import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface CalEvent {
  id: string; title: string; description?: string; type: string
  startDateTime: string; endDateTime?: string; location?: string
  attendanceCount: number; isRecurring?: boolean; recurrenceType?: string
}

const EVENT_TYPES = ['Mass', 'Meeting', 'Trip', 'Service', 'Other']
const TYPE_COLOR: Record<string, string> = { Mass: '#7c3aed', Meeting: '#0891b2', Trip: '#d97706', Service: '#059669', Other: '#6b7280' }
const TYPE_AR:    Record<string, string> = { Mass: 'قداس', Meeting: 'اجتماع', Trip: 'رحلة', Service: 'خدمة', Other: 'أخرى' }
const TYPE_ICON:  Record<string, any>   = { Mass: 'church', Meeting: 'people', Trip: 'bus', Service: 'hand-left', Other: 'ellipse' }
const MONTH_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']

function fmt(dt: string) { return new Date(dt).toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' }) }
function fmtTime(dt: string) { return new Date(dt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) }
function isUpcoming(dt: string) { return new Date(dt) >= new Date(new Date().setHours(0, 0, 0, 0)) }

export default function EventsScreen() {
  const { user } = useAuth()
  const canManage = ADMIN_ROLES.includes(user?.role ?? '')
  const now = new Date()
  const [year, setYear]             = useState(now.getFullYear())
  const [month, setMonth]           = useState(now.getMonth() + 1)
  const [events, setEvents]         = useState<CalEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<CalEvent | null>(null)

  // Form state
  const [title,        setTitle]       = useState('')
  const [description,  setDesc]        = useState('')
  const [type,         setType]        = useState('Mass')
  const [startDT,      setStartDT]     = useState('')
  const [endDT,        setEndDT]       = useState('')
  const [location,     setLocation]    = useState('')
  const [isRecurring,  setIsRecurring] = useState(false)
  const [saving,       setSaving]      = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<CalEvent[]>('/events', { params: { year, month } })
      setEvents(r.data)
    } catch { setEvents([]) }
    finally { setLoading(false) }
  }, [year, month])

  useEffect(() => { load() }, [load])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const openCreate = () => {
    setEditing(null)
    setTitle(''); setDesc(''); setType('Mass')
    setStartDT(`${year}-${String(month).padStart(2,'0')}-01T10:00`)
    setEndDT(''); setLocation(''); setIsRecurring(false)
    setShowForm(true)
  }

  const openEdit = (e: CalEvent) => {
    setEditing(e)
    setTitle(e.title); setDesc(e.description ?? ''); setType(e.type)
    setStartDT(e.startDateTime.slice(0, 16)); setEndDT(e.endDateTime?.slice(0, 16) ?? '')
    setLocation(e.location ?? ''); setIsRecurring(e.isRecurring ?? false)
    setShowForm(true)
  }

  const handleDelete = (e: CalEvent) => {
    Alert.alert('حذف الحدث', `هل تريد حذف "${e.title}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/events/${e.id}`); load() }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('', 'العنوان مطلوب')
    if (!startDT)      return Alert.alert('', 'تاريخ البدء مطلوب')
    setSaving(true)
    try {
      const body = { title: title.trim(), description: description || undefined, type, startDateTime: startDT, endDateTime: endDT || undefined, location: location || undefined, isRecurring, recurrenceType: isRecurring ? 'Weekly' : undefined }
      if (editing) await api.put(`/events/${editing.id}`, body)
      else         await api.post('/events', body)
      setShowForm(false); load()
    } catch { Alert.alert('خطأ', 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const upcoming = events.filter(e => isUpcoming(e.startDateTime))
  const past     = events.filter(e => !isUpcoming(e.startDateTime))

  const renderItem = ({ item }: { item: CalEvent }) => {
    const color = TYPE_COLOR[item.type] ?? '#6b7280'
    const isPast = !isUpcoming(item.startDateTime)
    return (
      <View style={[s.card, isPast && s.cardPast]}>
        <View style={[s.typeStripe, { backgroundColor: color }]} />
        <View style={s.cardBody}>
          <View style={s.cardTop}>
            <View style={[s.typeBadge, { backgroundColor: color + '20' }]}>
              <Ionicons name={TYPE_ICON[item.type] ?? 'ellipse'} size={12} color={color} />
              <Text style={[s.typeText, { color }]}>{TYPE_AR[item.type] ?? item.type}</Text>
            </View>
            <Text style={s.cardTitle}>{item.title}</Text>
          </View>
          <View style={s.cardMeta}>
            <Ionicons name="time-outline" size={13} color="#9ca3af" />
            <Text style={s.metaText}>{fmt(item.startDateTime)} {fmtTime(item.startDateTime)}</Text>
          </View>
          {item.location && (
            <View style={s.cardMeta}>
              <Ionicons name="location-outline" size={13} color="#9ca3af" />
              <Text style={s.metaText}>{item.location}</Text>
            </View>
          )}
          {item.description && <Text style={s.desc} numberOfLines={2}>{item.description}</Text>}
          <View style={s.cardFoot}>
            {item.attendanceCount > 0 && (
              <View style={s.attendRow}>
                <Ionicons name="people-outline" size={12} color="#6366f1" />
                <Text style={s.attendText}>{item.attendanceCount} حضر</Text>
              </View>
            )}
            {canManage && (
              <View style={s.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil-outline" size={16} color="#6366f1" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={s.root}>
      <View style={s.navRow}>
        <TouchableOpacity style={s.navBtn} onPress={nextMonth}>
          <Ionicons name="chevron-forward" size={20} color="#6366f1" />
        </TouchableOpacity>
        <Text style={s.navTitle}>{MONTH_AR[month - 1]} {year}</Text>
        <TouchableOpacity style={s.navBtn} onPress={prevMonth}>
          <Ionicons name="chevron-back" size={20} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={[...upcoming, ...past]}
          keyExtractor={e => e.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<View style={s.emptyBox}><Text style={s.emptyText}>لا توجد أحداث هذا الشهر</Text></View>}
          ListHeaderComponent={upcoming.length > 0 ? <Text style={s.sectionLabel}>قادم ({upcoming.length})</Text> : null}
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
            <Text style={s.modalTitle}>{editing ? 'تعديل الحدث' : 'حدث جديد'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.fieldLabel}>العنوان *</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="عنوان الحدث..." placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>النوع</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {EVENT_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[s.pill, type === t && s.pillActive]} onPress={() => setType(t)}>
                    <Text style={[s.pillText, type === t && s.pillTextActive]}>{TYPE_AR[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.fieldLabel}>وقت البدء * (YYYY-MM-DDThh:mm)</Text>
            <TextInput style={s.input} value={startDT} onChangeText={setStartDT} placeholder="2025-01-15T10:00" placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>وقت الانتهاء</Text>
            <TextInput style={s.input} value={endDT} onChangeText={setEndDT} placeholder="اختياري..." placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>الموقع</Text>
            <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="مكان الحدث..." placeholderTextColor="#9ca3af" textAlign="right" />

            <Text style={s.fieldLabel}>الوصف</Text>
            <TextInput style={[s.input, { height: 80 }]} value={description} onChangeText={setDesc} placeholder="وصف الحدث..." placeholderTextColor="#9ca3af" textAlign="right" multiline textAlignVertical="top" />

            <TouchableOpacity style={s.checkRow} onPress={() => setIsRecurring(p => !p)}>
              <View style={[s.check, isRecurring && s.checkActive]}>
                {isRecurring && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={s.checkLabel}>حدث متكرر (أسبوعي)</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f8fafc' },
  navRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  navBtn:        { padding: 6 },
  navTitle:      { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  sectionLabel:  { fontSize: 12, fontWeight: '700', color: '#9ca3af', textAlign: 'right', paddingHorizontal: 4, marginBottom: 8, marginTop: 4 },
  list:          { padding: 14, paddingBottom: 90 },
  card:          { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 },
  cardPast:      { opacity: 0.6 },
  typeStripe:    { width: 4 },
  cardBody:      { flex: 1, padding: 14, gap: 5 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle:     { fontSize: 15, fontWeight: '700', color: '#1f2937', flex: 1, textAlign: 'right' },
  typeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:      { fontSize: 11, fontWeight: '600' },
  cardMeta:      { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  metaText:      { fontSize: 12, color: '#6b7280' },
  desc:          { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  cardFoot:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  attendRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attendText:    { fontSize: 11, color: '#6366f1', fontWeight: '600' },
  cardActions:   { flexDirection: 'row', gap: 12 },
  emptyBox:      { alignItems: 'center', paddingVertical: 60 },
  emptyText:     { color: '#9ca3af', fontSize: 15 },
  fab:           { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:   { fontSize: 15, color: '#9ca3af' },
  modalSave:     { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:     { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:    { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:         { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  pill:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:      { fontSize: 13, color: '#6b7280' },
  pillTextActive:{ color: '#fff', fontWeight: '600' },
  checkRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
  check:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  checkActive:   { backgroundColor: '#6366f1' },
  checkLabel:    { fontSize: 14, color: '#374151' },
})
