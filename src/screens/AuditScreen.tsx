import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface AuditEntry {
  id: string; timestamp: string; action: string; performedBy: string
  entity: string; entityId: string; details: string
}
interface AuditDetail extends AuditEntry {
  currentEntityData?: Record<string, any> | null; navLink?: string | null
}

const ACTION_COLORS: Record<string, string> = {
  LoginSuccess:          '#166534', LoginFailed:      '#991b1b',
  CreateFamily:          '#1e40af', UpdateFamily:     '#3730a3', DeleteFamily:     '#991b1b',
  CreateMember:          '#1e40af', UpdateMember:     '#3730a3', DeleteMember:     '#991b1b',
  BulkAttendance:        '#166534', CreateAttendance: '#166534', DeleteAttendance: '#991b1b',
  CreateUser:            '#1e40af', UpdateUser:       '#3730a3', DeleteUser:       '#991b1b',
  CreateClass:           '#1e40af', UpdateClass:      '#3730a3',
  CreateGroup:           '#1e40af', UpdateGroup:      '#3730a3',
}
const ACTION_BG: Record<string, string> = {
  LoginSuccess:          '#dcfce7', LoginFailed:      '#fee2e2',
  CreateFamily:          '#dbeafe', UpdateFamily:     '#e0e7ff', DeleteFamily:     '#fee2e2',
  CreateMember:          '#dbeafe', UpdateMember:     '#e0e7ff', DeleteMember:     '#fee2e2',
  BulkAttendance:        '#dcfce7', CreateAttendance: '#dcfce7', DeleteAttendance: '#fee2e2',
  CreateUser:            '#dbeafe', UpdateUser:       '#e0e7ff', DeleteUser:       '#fee2e2',
  CreateClass:           '#dbeafe', UpdateClass:      '#e0e7ff',
  CreateGroup:           '#dbeafe', UpdateGroup:      '#e0e7ff',
}

function actionColor(action: string) {
  return { bg: ACTION_BG[action] ?? '#f3f4f6', text: ACTION_COLORS[action] ?? '#374151' }
}

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

const PAGE_SIZE = 30

export default function AuditScreen() {
  const { user } = useAuth()
  const [entries,   setEntries]   = useState<AuditEntry[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const [hasMore,   setHasMore]   = useState(false)

  const [search,       setSearch]       = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [actionOptions, setActionOptions] = useState<string[]>([])
  const [entityOptions, setEntityOptions] = useState<string[]>([])

  const [detailEntry,   setDetailEntry]   = useState<AuditDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [filterModal, setFilterModal] = useState(false)

  const fetchPage = useCallback(async (pg: number, reset: boolean) => {
    if (pg === 1) reset ? setLoading(true) : setRefreshing(true)
    else setLoadingMore(true)
    try {
      const params: any = { page: pg, pageSize: PAGE_SIZE }
      if (search)       params.search = search
      if (filterAction) params.action = filterAction
      if (filterEntity) params.entity = filterEntity
      const res = await api.get('/audit', { params })
      const items: AuditEntry[] = res.data.items ?? []
      setEntries(prev => pg === 1 ? items : [...prev, ...items])
      setTotal(res.data.total ?? 0)
      setHasMore(items.length === PAGE_SIZE)
      if (res.data.actions?.length)  setActionOptions(res.data.actions)
      if (res.data.entities?.length) setEntityOptions(res.data.entities)
      setPage(pg)
    } catch {}
    setLoading(false); setRefreshing(false); setLoadingMore(false)
  }, [search, filterAction, filterEntity])

  useEffect(() => { fetchPage(1, true) }, [fetchPage])

  const onRefresh = () => fetchPage(1, false)
  const loadMore  = () => { if (!loadingMore && hasMore) fetchPage(page + 1, false) }

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/audit/${id}`)
      setDetailEntry(res.data)
    } catch {
      const row = entries.find(e => e.id === id)
      if (row) setDetailEntry({ ...row, currentEntityData: null })
    }
    setDetailLoading(false)
  }

  const hasFilters = !!(search || filterAction || filterEntity)

  if (user?.role !== 'SuperAdmin') {
    return (
      <View style={s.root}>
        <View style={s.accessDenied}>
          <Ionicons name="lock-closed-outline" size={48} color="#d1d5db" />
          <Text style={s.accessDeniedText}>للمدير العام فقط</Text>
        </View>
      </View>
    )
  }

  const renderItem = ({ item }: { item: AuditEntry }) => {
    const { bg, text } = actionColor(item.action)
    return (
      <TouchableOpacity style={s.row} onPress={() => openDetail(item.id)} activeOpacity={0.7}>
        <View style={s.rowLeft}>
          <View style={[s.actionBadge, { backgroundColor: bg }]}>
            <Text style={[s.actionText, { color: text }]} numberOfLines={1}>{item.action}</Text>
          </View>
          <Text style={s.detailsText} numberOfLines={1}>{item.details || '—'}</Text>
        </View>
        <View style={s.rowRight}>
          <Text style={s.entityText}>{item.entity}</Text>
          <Text style={s.performedBy} numberOfLines={1}>{item.performedBy}</Text>
          <Text style={s.timestamp}>{new Date(item.timestamp).toLocaleDateString('ar-EG')}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.root}>
      {/* Search + filter bar */}
      <View style={s.searchBar}>
        <TouchableOpacity
          style={[s.filterBtn, hasFilters && s.filterBtnActive]}
          onPress={() => setFilterModal(true)}
        >
          <Ionicons name="options-outline" size={18} color={hasFilters ? '#6366f1' : '#6b7280'} />
        </TouchableOpacity>
        <TextInput
          style={s.searchInput}
          placeholder="بحث..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={v => { setSearch(v) }}
          textAlign="right"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <Text style={s.totalText}>{total.toLocaleString('ar-EG')} سجل</Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#6366f1" style={{ marginVertical: 16 }} /> : null
          }
          ListEmptyComponent={
            <Text style={s.empty}>لا توجد سجلات</Text>
          }
        />
      )}

      {/* Filter modal */}
      <Modal visible={filterModal} transparent animationType="slide" onRequestClose={() => setFilterModal(false)}>
        <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={() => setFilterModal(false)}>
          <View style={fm.sheet}>
            <Text style={fm.title}>التصفية</Text>

            <Text style={fm.label}>الإجراء</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fm.pills}>
              <TouchableOpacity style={[fm.pill, !filterAction && fm.pillActive]} onPress={() => setFilterAction('')}>
                <Text style={[fm.pillText, !filterAction && fm.pillTextActive]}>الكل</Text>
              </TouchableOpacity>
              {actionOptions.map(a => (
                <TouchableOpacity key={a} style={[fm.pill, filterAction === a && fm.pillActive]} onPress={() => setFilterAction(a)}>
                  <Text style={[fm.pillText, filterAction === a && fm.pillTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={fm.label}>الكيان</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fm.pills}>
              <TouchableOpacity style={[fm.pill, !filterEntity && fm.pillActive]} onPress={() => setFilterEntity('')}>
                <Text style={[fm.pillText, !filterEntity && fm.pillTextActive]}>الكل</Text>
              </TouchableOpacity>
              {entityOptions.map(e => (
                <TouchableOpacity key={e} style={[fm.pill, filterEntity === e && fm.pillActive]} onPress={() => setFilterEntity(e)}>
                  <Text style={[fm.pillText, filterEntity === e && fm.pillTextActive]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {hasFilters && (
              <TouchableOpacity style={fm.clearBtn} onPress={() => { setFilterAction(''); setFilterEntity(''); setFilterModal(false) }}>
                <Text style={fm.clearText}>مسح التصفية</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={fm.applyBtn} onPress={() => setFilterModal(false)}>
              <Text style={fm.applyText}>تطبيق</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!detailEntry} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailEntry(null)}>
        {detailEntry && (
          <View style={dm.root}>
            <View style={dm.header}>
              <TouchableOpacity onPress={() => setDetailEntry(null)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={dm.headerTitle}>تفاصيل السجل</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={dm.body} contentContainerStyle={{ paddingBottom: 40 }}>
              {(() => {
                const { bg, text } = actionColor(detailEntry.action)
                return (
                  <View style={[dm.actionBadge, { backgroundColor: bg }]}>
                    <Text style={[dm.actionText, { color: text }]}>{detailEntry.action}</Text>
                  </View>
                )
              })()}

              <View style={dm.section}>
                {[
                  ['التوقيت',     new Date(detailEntry.timestamp).toLocaleString('ar-EG')],
                  ['نُفِّذ بواسطة', detailEntry.performedBy],
                  ['الكيان',      detailEntry.entity],
                  ['معرّف الكيان', detailEntry.entityId || '—'],
                  ['التفاصيل',    detailEntry.details || '—'],
                ].map(([label, value]) => (
                  <View key={label} style={dm.fieldRow}>
                    <Text style={dm.fieldValue}>{value}</Text>
                    <Text style={dm.fieldLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {detailEntry.currentEntityData && Object.keys(detailEntry.currentEntityData).length > 0 && (
                <>
                  <Text style={dm.sectionTitle}>البيانات الحالية</Text>
                  <View style={dm.dataGrid}>
                    {Object.entries(detailEntry.currentEntityData)
                      .filter(([, v]) => v != null && v !== '')
                      .map(([key, value]) => (
                        <View key={key} style={dm.dataItem}>
                          <Text style={dm.dataKey}>{formatKey(key)}</Text>
                          <Text style={dm.dataVal} numberOfLines={2}>
                            {typeof value === 'boolean' ? (value ? 'نعم' : 'لا') : String(value)}
                          </Text>
                        </View>
                      ))}
                  </View>
                </>
              )}

              {detailEntry.currentEntityData === null && (
                <View style={dm.deletedBanner}>
                  <Text style={dm.deletedText}>⚠️ هذا السجل لم يعد موجوداً (ربما تم حذفه)</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {detailLoading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f8fafc' },
  accessDenied:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  accessDeniedText: { fontSize: 16, color: '#9ca3af' },
  searchBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  searchInput:   { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#111827' },
  filterBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive:{ borderColor: '#6366f1', backgroundColor: '#ede9fe' },
  list:          { padding: 12, paddingBottom: 40 },
  totalText:     { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginBottom: 8 },
  row:           { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  rowLeft:       { flex: 2, gap: 4 },
  rowRight:      { flex: 1, alignItems: 'flex-end', gap: 2 },
  actionBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  actionText:    { fontSize: 11, fontWeight: '700' },
  detailsText:   { fontSize: 12, color: '#6b7280' },
  entityText:    { fontSize: 11, fontWeight: '700', color: '#374151' },
  performedBy:   { fontSize: 11, color: '#6b7280' },
  timestamp:     { fontSize: 10, color: '#9ca3af' },
  empty:         { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  loadingOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
})

const fm = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  title:         { fontSize: 16, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 16 },
  label:         { fontSize: 12, fontWeight: '600', color: '#6b7280', textAlign: 'right', marginBottom: 6, marginTop: 12 },
  pills:         { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  pill:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pillActive:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  pillText:      { fontSize: 12, color: '#6b7280' },
  pillTextActive:{ color: '#fff', fontWeight: '600' },
  clearBtn:      { marginTop: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  clearText:     { fontSize: 14, color: '#6b7280' },
  applyBtn:      { marginTop: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6366f1', alignItems: 'center' },
  applyText:     { fontSize: 14, fontWeight: '700', color: '#fff' },
})

const dm = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#f8fafc' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  body:         { flex: 1, padding: 16 },
  actionBadge:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-end', marginBottom: 16 },
  actionText:   { fontSize: 14, fontWeight: '700' },
  section:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, gap: 10 },
  fieldRow:     { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  fieldLabel:   { fontSize: 12, color: '#9ca3af', flexShrink: 0 },
  fieldValue:   { fontSize: 13, color: '#374151', flex: 1, textAlign: 'right', fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 8 },
  dataGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dataItem:     { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', padding: 10, minWidth: '45%', flex: 1 },
  dataKey:      { fontSize: 11, color: '#6b7280', marginBottom: 3 },
  dataVal:      { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  deletedBanner:{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 12, marginTop: 16 },
  deletedText:  { fontSize: 13, color: '#991b1b', textAlign: 'center' },
})
