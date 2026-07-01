import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../context/AuthContext'
import api, { getServerBaseUrl } from '../services/api'

interface MenuItem {
  icon: string; label: string; sub?: string
  screen?: string; onPress?: () => void; color?: string; badge?: string
}

const ADMIN_ROLES   = ['SuperAdmin', 'Priest', 'SeniorPriest', 'ServiceLeader']
const SERVANT_ROLES = [...ADMIN_ROLES, 'Servant', 'DataEntry']

export default function MoreScreen() {
  const navigation = useNavigation<any>()
  const { user, logout } = useAuth()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ photoUrl?: string }>('/members/profile')
      .then(r => { if (r.data.photoUrl) setPhotoUrl(r.data.photoUrl) })
      .catch(() => {})
  }, [])

  const name  = user?.displayName ?? user?.username ?? 'المستخدم'
  const role  = user?.role ?? ''

  const ROLE_AR: Record<string, string> = {
    SuperAdmin: 'مدير النظام', SeniorPriest: 'الأب الكاهن', Priest: 'كاهن',
    ServiceLeader: 'رئيس الخدمة', Servant: 'خادم', DataEntry: 'إدخال بيانات', Member: 'عضو',
  }

  const isAdmin   = ADMIN_ROLES.includes(role)
  const isServant = SERVANT_ROLES.includes(role)

  type Section = { title: string; items: MenuItem[] }
  const sections: Section[] = [
    {
      title: 'الخدمة',
      items: [
        { icon: 'walk-outline',     label: 'الزيارات',        sub: 'سجل وأضف زيارات',      screen: 'VisitsTab',        color: '#0891b2' },
        { icon: 'checkbox-outline', label: 'الحضور',          sub: 'تسجيل حضور الفصول',    screen: 'Attendance',       color: '#7c3aed' },
        { icon: 'map-outline',      label: 'الخريطة',         sub: 'خريطة وتخطيط الزيارات', screen: 'MapTab',           color: '#059669' },
        { icon: 'ear-outline',      label: 'السجلات الروحية', sub: 'اعتراف / تناول / قداس', screen: 'SpiritualRecords', color: '#dc2626' },
        { icon: 'ribbon-outline',   label: 'المتطوعون',       sub: 'تعيينات وساعات الخدمة', screen: 'VolunteerTab',     color: '#d97706' },
      ].filter(() => isServant),
    },
    {
      title: 'التعليم والمجموعات',
      items: [
        { icon: 'school-outline',   label: 'الفصول',          sub: 'إدارة الفصول والأعضاء',      screen: 'ClassesTab',         color: '#6366f1' },
        { icon: 'people-outline',   label: 'المجموعات',        sub: 'مجموعات الخدمة والفصول',     screen: 'GroupsTab',           color: '#0891b2' },
        { icon: 'star-outline',     label: 'النقاط',           sub: 'النقاط والطلبات المعلقة',    screen: 'ScoresTab',           color: '#f59e0b' },
        { icon: 'trophy-outline',   label: 'فئات النقاط',     sub: 'إدارة فئات وأنواع النقاط',   screen: 'ScoreCategories',     color: '#7c3aed' },
      ].filter(() => isAdmin),
    },
    {
      title: 'المتابعة والتقارير',
      items: [
        { icon: 'checkmark-done-outline', label: 'المهام',      sub: 'متابعة مهام الخدمة',       screen: 'FollowUpTasks', color: '#0891b2' },
        { icon: 'bar-chart-outline',      label: 'التقارير',    sub: 'إحصاءات وتحليلات',          screen: 'Reports',       color: '#059669' },
      ].filter(() => isServant),
    },
    {
      title: 'المالية',
      items: [
        { icon: 'cash-outline', label: 'التبرعات', sub: 'عشور ونذر وتبرعات العائلات', screen: 'GivingTab', color: '#059669' },
      ].filter(() => isAdmin),
    },
    {
      title: 'الإدارة',
      items: [
        { icon: 'people-circle-outline',  label: 'المستخدمون',      sub: 'إدارة الحسابات والصلاحيات', screen: 'Users',      color: '#374151' },
        { icon: 'checkmark-done-circle-outline', label: 'الموافقات', sub: 'طلبات التسجيل والدرجات والتعديلات', screen: 'Approvals', color: '#16a34a' },
        { icon: 'document-text-outline', label: 'سجل المراجعة',   sub: 'جميع الإجراءات على النظام', screen: 'Audit',      color: '#374151' },
      ].filter(() => isAdmin),
    },
    {
      title: 'الحساب',
      items: [
        { icon: 'person-outline',        label: 'الملف الشخصي', sub: 'بياناتي الشخصية',  screen: 'Profile',          color: '#374151' },
        { icon: 'notifications-outline', label: 'الإشعارات',    sub: 'كل الإشعارات',     screen: 'NotificationsTab', color: '#d97706' },
        {
          icon: 'log-out-outline', label: 'تسجيل الخروج', color: '#dc2626',
          onPress: () => Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'خروج', style: 'destructive', onPress: logout },
          ]),
        },
      ],
    },
  ].filter(sec => sec.items.length > 0)

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* User card */}
      <View style={s.userCard}>
        <View style={s.avatar}>
          {photoUrl
            ? <Image source={{ uri: `${getServerBaseUrl()}${photoUrl}` }} style={s.avatarImg} />
            : <Text style={s.avatarText}>{name.charAt(0)}</Text>
          }
        </View>
        <View style={s.userInfo}>
          <Text style={s.userName}>{name}</Text>
          <Text style={s.userRole}>{ROLE_AR[role] ?? role}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.editBtn}>
          <Ionicons name="pencil-outline" size={18} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Sections */}
      {sections.map(section => (
        <View key={section.title} style={s.section}>
          <Text style={s.sectionTitle}>{section.title}</Text>
          <View style={s.sectionCard}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[s.row, idx < section.items.length - 1 && s.rowBorder]}
                onPress={item.onPress ?? (() => item.screen && navigation.navigate(item.screen))}
              >
                <Ionicons name="chevron-back" size={16} color="#d1d5db" />
                {item.badge && (
                  <View style={s.badge}><Text style={s.badgeText}>{item.badge}</Text></View>
                )}
                <View style={s.rowContent}>
                  <View style={s.rowText}>
                    <Text style={[s.rowLabel, item.color === '#dc2626' && { color: '#dc2626' }]}>{item.label}</Text>
                    {item.sub && <Text style={s.rowSub}>{item.sub}</Text>}
                  </View>
                  <View style={[s.iconWrap, { backgroundColor: (item.color ?? '#6366f1') + '18' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color ?? '#6366f1'} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={s.version}>ShepherdCare v1.0.0</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#f8fafc' },
  content:      { padding: 16, paddingBottom: 40 },
  userCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, gap: 12 },
  avatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  avatarImg:    { width: 52, height: 52, borderRadius: 26 },
  avatarText:   { color: '#fff', fontSize: 22, fontWeight: '800' },
  userInfo:     { flex: 1, alignItems: 'flex-end', gap: 3 },
  userName:     { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  userRole:     { fontSize: 12, color: '#9ca3af' },
  editBtn:      { padding: 6 },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textAlign: 'right', marginBottom: 8, paddingHorizontal: 4, textTransform: 'uppercase' },
  sectionCard:  { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowContent:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText:      { flex: 1, alignItems: 'flex-end', gap: 2 },
  rowLabel:     { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  rowSub:       { fontSize: 12, color: '#9ca3af' },
  iconWrap:     { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badge:        { backgroundColor: '#6366f1', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText:    { color: '#fff', fontSize: 11, fontWeight: '800' },
  version:      { textAlign: 'center', color: '#d1d5db', fontSize: 12, marginTop: 8 },
})
