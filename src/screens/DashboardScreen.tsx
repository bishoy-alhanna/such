import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, FlatList } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import SubscriptionBanner from '../components/SubscriptionBanner'

interface Stats {
  totalFamilies: number
  totalMembers: number
  totalClasses: number
  recentAttendanceRate: number
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

interface SearchResult { id: string; type: 'family' | 'member'; name: string; sub?: string }

export default function DashboardScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<any>()
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [searchQ,     setSearchQ]     = useState('')
  const [searching,   setSearching]   = useState(false)
  const [results,     setResults]     = useState<SearchResult[]>([])

  const load = async () => {
    try {
      const r = await api.get<Stats>('/reports/dashboard-stats')
      setStats(r.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const handleSearch = useCallback(async (q: string) => {
    setSearchQ(q)
    if (q.length < 2) return setResults([])
    setSearching(true)
    try {
      const [fams, mems] = await Promise.all([
        api.get<{ items: { id: string; familyName: string; area?: string }[] }>('/families', { params: { q, pageSize: 5 } }),
        api.get<{ items: { id: string; fullName: string; familyId?: string }[] }>('/members/search', { params: { q, pageSize: 5 } }),
      ])
      const famResults: SearchResult[] = (fams.data.items ?? []).map(f => ({ id: f.id, type: 'family', name: f.familyName, sub: f.area }))
      const memResults: SearchResult[] = (mems.data.items ?? []).map(m => ({ id: m.id, type: 'member', name: m.fullName, sub: 'عضو' }))
      setResults([...famResults, ...memResults])
    } catch {}
    setSearching(false)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
    <SubscriptionBanner />
    <ScrollView
      style={s.root}
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Search bar */}
      <View style={s.searchBar}>
        {searching
          ? <ActivityIndicator size="small" color="#6366f1" />
          : <Ionicons name="search-outline" size={17} color="#9ca3af" />
        }
        <TextInput
          style={s.searchInput}
          value={searchQ}
          onChangeText={handleSearch}
          placeholder="بحث عن عائلة أو عضو..."
          placeholderTextColor="#9ca3af"
          textAlign="right"
          returnKeyType="search"
        />
        {searchQ ? (
          <TouchableOpacity onPress={() => { setSearchQ(''); setResults([]) }}>
            <Ionicons name="close-circle" size={17} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search results */}
      {results.length > 0 && (
        <View style={s.resultsBox}>
          {results.map(r => (
            <TouchableOpacity
              key={`${r.type}-${r.id}`}
              style={s.resultRow}
              onPress={() => {
                setSearchQ(''); setResults([])
                if (r.type === 'family') navigation.navigate('Families', { screen: 'FamilyDetail', params: { id: r.id, name: r.name } })
                else navigation.navigate('MemberDetail', { id: r.id, name: r.name })
              }}
            >
              <Ionicons name={r.type === 'family' ? 'home-outline' : 'person-outline'} size={15} color="#9ca3af" />
              <View style={s.resultText}>
                <Text style={s.resultName}>{r.name}</Text>
                {r.sub && <Text style={s.resultSub}>{r.sub}</Text>}
              </View>
              <Ionicons name="chevron-back" size={14} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.greetingRow}>
        <TouchableOpacity style={s.profileBtn} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-circle-outline" size={32} color="#6366f1" />
        </TouchableOpacity>
        <View style={s.greeting}>
          <Text style={s.hello}>مرحباً، {user?.displayName || user?.username || 'مستخدم'}</Text>
          <Text style={s.role}>{user?.role}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <View style={s.grid}>
          <StatCard icon="people"           label="العائلات"   value={stats?.totalFamilies        ?? '—'} color="#6366f1" />
          <StatCard icon="person"           label="الأعضاء"    value={stats?.totalMembers          ?? '—'} color="#10b981" />
          <StatCard icon="school"           label="الفصول"     value={stats?.totalClasses          ?? '—'} color="#f59e0b" />
          <StatCard icon="bar-chart"        label="نسبة الحضور" value={stats ? `${Math.round(stats.recentAttendanceRate)}%` : '—'} color="#ef4444" />
        </View>
      )}

      <Text style={s.sectionTitle}>الوصول السريع</Text>
      <View style={s.quickLinks}>
        {[
          { icon: 'people-outline',   label: 'العائلات', screen: 'Families'  },
          { icon: 'calendar-outline', label: 'الزيارات', screen: 'VisitsTab', parent: 'More' },
          { icon: 'map-outline',      label: 'الخريطة',  screen: 'MapTab',    parent: 'More' },
          { icon: 'person-outline',   label: 'ملفي',     screen: 'Profile'   },
        ].map(item => (
          <TouchableOpacity key={item.screen} style={s.quickLink} onPress={() =>
            (item as any).parent
              ? navigation.navigate((item as any).parent, { screen: item.screen })
              : navigation.navigate(item.screen)
          }>
            <Ionicons name={item.icon as any} size={28} color="#6366f1" />
            <Text style={s.quickLinkLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f8fafc' },
  container:      { padding: 20, paddingBottom: 40 },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  searchInput:    { flex: 1, fontSize: 14, color: '#374151' },
  resultsBox:     { backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  resultRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  resultText:     { flex: 1, alignItems: 'flex-end' },
  resultName:     { fontSize: 14, color: '#1f2937', fontWeight: '600', textAlign: 'right' },
  resultSub:      { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  greetingRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 24 },
  greeting:       { flex: 1, alignItems: 'flex-end' },
  profileBtn:     {},
  hello:          { fontSize: 22, fontWeight: '800', color: '#1f2937', textAlign: 'right' },
  role:           { fontSize: 13, color: '#9ca3af', textAlign: 'right', marginTop: 2 },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard:       { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statValue:      { fontSize: 28, fontWeight: '900', color: '#1f2937', marginTop: 8 },
  statLabel:      { fontSize: 12, color: '#6b7280', marginTop: 4 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 12 },
  quickLinks:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  quickLink:      { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  quickLinkLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8 },
})
