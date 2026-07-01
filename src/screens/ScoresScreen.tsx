import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, TextInput, Alert, Modal, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface ScoreRow {
  id: string; memberId: string; memberName?: string; categoryName?: string
  scoreValue: number; date: string; description?: string; recordedByName?: string
}
interface PendingScore {
  id: string; memberId: string; memberName?: string; categoryName?: string
  date: string; note?: string; submittedByName?: string; submittedAt: string
}

const ADMIN_ROLES = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']

type Tab = 'scores' | 'pending'

export default function ScoresScreen() {
  const navigation = useNavigation<any>()
  const { user }   = useAuth()
  const canApprove = ADMIN_ROLES.includes(user?.role ?? '')

  const [tab,        setTab]        = useState<Tab>('scores')
  const [scores,     setScores]     = useState<ScoreRow[]>([])
  const [pending,    setPending]    = useState<PendingScore[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page,       setPage]       = useState(1)
  const [hasMore,    setHasMore]    = useState(true)

  // Search
  const [memberSearch, setMemberSearch] = useState('')
  const [memberResults,setMemberResults]= useState<{ id: string; fullName: string }[]>([])
  const [filtMember,   setFiltMember]   = useState<{ id: string; fullName: string } | null>(null)

  // Reject modal
  const [rejectId,   setRejectId]   = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const loadScores = useCallback(async (p = 1) => {
    try {
      const r = await api.get<{ items: ScoreRow[]; totalCount: number }>('/scores', { params: { page: p, pageSize: 20, memberId: filtMember?.id } })
      const items = r.data.items ?? (r.data as any)
      if (p === 1) setScores(items)
      else setScores(prev => [...prev, ...items])
      const totalPages = Math.ceil((r.data.totalCount ?? 0) / 20)
      setHasMore(p < totalPages)
    } catch {}
    setLoading(false)
  }, [filtMember])

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get<PendingScore[]>('/scores/pending')
      setPending(Array.isArray(r.data) ? r.data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true); setPage(1)
    if (tab === 'scores') loadScores(1)
    else loadPending()
  }, [tab, filtMember])

  const onRefresh = async () => {
    setRefreshing(true)
    if (tab === 'scores') { setPage(1); await loadScores(1) }
    else await loadPending()
    setRefreshing(false)
  }

  const loadMore = () => {
    if (!hasMore || loading || tab !== 'scores') return
    const next = page + 1; setPage(next); loadScores(next)
  }

  const searchMembers = async (q: string) => {
    setMemberSearch(q)
    if (q.length < 2) return setMemberResults([])
    try {
      const r = await api.get<{ items: { id: string; fullName: string }[] }>('/members/search', { params: { q, pageSize: 10 } })
      setMemberResults(r.data.items ?? [])
    } catch {}
  }

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/scores/pending/${id}/approve`)
      loadPending()
    } catch { Alert.alert('خطأ', 'تعذّر الموافقة') }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) return Alert.alert('', 'سبب الرفض مطلوب')
    try {
      await api.post(`/scores/pending/${rejectId}/reject`, { note: rejectNote })
      setRejectId(null); setRejectNote(''); loadPending()
    } catch { Alert.alert('خطأ', 'تعذّر الرفض') }
  }

  const handleDeleteScore = (s: ScoreRow) => {
    Alert.alert('حذف النقاط', 'هل تريد حذف هذا السجل؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/scores/${s.id}`); setPage(1); loadScores(1) }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const renderScore = ({ item }: { item: ScoreRow }) => (
    <View style={s.card}>
      <TouchableOpacity style={s.cardBody} onPress={() => navigation.navigate('MemberDetail', { id: item.memberId, name: item.memberName })}>
        <View style={s.cardTop}>
          <View style={s.scoreBadge}><Text style={s.scoreText}>{item.scoreValue}</Text></View>
          <View style={s.cardInfo}>
            <Text style={s.memberName}>{item.memberName ?? '—'}</Text>
            <Text style={s.categoryText}>{item.categoryName ?? '—'}</Text>
            <Text style={s.dateText}>{new Date(item.date).toLocaleDateString('ar-EG')}</Text>
            {item.description && <Text style={s.descText} numberOfLines={1}>{item.description}</Text>}
          </View>
        </View>
      </TouchableOpacity>
      {canApprove && (
        <TouchableOpacity onPress={() => handleDeleteScore(item)} style={s.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={15} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  )

  const renderPending = ({ item }: { item: PendingScore }) => (
    <View style={s.card}>
      <View style={s.cardBody}>
        <Text style={s.memberName}>{item.memberName ?? '—'}</Text>
        <Text style={s.categoryText}>{item.categoryName ?? '—'}</Text>
        <Text style={s.dateText}>{new Date(item.date).toLocaleDateString('ar-EG')}</Text>
        {item.note && <Text style={s.descText}>{item.note}</Text>}
        {item.submittedByName && <Text style={s.recorderText}>طُلب بواسطة: {item.submittedByName}</Text>}
      </View>
      {canApprove && (
        <View style={s.approvalBtns}>
          <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(item.id)}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.rejectBtn} onPress={() => { setRejectId(item.id); setRejectNote('') }}>
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  return (
    <View style={s.root}>
      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, tab === 'scores' && s.tabBtnActive]} onPress={() => setTab('scores')}>
          <Text style={[s.tabBtnText, tab === 'scores' && s.tabBtnTextActive]}>النقاط</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'pending' && s.tabBtnActive]} onPress={() => setTab('pending')}>
          <Text style={[s.tabBtnText, tab === 'pending' && s.tabBtnTextActive]}>
            في الانتظار {pending.length > 0 ? `(${pending.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Member filter (scores tab only) */}
      {tab === 'scores' && (
        <View style={s.searchBar}>
          {filtMember ? (
            <TouchableOpacity style={s.filtChip} onPress={() => { setFiltMember(null); setMemberSearch(''); setMemberResults([]) }}>
              <Ionicons name="close-circle" size={15} color="#6366f1" />
              <Text style={s.filtChipText}>{filtMember.fullName}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Ionicons name="search-outline" size={15} color="#9ca3af" />
              <TextInput
                style={s.searchInput} value={memberSearch} onChangeText={searchMembers}
                placeholder="فلتر بالعضو..." placeholderTextColor="#9ca3af" textAlign="right"
              />
            </>
          )}
        </View>
      )}

      {/* Member search results */}
      {memberResults.length > 0 && (
        <View style={s.memberDropdown}>
          {memberResults.map(m => (
            <TouchableOpacity key={m.id} style={s.memberDropItem} onPress={() => { setFiltMember(m); setMemberSearch(''); setMemberResults([]) }}>
              <Text style={s.memberDropText}>{m.fullName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (tab === 'scores' ? scores : pending).length === 0 ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : tab === 'scores' ? (
        <FlatList
          data={scores}
          keyExtractor={s => s.id}
          renderItem={renderScore}
          contentContainerStyle={ss.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          onEndReached={loadMore} onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={s.empty}>لا توجد نقاط</Text>}
          ListFooterComponent={loading && scores.length > 0 ? <ActivityIndicator color="#6366f1" style={{ margin: 12 }} /> : null}
        />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={p => p.id}
          renderItem={renderPending}
          contentContainerStyle={ss.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد طلبات معلقة</Text>}
        />
      )}

      {/* Reject modal */}
      <Modal visible={!!rejectId} animationType="fade" transparent onRequestClose={() => setRejectId(null)}>
        <View style={s.overlay}>
          <View style={s.rejectCard}>
            <Text style={s.rejectTitle}>سبب الرفض</Text>
            <TextInput
              style={s.rejectInput} value={rejectNote} onChangeText={setRejectNote}
              placeholder="أدخل سبب الرفض..." placeholderTextColor="#9ca3af" textAlign="right"
              multiline autoFocus
            />
            <View style={s.rejectActions}>
              <TouchableOpacity style={s.rejectConfirm} onPress={handleReject}>
                <Text style={s.rejectConfirmText}>رفض</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.rejectCancel} onPress={() => setRejectId(null)}>
                <Text style={s.rejectCancelText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f8fafc' },
  tabBar:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabBtn:         { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: '#6366f1' },
  tabBtnText:     { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  tabBtnTextActive:{ color: '#6366f1', fontWeight: '700' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:    { flex: 1, fontSize: 14, color: '#374151' },
  filtChip:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filtChipText:   { flex: 1, fontSize: 14, color: '#6366f1', fontWeight: '600', textAlign: 'right' },
  memberDropdown: { backgroundColor: '#fff', marginHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 4 },
  memberDropItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  memberDropText: { fontSize: 14, color: '#374151', textAlign: 'right' },
  card:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardBody:       { flex: 1 },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  scoreBadge:     { backgroundColor: '#6366f1', borderRadius: 10, minWidth: 44, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', flexShrink: 0 },
  scoreText:      { color: '#fff', fontWeight: '800', fontSize: 15 },
  cardInfo:       { flex: 1, alignItems: 'flex-end', gap: 2 },
  memberName:     { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  categoryText:   { fontSize: 12, color: '#6366f1', textAlign: 'right' },
  dateText:       { fontSize: 12, color: '#9ca3af' },
  descText:       { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  recorderText:   { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 2 },
  deleteBtn:      { padding: 4 },
  approvalBtns:   { flexDirection: 'row', gap: 8 },
  approveBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  rejectBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  empty:          { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  rejectCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  rejectTitle:    { fontSize: 16, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  rejectInput:    { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', height: 80, textAlignVertical: 'top' },
  rejectActions:  { flexDirection: 'row', gap: 10 },
  rejectConfirm:  { flex: 1, backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectConfirmText:{ color: '#fff', fontWeight: '700' },
  rejectCancel:   { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectCancelText:{ color: '#374151', fontWeight: '600' },
})
const ss = StyleSheet.create({ list: { padding: 12, paddingBottom: 40 } })
