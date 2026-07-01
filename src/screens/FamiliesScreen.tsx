import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'

interface Family {
  id: string; familyName: string; area?: string; address?: string
  status: string; phoneNumbers?: string; memberCount?: number
}

const STATUS_COLOR: Record<string, string> = {
  Active: '#10b981', Inactive: '#9ca3af', New: '#f59e0b',
}

export default function FamiliesScreen() {
  const navigation = useNavigation<any>()
  const [families, setFamilies]   = useState<Family[]>([])
  const [filtered, setFiltered]   = useState<Family[]>([])
  const [search,   setSearch]     = useState('')
  const [loading,  setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: Family[] }>('/families?pageSize=200')
      const list = r.data.items ?? []
      setFamilies(list)
      setFiltered(list)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  useEffect(() => {
    const q = search.trim().toLowerCase()
    setFiltered(q ? families.filter(f =>
      f.familyName.toLowerCase().includes(q) ||
      (f.area ?? '').toLowerCase().includes(q) ||
      (f.address ?? '').toLowerCase().includes(q)
    ) : families)
  }, [search, families])

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const renderItem = ({ item }: { item: Family }) => (
    <TouchableOpacity style={s.card} onPress={() => navigation.navigate('FamilyDetail', { id: item.id, name: item.familyName })}>
      <View style={s.cardLeft}>
        <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] ?? '#9ca3af' }]}>
          <Text style={s.badgeText}>{item.memberCount ?? '?'}</Text>
        </View>
      </View>
      <View style={s.cardBody}>
        <Text style={s.familyName}>{item.familyName}</Text>
        {item.area    && <Text style={s.meta}>{item.area}</Text>}
        {item.address && <Text style={s.meta} numberOfLines={1}>{item.address}</Text>}
      </View>
      <Ionicons name="chevron-back" size={18} color="#d1d5db" />
    </TouchableOpacity>
  )

  return (
    <View style={s.root}>
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" style={{ marginLeft: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="بحث عن عائلة..."
          placeholderTextColor="#9ca3af"
          textAlign="right"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={f => f.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={<Text style={s.empty}>لا توجد عائلات مطابقة</Text>}
          ListHeaderComponent={
            <Text style={s.count}>{filtered.length} عائلة</Text>
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#f8fafc' },
  searchBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:{ flex: 1, padding: 12, fontSize: 15, color: '#111827' },
  list:       { padding: 12, paddingTop: 4 },
  count:      { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginBottom: 8 },
  card:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardLeft:   { marginRight: 14 },
  badge:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badgeText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardBody:   { flex: 1 },
  familyName: { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  meta:       { fontSize: 12, color: '#6b7280', textAlign: 'right', marginTop: 2 },
  empty:      { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
})
