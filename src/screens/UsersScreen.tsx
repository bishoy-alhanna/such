import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../services/api'

interface UserRow { id: string; username: string; displayName?: string; roleId?: string; email?: string }
interface PendingUser { id: string; username: string; displayName?: string; createdAt: string; roleName?: string }
interface Role { id: string; name: string; description?: string }
type Tab = 'all' | 'pending'

const ROLE_AR: Record<string, string> = {
  SuperAdmin: 'مدير النظام', SeniorPriest: 'الأب الكاهن', Priest: 'كاهن',
  ServiceLeader: 'رئيس الخدمة', Servant: 'خادم', DataEntry: 'إدخال بيانات', Member: 'عضو',
}

export default function UsersScreen() {
  const [tab, setTab]         = useState<Tab>('all')
  const [users, setUsers]     = useState<UserRow[]>([])
  const [pending, setPending] = useState<PendingUser[]>([])
  const [roles, setRoles]     = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery]     = useState('')
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Create/edit modal
  const [showForm, setShowForm]   = useState(false)
  const [editUser, setEditUser]   = useState<UserRow | null>(null)
  const [fUsername, setFUsername] = useState('')
  const [fDisplay,  setFDisplay]  = useState('')
  const [fEmail,    setFEmail]    = useState('')
  const [fPassword, setFPassword] = useState('')
  const [fRoleId,   setFRoleId]   = useState('')
  const [saving,    setSaving]    = useState(false)

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<PendingUser | null>(null)
  const [approveRoleId, setApproveRoleId] = useState('')
  const [approving,     setApproving]     = useState(false)

  const loadRoles = useCallback(async () => {
    try {
      const r = await api.get<Role[]>('/roles')
      setRoles(Array.isArray(r.data) ? r.data : [])
      const member = (Array.isArray(r.data) ? r.data : []).find((r: Role) => r.name === 'Member')
      if (member) setApproveRoleId(member.id)
    } catch {}
  }, [])

  const loadUsers = useCallback(async (p = 1) => {
    try {
      const r = await api.get<{ items: UserRow[]; totalPages: number }>('/users', { params: { q: query || undefined, page: p, pageSize: 20 } })
      const items = r.data.items ?? []
      if (p === 1) setUsers(items)
      else setUsers(prev => [...prev, ...items])
      setHasMore(p < (r.data.totalPages ?? 1))
    } catch {}
    setLoading(false)
  }, [query])

  const loadPending = useCallback(async () => {
    try {
      const r = await api.get<PendingUser[]>('/users/pending')
      setPending(Array.isArray(r.data) ? r.data : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true); setPage(1)
    if (tab === 'all') loadUsers(1)
    else { loadPending(); if (roles.length === 0) loadRoles() }
  }, [tab, query])

  const onRefresh = async () => {
    setRefreshing(true)
    if (tab === 'all') { setPage(1); await loadUsers(1) }
    else await loadPending()
    setRefreshing(false)
  }

  const loadMore = () => {
    if (!hasMore || loading || tab !== 'all') return
    const next = page + 1; setPage(next); loadUsers(next)
  }

  const openCreate = () => {
    setEditUser(null); setFUsername(''); setFDisplay(''); setFEmail(''); setFPassword(''); setFRoleId('')
    setShowForm(true)
  }

  const openEdit = (u: UserRow) => {
    setEditUser(u); setFUsername(u.username); setFDisplay(u.displayName ?? ''); setFEmail(u.email ?? ''); setFPassword(''); setFRoleId(u.roleId ?? '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!fUsername.trim()) return Alert.alert('', 'اسم المستخدم مطلوب')
    if (!editUser && !fPassword.trim()) return Alert.alert('', 'كلمة المرور مطلوبة للمستخدمين الجدد')
    setSaving(true)
    try {
      const body = { username: fUsername.trim(), displayName: fDisplay || undefined, email: fEmail || undefined, password: fPassword || undefined, roleId: fRoleId || undefined }
      if (editUser) { await api.put(`/users/${editUser.id}`, body); setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, displayName: fDisplay, email: fEmail } : u)) }
      else { await api.post('/users', body); setPage(1); loadUsers(1) }
      setShowForm(false)
    } catch (e: any) { Alert.alert('خطأ', e?.response?.data?.message ?? 'تعذّر الحفظ') }
    finally { setSaving(false) }
  }

  const handleDelete = (u: UserRow) => {
    Alert.alert('حذف المستخدم', `حذف "${u.displayName ?? u.username}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try { await api.delete(`/users/${u.id}`); setUsers(prev => prev.filter(x => x.id !== u.id)) }
        catch { Alert.alert('خطأ', 'تعذّر الحذف') }
      }},
    ])
  }

  const handleApprove = async () => {
    if (!approveTarget || !approveRoleId) return Alert.alert('', 'اختر الدور')
    setApproving(true)
    try {
      await api.post(`/users/${approveTarget.id}/approve`, { roleId: approveRoleId })
      setPending(prev => prev.filter(p => p.id !== approveTarget.id))
      setApproveTarget(null)
    } catch { Alert.alert('خطأ', 'تعذّر الموافقة') }
    finally { setApproving(false) }
  }

  const handleReject = (u: PendingUser) => {
    Alert.alert('رفض الطلب', `رفض طلب "${u.displayName ?? u.username}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'رفض', style: 'destructive', onPress: async () => {
        try { await api.delete(`/users/${u.id}/reject`); setPending(prev => prev.filter(p => p.id !== u.id)) }
        catch { Alert.alert('خطأ', 'تعذّر الرفض') }
      }},
    ])
  }

  const renderUser = ({ item }: { item: UserRow }) => (
    <View style={s.card}>
      <View style={s.cardAvatar}>
        <Text style={s.cardAvatarText}>{(item.displayName ?? item.username)[0]?.toUpperCase()}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardName}>{item.displayName ?? item.username}</Text>
        <Text style={s.cardSub}>@{item.username}</Text>
        {item.email ? <Text style={s.cardSub}>{item.email}</Text> : null}
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="pencil-outline" size={18} color="#6366f1" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderPending = ({ item }: { item: PendingUser }) => (
    <View style={s.card}>
      <View style={[s.cardAvatar, { backgroundColor: '#fef3c7' }]}>
        <Text style={[s.cardAvatarText, { color: '#d97706' }]}>{(item.displayName ?? item.username)[0]?.toUpperCase()}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardName}>{item.displayName ?? item.username}</Text>
        <Text style={s.cardSub}>@{item.username}</Text>
        <Text style={s.cardSub}>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</Text>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity style={s.approveBtn} onPress={() => { if (roles.length === 0) loadRoles(); setApproveTarget(item) }}>
          <Ionicons name="checkmark" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.rejectBtn} onPress={() => handleReject(item)}>
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={s.root}>
      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabBtn, tab === 'all' && s.tabBtnActive]} onPress={() => setTab('all')}>
          <Text style={[s.tabBtnText, tab === 'all' && s.tabBtnTextActive]}>المستخدمون</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'pending' && s.tabBtnActive]} onPress={() => setTab('pending')}>
          <Text style={[s.tabBtnText, tab === 'pending' && s.tabBtnTextActive]}>
            طلبات الانضمام {pending.length > 0 ? `(${pending.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'all' && (
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={15} color="#9ca3af" />
          <TextInput style={s.searchInput} value={query} onChangeText={q => { setQuery(q); setPage(1) }} placeholder="بحث..." placeholderTextColor="#9ca3af" textAlign="right" />
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : tab === 'all' ? (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          renderItem={renderUser}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          onEndReached={loadMore} onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={s.empty}>لا يوجد مستخدمون</Text>}
          ListFooterComponent={loading && users.length > 0 ? <ActivityIndicator color="#6366f1" style={{ margin: 12 }} /> : null}
        />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={p => p.id}
          renderItem={renderPending}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد طلبات معلقة</Text>}
        />
      )}

      {tab === 'all' && (
        <TouchableOpacity style={s.fab} onPress={openCreate}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Create/edit modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={s.modalCancel}>إلغاء</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{editUser ? 'تعديل مستخدم' : 'مستخدم جديد'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#6366f1" /> : <Text style={s.modalSave}>حفظ</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {!editUser && (
              <>
                <Text style={s.fieldLabel}>اسم المستخدم *</Text>
                <TextInput style={s.input} value={fUsername} onChangeText={setFUsername} placeholder="username" placeholderTextColor="#9ca3af" autoCapitalize="none" textAlign="right" />
              </>
            )}
            <Text style={s.fieldLabel}>الاسم الظاهر</Text>
            <TextInput style={s.input} value={fDisplay} onChangeText={setFDisplay} placeholder="الاسم الكامل" placeholderTextColor="#9ca3af" textAlign="right" />
            <Text style={s.fieldLabel}>البريد الإلكتروني</Text>
            <TextInput style={s.input} value={fEmail} onChangeText={setFEmail} placeholder="email@example.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" textAlign="right" />
            <Text style={s.fieldLabel}>{editUser ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور *'}</Text>
            <TextInput style={s.input} value={fPassword} onChangeText={setFPassword} placeholder="••••••••" placeholderTextColor="#9ca3af" secureTextEntry textAlign="right" />
            <Text style={s.fieldLabel}>الدور</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.roleRow}>
                {roles.map(r => (
                  <TouchableOpacity key={r.id} style={[s.roleChip, fRoleId === r.id && s.roleChipActive]} onPress={() => setFRoleId(r.id)}>
                    <Text style={[s.roleChipText, fRoleId === r.id && s.roleChipTextActive]}>{ROLE_AR[r.name] ?? r.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Approve modal */}
      <Modal visible={!!approveTarget} animationType="fade" transparent onRequestClose={() => setApproveTarget(null)}>
        <View style={s.overlay}>
          <View style={s.approveCard}>
            <Text style={s.approveTitle}>الموافقة على {approveTarget?.displayName ?? approveTarget?.username}</Text>
            <Text style={s.approveSubtitle}>اختر الدور:</Text>
            <View style={s.roleRow}>
              {roles.map(r => (
                <TouchableOpacity key={r.id} style={[s.roleChip, approveRoleId === r.id && s.roleChipActive]} onPress={() => setApproveRoleId(r.id)}>
                  <Text style={[s.roleChipText, approveRoleId === r.id && s.roleChipTextActive]}>{ROLE_AR[r.name] ?? r.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.approveActions}>
              <TouchableOpacity style={s.approveConfirm} onPress={handleApprove} disabled={approving}>
                {approving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.approveConfirmText}>موافقة</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.approveCancel} onPress={() => setApproveTarget(null)}>
                <Text style={s.approveCancelText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f8fafc' },
  tabBar:           { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabBtn:           { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:     { borderBottomColor: '#6366f1' },
  tabBtnText:       { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  tabBtnTextActive: { color: '#6366f1', fontWeight: '700' },
  searchBar:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:      { flex: 1, fontSize: 14, color: '#374151' },
  list:             { padding: 12, paddingBottom: 90 },
  card:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardAvatar:       { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardAvatarText:   { fontSize: 18, fontWeight: '800', color: '#6366f1' },
  cardBody:         { flex: 1, alignItems: 'flex-end', gap: 2 },
  cardName:         { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  cardSub:          { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  cardActions:      { flexDirection: 'row', gap: 10, alignItems: 'center' },
  approveBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  rejectBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  empty:            { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  fab:              { position: 'absolute', bottom: 24, left: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  modalTitle:       { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  modalCancel:      { fontSize: 15, color: '#9ca3af' },
  modalSave:        { fontSize: 15, fontWeight: '700', color: '#6366f1' },
  modalBody:        { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'right', marginTop: 14, marginBottom: 6 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827' },
  roleRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  roleChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  roleChipActive:   { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  roleChipText:     { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  roleChipTextActive:{ color: '#fff', fontWeight: '700' },
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  approveCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  approveTitle:     { fontSize: 16, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  approveSubtitle:  { fontSize: 13, color: '#6b7280', textAlign: 'right' },
  approveActions:   { flexDirection: 'row', gap: 10 },
  approveConfirm:   { flex: 1, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  approveConfirmText:{ color: '#fff', fontWeight: '700' },
  approveCancel:    { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  approveCancelText:{ color: '#374151', fontWeight: '600' },
})
