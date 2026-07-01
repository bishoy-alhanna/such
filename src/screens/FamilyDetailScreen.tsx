import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute } from '@react-navigation/native'
import api from '../services/api'

interface Member {
  id: string
  fullName: string
  relation?: string
  mobile?: string
  gender?: string
  isChild?: boolean
}
interface Visit {
  id: string; visitDate: string; visitType: string; notes?: string; visitorName?: string
}
interface FamilyDetail {
  id: string; familyName: string; area?: string; address?: string
  phoneNumbers?: string; status: string
  members: Member[]
  recentVisits?: Visit[]
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <View style={s.infoRow}>
      <Text style={s.infoValue}>{value}</Text>
      <Text style={s.infoLabel}>{label}</Text>
      <Ionicons name={icon} size={16} color="#9ca3af" />
    </View>
  )
}

export default function FamilyDetailScreen() {
  const route      = useRoute<any>()
  const navigation = useNavigation<any>()
  const { id }     = route.params
  const [family, setFamily]   = useState<FamilyDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<FamilyDetail>(`/families/${id}`)
      .then(r => setFamily(r.data))
      .catch(() => Alert.alert('خطأ', 'تعذّر تحميل بيانات العائلة'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ flex: 1, marginTop: 60 }} />
  if (!family)  return <Text style={{ textAlign: 'center', marginTop: 60, color: '#9ca3af' }}>لا توجد بيانات</Text>

  const phones = family.phoneNumbers?.split(',').map(p => p.trim()).filter(Boolean) ?? []

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={[s.statusDot, { backgroundColor: family.status === 'Active' ? '#10b981' : '#9ca3af' }]} />
        <Text style={s.title}>{family.familyName}</Text>
      </View>

      <View style={s.card}>
        <InfoRow icon="location-outline" label="المنطقة" value={family.area} />
        <InfoRow icon="map-outline"      label="العنوان"  value={family.address} />
      </View>

      {phones.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>أرقام التواصل</Text>
          {phones.map((p, i) => (
            <TouchableOpacity key={i} style={s.phoneRow} onPress={() => Linking.openURL(`tel:${p}`)}>
              <Text style={s.phone}>{p}</Text>
              <Ionicons name="call-outline" size={16} color="#6366f1" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Members */}
      <Text style={s.sectionTitle}>الأعضاء ({family.members?.length ?? 0})</Text>
      {(family.members ?? []).map(m => (
        <TouchableOpacity
          key={m.id}
          style={s.memberCard}
          onPress={() => navigation.navigate('MemberDetail', { id: m.id, name: m.fullName })}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(m.fullName ?? '?')[0]}</Text>
          </View>
          <View style={s.memberInfo}>
            <Text style={s.memberName}>{m.fullName}</Text>
            {m.relation && <Text style={s.memberRole}>{m.relation}</Text>}
          </View>
          {m.mobile ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${m.mobile}`)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="call-outline" size={16} color="#6366f1" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-back" size={16} color="#d1d5db" />
          )}
        </TouchableOpacity>
      ))}

      {/* Recent Visits */}
      {(family.recentVisits?.length ?? 0) > 0 && (
        <>
          <Text style={[s.sectionTitle, { marginTop: 16 }]}>آخر الزيارات</Text>
          {family.recentVisits!.map(v => (
            <View key={v.id} style={s.visitCard}>
              <View style={s.visitHeader}>
                <Text style={s.visitType}>{v.visitType}</Text>
                <Text style={s.visitDate}>{new Date(v.visitDate).toLocaleDateString('ar-EG')}</Text>
              </View>
              {v.notes      && <Text style={s.visitNotes} numberOfLines={2}>{v.notes}</Text>}
              {v.visitorName && <Text style={s.visitedBy}>بواسطة: {v.visitorName}</Text>}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#f8fafc' },
  container:    { padding: 16, paddingBottom: 40 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, justifyContent: 'flex-end' },
  title:        { fontSize: 22, fontWeight: '800', color: '#1f2937' },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  card:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, justifyContent: 'flex-end' },
  infoLabel:    { fontSize: 12, color: '#9ca3af' },
  infoValue:    { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 10, marginTop: 4 },
  phoneRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, justifyContent: 'flex-end' },
  phone:        { fontSize: 14, color: '#6366f1', fontWeight: '600' },
  memberCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  avatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  avatarText:   { fontSize: 16, fontWeight: '700', color: '#6366f1' },
  memberInfo:   { flex: 1, alignItems: 'flex-end', gap: 2 },
  memberName:   { fontSize: 14, fontWeight: '600', color: '#1f2937', textAlign: 'right' },
  memberRole:   { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  visitCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderRightWidth: 3, borderRightColor: '#6366f1' },
  visitHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  visitType:    { fontSize: 13, fontWeight: '600', color: '#374151' },
  visitDate:    { fontSize: 12, color: '#9ca3af' },
  visitNotes:   { fontSize: 13, color: '#6b7280', textAlign: 'right', marginTop: 4 },
  visitedBy:    { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
})
