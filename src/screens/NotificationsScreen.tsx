import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'

interface Notif {
  id: string
  title: string
  body: string
  type: string
  link: string | null
  isRead: boolean
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'الآن'
  if (diff < 3600) return `${Math.floor(diff / 60)} د`
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`
  return `${Math.floor(diff / 86400)} ي`
}

export default function NotificationsScreen() {
  const navigation     = useNavigation<any>()
  const [items, setItems]   = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: Notif[] }>('/notifications?pageSize=50')
      setItems(r.data.items ?? [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`).catch(() => {})
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  const markAllRead = async () => {
    await api.post('/notifications/read-all').catch(() => {})
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const dismiss = async (id: string, wasRead: boolean) => {
    await api.delete(`/notifications/${id}`).catch(() => {})
    setItems(prev => prev.filter(n => n.id !== id))
  }

  const handleTap = (n: Notif) => {
    if (!n.isRead) markRead(n.id)
    if (n.link) {
      // Navigate to the right screen based on link path
      if (n.link.startsWith('/members/'))   navigation.navigate('MemberDetail', { id: n.link.split('/').pop() })
      else if (n.link.startsWith('/families/')) navigation.navigate('FamilyDetail', { id: n.link.split('/').pop() })
      else if (n.link === '/events')        navigation.navigate('Events')
      else if (n.link === '/checkin')       navigation.navigate('CheckIn')
    }
  }

  const unread = items.filter(n => !n.isRead).length

  const renderItem = ({ item }: { item: Notif }) => (
    <TouchableOpacity
      style={[s.card, !item.isRead && s.cardUnread]}
      onPress={() => handleTap(item)}
    >
      <View style={[s.dot, item.isRead ? s.dotRead : s.dotUnread]} />
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
          <Text style={[s.title, !item.isRead && s.titleBold]}>{item.title}</Text>
        </View>
        <Text style={s.bodyText} numberOfLines={3}>{item.body}</Text>
      </View>
      <TouchableOpacity onPress={() => dismiss(item.id, item.isRead)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="#d1d5db" />
      </TouchableOpacity>
    </TouchableOpacity>
  )

  return (
    <View style={s.root}>
      {unread > 0 && (
        <TouchableOpacity style={s.markAllBtn} onPress={markAllRead}>
          <Text style={s.markAllText}>تحديد الكل كمقروء ({unread})</Text>
        </TouchableOpacity>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyText}>لا توجد إشعارات</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f8fafc' },
  markAllBtn:  { backgroundColor: '#ede9fe', paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  markAllText: { color: '#7c3aed', fontWeight: '700', fontSize: 13 },
  list:        { padding: 14, paddingBottom: 30 },
  card:        { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardUnread:  { backgroundColor: '#f5f3ff' },
  dot:         { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  dotUnread:   { backgroundColor: '#6366f1' },
  dotRead:     { backgroundColor: '#e5e7eb' },
  body:        { flex: 1, gap: 4 },
  titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:       { fontSize: 14, color: '#1f2937', textAlign: 'right', flex: 1 },
  titleBold:   { fontWeight: '700' },
  time:        { fontSize: 11, color: '#9ca3af', flexShrink: 0 },
  bodyText:    { fontSize: 13, color: '#6b7280', textAlign: 'right', lineHeight: 19 },
  emptyBox:    { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:   { fontSize: 40, marginBottom: 12 },
  emptyText:   { color: '#9ca3af', fontSize: 15 },
})
