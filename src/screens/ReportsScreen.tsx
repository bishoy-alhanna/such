import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  ActivityIndicator, FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'

interface DashboardStats { totalFamilies: number; totalMembers: number; totalClasses: number; recentAttendanceRate?: number }
interface AbsentMember { memberId: string; memberName: string; familyId: string; familyName: string; consecutiveAbsences: number; lastAttendanceDate?: string; neverAttended?: boolean; attendanceType: string }
interface AttendanceSummary { totalRecords: number; massAttendance: number; sundaySchoolAttendance: number; uniqueMembers: number }
interface ConfessionGap { id: string; fullName: string; familyId: string; familyName?: string; lastConfessionDate?: string; gapDays?: number; neverConfessed: boolean; confessionFather?: string }
interface TrendWeek { label: string; total?: number; mass?: number; sundaySchool?: number; count?: number }
interface ClassOverview { classId: string; className: string; groupName?: string; enrolled: number; attCount: number; attRatePct: number; scoreCount: number }

type Tab = 'summary' | 'absent' | 'classes' | 'confession'

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? value / max : 0
  return (
    <View style={s.miniBarBg}>
      <View style={[s.miniBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
    </View>
  )
}

export default function ReportsScreen() {
  const navigation = useNavigation<any>()
  const [tab, setTab]           = useState<Tab>('summary')
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [stats,        setStats]        = useState<DashboardStats | null>(null)
  const [summary,      setSummary]      = useState<AttendanceSummary | null>(null)
  const [trends,       setTrends]       = useState<TrendWeek[]>([])
  const [absent,       setAbsent]       = useState<AbsentMember[]>([])
  const [absentType,   setAbsentType]   = useState<'Mass' | 'SundaySchool'>('SundaySchool')
  const [classes,      setClasses]      = useState<ClassOverview[]>([])
  const [confGaps,     setConfGaps]     = useState<ConfessionGap[]>([])

  const loadSummary = useCallback(async () => {
    try {
      const [statsR, summaryR, trendsR] = await Promise.all([
        api.get<DashboardStats>('/reports/dashboard-stats'),
        api.get<AttendanceSummary>('/reports/attendance-summary'),
        api.get<{ attendance: TrendWeek[] }>('/reports/trends'),
      ])
      setStats(statsR.data)
      setSummary(summaryR.data)
      setTrends(summaryR.data ? (trendsR.data?.attendance ?? []) : [])
    } catch {}
  }, [])

  const loadAbsent = useCallback(async () => {
    try {
      const r = await api.get<AbsentMember[]>('/reports/absent-members', { params: { attendanceType: absentType, minAbsences: 3 } })
      setAbsent(Array.isArray(r.data) ? r.data : [])
    } catch {}
  }, [absentType])

  const loadClasses = useCallback(async () => {
    try {
      const r = await api.get<ClassOverview[]>('/reports/class-overview')
      setClasses(Array.isArray(r.data) ? r.data : [])
    } catch {}
  }, [])

  const loadConfession = useCallback(async () => {
    try {
      const r = await api.get<ConfessionGap[]>('/reports/confession-gaps', { params: { thresholdDays: 90 } })
      setConfGaps(Array.isArray(r.data) ? r.data : [])
    } catch {}
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadAbsent(), loadClasses(), loadConfession()])
    setLoading(false)
  }, [loadSummary, loadAbsent, loadClasses, loadConfession])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (tab === 'absent') loadAbsent()
  }, [absentType])

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false) }

  const maxTrend = Math.max(...trends.map(t => t.total ?? t.mass ?? 0), 1)

  if (loading) return <ActivityIndicator size="large" color="#6366f1" style={{ flex: 1, marginTop: 60 }} />

  return (
    <View style={s.root}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabContent}>
        {([
          { key: 'summary',   label: 'الملخص' },
          { key: 'absent',    label: 'الغياب' },
          { key: 'classes',   label: 'الفصول' },
          { key: 'confession',label: 'الاعتراف' },
        ] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity key={t.key} style={[s.tabPill, tab === t.key && s.tabPillActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabPillText, tab === t.key && s.tabPillTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {/* ── Summary tab ── */}
        {tab === 'summary' && (
          <>
            {stats && (
              <View style={s.grid}>
                <StatCard icon="people"     label="العائلات"    value={stats.totalFamilies}  color="#6366f1" />
                <StatCard icon="person"     label="الأعضاء"     value={stats.totalMembers}   color="#10b981" />
                <StatCard icon="school"     label="الفصول"      value={stats.totalClasses}   color="#f59e0b" />
                <StatCard icon="bar-chart"  label="نسبة الحضور" value={stats.recentAttendanceRate != null ? `${Math.round(stats.recentAttendanceRate)}%` : '—'} color="#0891b2" />
              </View>
            )}

            {summary && (
              <View style={s.card}>
                <Text style={s.cardTitle}>ملخص الحضور</Text>
                <View style={s.summaryRow}>
                  <Text style={s.summaryVal}>{summary.totalRecords}</Text>
                  <Text style={s.summaryLabel}>إجمالي السجلات</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryVal, { color: '#6366f1' }]}>{summary.massAttendance}</Text>
                  <Text style={s.summaryLabel}>حضور القداس</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryVal, { color: '#0891b2' }]}>{summary.sundaySchoolAttendance}</Text>
                  <Text style={s.summaryLabel}>حضور مدارس الأحد</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={[s.summaryVal, { color: '#10b981' }]}>{summary.uniqueMembers}</Text>
                  <Text style={s.summaryLabel}>أعضاء فريدون</Text>
                </View>
              </View>
            )}

            {trends.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>اتجاه الحضور (آخر {trends.length} أسابيع)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.trendRow}>
                    {trends.slice(-8).map((t, i) => {
                      const val = t.total ?? t.mass ?? t.count ?? 0
                      const h = maxTrend > 0 ? Math.max(Math.round((val / maxTrend) * 60), val > 0 ? 4 : 0) : 0
                      return (
                        <View key={i} style={s.trendCol}>
                          {val > 0 && <Text style={s.trendNum}>{val}</Text>}
                          <View style={[s.trendBar, { height: h }]} />
                          <Text style={s.trendLabel}>{t.label?.replace('Week of ', '').slice(5) ?? ''}</Text>
                        </View>
                      )
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* ── Absent tab ── */}
        {tab === 'absent' && (
          <>
            <View style={s.typeSelector}>
              {(['Mass', 'SundaySchool'] as const).map(t => (
                <TouchableOpacity key={t} style={[s.typeBtn, absentType === t && s.typeBtnActive]} onPress={() => setAbsentType(t)}>
                  <Text style={[s.typeBtnText, absentType === t && s.typeBtnTextActive]}>
                    {t === 'Mass' ? '⛪ القداس' : '📚 مدارس الأحد'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {absent.length === 0 ? (
              <Text style={s.empty}>لا توجد غيابات تجاوزت 3 أسابيع</Text>
            ) : (
              absent.map(m => (
                <TouchableOpacity key={m.memberId} style={s.absentCard} onPress={() => navigation.navigate('MemberDetail', { id: m.memberId, name: m.memberName })}>
                  <View style={s.absentBadge}>
                    <Text style={s.absentBadgeNum}>{m.neverAttended ? '∞' : m.consecutiveAbsences}</Text>
                    <Text style={s.absentBadgeLbl}>{m.neverAttended ? 'لم يحضر' : 'أسبوع'}</Text>
                  </View>
                  <View style={s.absentInfo}>
                    <Text style={s.absentName}>{m.memberName}</Text>
                    <Text style={s.absentFamily}>{m.familyName}</Text>
                    {m.lastAttendanceDate && (
                      <Text style={s.absentDate}>آخر حضور: {new Date(m.lastAttendanceDate).toLocaleDateString('ar-EG')}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-back" size={16} color="#d1d5db" />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── Classes tab ── */}
        {tab === 'classes' && (
          <>
            {classes.length === 0 ? (
              <Text style={s.empty}>لا توجد بيانات</Text>
            ) : (
              classes.map(c => (
                <TouchableOpacity key={c.classId} style={s.classCard} onPress={() => navigation.navigate('ClassDetail', { id: c.classId, name: c.className })}>
                  <View style={s.classTop}>
                    {c.groupName && <Text style={s.classGroup}>{c.groupName}</Text>}
                    <Text style={s.className}>{c.className}</Text>
                  </View>
                  <View style={s.classStats}>
                    <View style={s.classStat}>
                      <Text style={s.classStatVal}>{c.enrolled}</Text>
                      <Text style={s.classStatLbl}>مسجل</Text>
                    </View>
                    <View style={s.classStat}>
                      <Text style={[s.classStatVal, { color: '#0891b2' }]}>{Math.round(c.attRatePct)}%</Text>
                      <Text style={s.classStatLbl}>حضور</Text>
                    </View>
                    <View style={s.classStat}>
                      <Text style={[s.classStatVal, { color: '#f59e0b' }]}>{c.scoreCount}</Text>
                      <Text style={s.classStatLbl}>نقطة</Text>
                    </View>
                  </View>
                  <MiniBar value={c.attRatePct} max={100} color="#0891b2" />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ── Confession gaps tab ── */}
        {tab === 'confession' && (
          <>
            {confGaps.length === 0 ? (
              <Text style={s.empty}>لا توجد غيابات تجاوزت 90 يوماً</Text>
            ) : (
              confGaps.map(m => (
                <TouchableOpacity key={m.id} style={s.absentCard} onPress={() => navigation.navigate('MemberDetail', { id: m.id, name: m.fullName })}>
                  <View style={[s.absentBadge, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[s.absentBadgeNum, { color: '#dc2626' }]}>{m.neverConfessed ? '—' : m.gapDays ?? '?'}</Text>
                    <Text style={[s.absentBadgeLbl, { color: '#dc2626' }]}>{m.neverConfessed ? 'لم يعترف' : 'يوم'}</Text>
                  </View>
                  <View style={s.absentInfo}>
                    <Text style={s.absentName}>{m.fullName}</Text>
                    {m.familyName && <Text style={s.absentFamily}>{m.familyName}</Text>}
                    {m.lastConfessionDate && (
                      <Text style={s.absentDate}>آخر اعتراف: {new Date(m.lastConfessionDate).toLocaleDateString('ar-EG')}</Text>
                    )}
                    {m.confessionFather && <Text style={s.absentDate}>أب الاعتراف: {m.confessionFather}</Text>}
                  </View>
                  <Ionicons name="chevron-back" size={16} color="#d1d5db" />
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f8fafc' },
  tabBar:           { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabContent:       { flexDirection: 'row', gap: 8, padding: 10 },
  tabPill:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  tabPillActive:    { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tabPillText:      { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabPillTextActive:{ color: '#fff', fontWeight: '700' },
  body:             { flex: 1 },
  bodyContent:      { padding: 14, paddingBottom: 40, gap: 12 },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:         { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  statValue:        { fontSize: 24, fontWeight: '900', color: '#1f2937', marginTop: 6 },
  statLabel:        { fontSize: 11, color: '#6b7280', marginTop: 3, textAlign: 'center' },
  card:             { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardTitle:        { fontSize: 14, fontWeight: '700', color: '#374151', textAlign: 'right', marginBottom: 12 },
  summaryRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  summaryLabel:     { fontSize: 13, color: '#6b7280' },
  summaryVal:       { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  trendRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: 8, minWidth: '100%' },
  trendCol:         { alignItems: 'center', gap: 4, width: 34 },
  trendNum:         { fontSize: 9, color: '#6366f1', fontWeight: '700' },
  trendBar:         { width: 22, backgroundColor: '#6366f1', borderRadius: 4, minHeight: 2 },
  trendLabel:       { fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  typeSelector:     { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn:          { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center' },
  typeBtnActive:    { borderColor: '#6366f1', backgroundColor: '#6366f1' },
  typeBtnText:      { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  typeBtnTextActive:{ color: '#fff' },
  absentCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  absentBadge:      { backgroundColor: '#fef3c7', borderRadius: 12, minWidth: 52, paddingVertical: 8, alignItems: 'center', flexShrink: 0 },
  absentBadgeNum:   { fontSize: 18, fontWeight: '900', color: '#d97706' },
  absentBadgeLbl:   { fontSize: 9, color: '#d97706' },
  absentInfo:       { flex: 1, alignItems: 'flex-end', gap: 2 },
  absentName:       { fontSize: 14, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  absentFamily:     { fontSize: 12, color: '#6b7280', textAlign: 'right' },
  absentDate:       { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  classCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  classTop:         { alignItems: 'flex-end' },
  classGroup:       { fontSize: 11, color: '#9ca3af', textAlign: 'right' },
  className:        { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
  classStats:       { flexDirection: 'row', justifyContent: 'space-around' },
  classStat:        { alignItems: 'center' },
  classStatVal:     { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  classStatLbl:     { fontSize: 11, color: '#9ca3af' },
  miniBarBg:        { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  miniBarFill:      { height: 6, borderRadius: 3 },
  empty:            { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
})
