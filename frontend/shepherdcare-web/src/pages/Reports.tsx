import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'
import { useT } from '../i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardStats { totalFamilies: number; totalMembers: number; totalClasses: number; recentAttendanceRate?: number }
interface AbsentMember { memberId: string; memberName: string; familyId: string; familyName: string; consecutiveAbsences: number; lastAttendanceDate?: string; neverAttended?: boolean; attendanceType: string }
interface AttendanceSummary { totalRecords: number; massAttendance: number; sundaySchoolAttendance: number; uniqueMembers: number }
interface WeekPoint { label: string; total: number; mass: number; sundaySchool: number }
interface SpiritPoint { label: string; confession: number; communion: number }
interface ScorePoint { label: string; count: number }
interface Trends { attendance: WeekPoint[]; spiritual: SpiritPoint[]; scores: ScorePoint[] }
interface ClassOverview { classId: string; className: string; groupName?: string; enrolled: number; attCount: number; attRatePct: number; scoreCount: number }
interface ConfessionGap { id: string; fullName: string; familyId: string; familyName?: string; lastConfessionDate?: string; confessionFather?: string; gapDays?: number; neverConfessed: boolean }
interface ClassItem { id: string; className: string; groupName?: string }
interface AttTrendWeek { label: string; count: number; rate: number; enrolled: number }
interface AttTrend { className: string; enrolled: number; weeks: AttTrendWeek[] }
interface ScoreTrendWeek { label: string; count: number }
interface ScoreTrend { scopeName: string; weeks: ScoreTrendWeek[] }
interface GrowthPoint { label: string; newMembers?: number; newFamilies?: number; totalSoFar: number }

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────

function BarChart({ data, color, height = 80 }: { data: { label: string; value: number }[]; color: string; height?: number }) {
  const max  = Math.max(...data.map(d => d.value), 1)
  const barW = 28, gap = 6
  const totalW = data.length * (barW + gap) - gap
  return (
    <svg viewBox={`0 0 ${totalW} ${height + 28}`} style={{ width: '100%', overflow: 'visible', display: 'block' }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * height, d.value > 0 ? 2 : 0)
        const x = i * (barW + gap)
        return (
          <g key={i}>
            <rect x={x} y={height - barH} width={barW} height={barH} fill={color} rx={3} />
            {d.value > 0 && <text x={x + barW / 2} y={height - barH - 4} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{d.value}</text>}
            <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Line chart (rate % over weeks) ───────────────────────────────────────────

function LineChart({ data, color, height = 80 }: { data: { label: string; value: number }[]; color: string; height?: number }) {
  const max  = Math.max(...data.map(d => d.value), 1)
  const barW = 28, gap = 6
  const totalW = data.length * (barW + gap) - gap
  const pts = data.map((d, i) => {
    const x = i * (barW + gap) + barW / 2
    const y = height - (d.value / max) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${totalW} ${height + 28}`} style={{ width: '100%', overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = i * (barW + gap) + barW / 2
        const y = height - (d.value / max) * height
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill={color} />
            {d.value > 0 && <text x={x} y={y - 7} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{d.value}%</text>}
            <text x={x} y={height + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Stacked bar chart ─────────────────────────────────────────────────────────

function StackedBarChart({ data, colorA, colorB, labelA, labelB, height = 80 }:
  { data: { label: string; a: number; b: number }[]; colorA: string; colorB: string; labelA: string; labelB: string; height?: number }) {
  const max  = Math.max(...data.map(d => d.a + d.b), 1)
  const barW = 28, gap = 6
  const totalW = data.length * (barW + gap) - gap
  return (
    <>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
        <span><span style={{ background: colorA, display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginInlineEnd: 4 }} />{labelA}</span>
        <span><span style={{ background: colorB, display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginInlineEnd: 4 }} />{labelB}</span>
      </div>
      <svg viewBox={`0 0 ${totalW} ${height + 28}`} style={{ width: '100%', overflow: 'visible', display: 'block' }}>
        {data.map((d, i) => {
          const total  = d.a + d.b
          const totalH = (total / max) * height
          const aH = total > 0 ? (d.a / total) * totalH : 0
          const bH = total > 0 ? (d.b / total) * totalH : 0
          const x  = i * (barW + gap)
          return (
            <g key={i}>
              <rect x={x} y={height - totalH} width={barW} height={bH} fill={colorB} rx={3} />
              <rect x={x} y={height - aH}     width={barW} height={aH} fill={colorA} />
              {total > 0 && <text x={x + barW / 2} y={height - totalH - 4} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="600">{total}</text>}
              <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
            </g>
          )
        })}
      </svg>
    </>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent ?? '#1f2937', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Export button ─────────────────────────────────────────────────────────────

function ExportBtn({ onClick, label = 'تصدير CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac',
      borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    }}>
      ⬇ {label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'stats' | 'trends' | 'confession' | 'growth'

export default function ReportsPage() {
  const { user } = useAuth()
  const { t }    = useT()
  const isServant  = user?.role === 'Servant'
  const canGrowth  = user?.role === 'SuperAdmin' || user?.role === 'ServiceLeader' || user?.role === 'Priest' || user?.role === 'SeniorPriest'
  const printRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<Tab>('stats')

  // ── Stats tab
  const [stats, setStats]                           = useState<DashboardStats | null>(null)
  const [absentMembers, setAbsentMembers]           = useState<AbsentMember[]>([])
  const [attendanceSummary, setAttendanceSummary]   = useState<AttendanceSummary | null>(null)
  const [statsLoading, setStatsLoading]             = useState(true)
  const [selectedPeriod, setSelectedPeriod]         = useState<'week'|'month'|'quarter'>('month')
  const [attendanceType, setAttendanceType]         = useState<'all'|'Mass'|'SundaySchool'>('all')

  // ── Confession tab
  const [confessionGaps, setConfessionGaps]         = useState<ConfessionGap[]>([])
  const [confessionLoading, setConfessionLoading]   = useState(false)
  const [confessionLoaded, setConfessionLoaded]     = useState(false)
  const [threshold, setThreshold]                   = useState(30)

  // ── Trends tab
  const [trends, setTrends]                 = useState<Trends | null>(null)
  const [classOverview, setClassOverview]   = useState<ClassOverview[]>([])
  const [trendsLoading, setTrendsLoading]   = useState(false)
  const [trendsLoaded, setTrendsLoaded]     = useState(false)

  // ── Trends: class attendance over time
  const [classes, setClasses]               = useState<ClassItem[]>([])
  const [attTrendClassId, setAttTrendClassId] = useState<string>('')
  const [attTrend, setAttTrend]             = useState<AttTrend | null>(null)
  const [attTrendLoading, setAttTrendLoading] = useState(false)

  // ── Trends: score trends per class
  const [scoreTrendClassId, setScoreTrendClassId] = useState<string>('')
  const [scoreTrend, setScoreTrend]         = useState<ScoreTrend | null>(null)
  const [scoreTrendLoading, setScoreTrendLoading] = useState(false)

  // ── Growth tab
  const [memberGrowth, setMemberGrowth]     = useState<GrowthPoint[]>([])
  const [familyGrowth, setFamilyGrowth]     = useState<GrowthPoint[]>([])
  const [growthLoading, setGrowthLoading]   = useState(false)
  const [growthLoaded, setGrowthLoaded]     = useState(false)

  // ── Load stats
  const fetchStats   = useCallback(async () => { try { setStats((await api.get<DashboardStats>('/reports/dashboard-stats')).data) } catch {} }, [])
  const fetchAbsent  = useCallback(async () => {
    try {
      const p: Record<string,string> = { minAbsences: '3' }
      if (attendanceType !== 'all') p.attendanceType = attendanceType
      setAbsentMembers((await api.get<AbsentMember[]>('/reports/absent-members', { params: p })).data)
    } catch { setAbsentMembers([]) }
  }, [attendanceType])
  const fetchSummary = useCallback(async () => {
    try { setAttendanceSummary((await api.get<AttendanceSummary>('/reports/attendance-summary', { params: { period: selectedPeriod } })).data) } catch {}
  }, [selectedPeriod])

  useEffect(() => {
    (async () => { setStatsLoading(true); await Promise.all([fetchStats(), fetchAbsent(), fetchSummary()]); setStatsLoading(false) })()
  }, [])
  useEffect(() => { if (!statsLoading) fetchAbsent() }, [attendanceType])
  useEffect(() => { if (!statsLoading) fetchSummary() }, [selectedPeriod])

  // ── Load trends (lazy)
  const loadTrends = useCallback(async () => {
    if (trendsLoaded) return
    setTrendsLoading(true)
    try {
      const [t1, t2, c] = await Promise.all([
        api.get<Trends>('/reports/trends?weeks=8'),
        api.get<ClassOverview[]>('/reports/class-overview'),
        api.get<{ items: ClassItem[] }>('/classes?pageSize=200'),
      ])
      setTrends(t1.data); setClassOverview(t2.data); setClasses(c.data.items ?? []); setTrendsLoaded(true)
    } catch {} finally { setTrendsLoading(false) }
  }, [trendsLoaded])
  useEffect(() => { if (tab === 'trends') loadTrends() }, [tab])

  // ── Class attendance trend (fires when classId changes inside trends tab)
  const loadAttTrend = useCallback(async (classId: string) => {
    setAttTrendLoading(true)
    try {
      const params: Record<string,string> = { weeks: '8' }
      if (classId) params.classId = classId
      const r = await api.get<AttTrend>('/reports/class-attendance-trend', { params })
      setAttTrend(r.data)
    } catch {} finally { setAttTrendLoading(false) }
  }, [])
  useEffect(() => { if (tab === 'trends' && trendsLoaded) loadAttTrend(attTrendClassId) }, [attTrendClassId, trendsLoaded])

  // ── Score trend per class
  const loadScoreTrend = useCallback(async (classId: string) => {
    setScoreTrendLoading(true)
    try {
      const params: Record<string,string> = { weeks: '12' }
      if (classId) params.classId = classId
      const r = await api.get<ScoreTrend>('/reports/score-trends', { params })
      setScoreTrend(r.data)
    } catch {} finally { setScoreTrendLoading(false) }
  }, [])
  useEffect(() => { if (tab === 'trends' && trendsLoaded) loadScoreTrend(scoreTrendClassId) }, [scoreTrendClassId, trendsLoaded])

  // ── Confession gaps
  const loadConfessionGaps = useCallback(async () => {
    setConfessionLoading(true); setConfessionLoaded(false)
    try { const r = await api.get<ConfessionGap[]>(`/reports/confession-gaps?thresholdDays=${threshold}`); setConfessionGaps(r.data); setConfessionLoaded(true) }
    catch {} finally { setConfessionLoading(false) }
  }, [threshold])
  useEffect(() => { if (tab === 'confession') loadConfessionGaps() }, [tab, threshold])

  // ── Growth (lazy)
  const loadGrowth = useCallback(async () => {
    if (growthLoaded) return
    setGrowthLoading(true)
    try {
      const [m, f] = await Promise.all([
        api.get<GrowthPoint[]>('/reports/member-growth?months=12'),
        api.get<GrowthPoint[]>('/reports/family-growth?months=12'),
      ])
      setMemberGrowth(m.data); setFamilyGrowth(f.data); setGrowthLoaded(true)
    } catch {} finally { setGrowthLoading(false) }
  }, [growthLoaded])
  useEffect(() => { if (tab === 'growth') loadGrowth() }, [tab])

  // ── Print handler
  const handlePrint = () => window.print()

  return (
    <div>
      <Header />
      <div className="container" ref={printRef}>

        {/* Page header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0 }}>📊 التقارير والإحصاءات</h2>
          <button onClick={handlePrint} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#eff6ff', color: '#3b82f6', border: '1px solid #93c5fd',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            🖨 طباعة / PDF
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #f3f4f6', paddingBottom: 0, flexWrap: 'wrap' }}>
          {([
            ['stats',     'الإحصاءات'],
            ['trends',    'التوجهات'],
            ['confession','تنبيهات الاعتراف'],
            ['growth',    'النمو'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 18px', fontSize: 14, fontWeight: 600,
              color: tab === key ? '#6366f1' : '#6b7280',
              borderBottom: tab === key ? '2px solid #6366f1' : '2px solid transparent',
              marginBottom: -2,
            }}>{label}</button>
          ))}
        </div>

        {/* ══ Stats tab ══ */}
        {tab === 'stats' && (
          statsLoading ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                <StatCard label={t('reports.totalFamilies')} value={stats?.totalFamilies ?? 0} />
                <StatCard label={t('reports.totalMembers')}  value={stats?.totalMembers  ?? 0} />
                <StatCard label={t('reports.totalClasses')}  value={stats?.totalClasses  ?? 0} />
                {stats?.recentAttendanceRate !== undefined && (
                  <StatCard label={t('reports.attendanceRate')}
                    value={`${stats.recentAttendanceRate.toFixed(1)}%`}
                    accent={stats.recentAttendanceRate >= 60 ? '#16a34a' : stats.recentAttendanceRate >= 30 ? '#d97706' : '#dc2626'} />
                )}
              </div>

              {attendanceSummary && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{t('reports.attendanceSummary')}</h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['week','month','quarter'] as const).map(p => (
                        <button key={p} className={`btn ${selectedPeriod === p ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setSelectedPeriod(p)}>
                          {p === 'week' ? t('reports.week') : p === 'month' ? t('reports.month') : t('reports.quarter')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                    {[
                      { label: t('reports.totalRecords'), value: attendanceSummary.totalRecords, bg: '#f9fafb', fg: '#1f2937', border: '#e5e7eb' },
                      { label: '⛪ القداس',              value: attendanceSummary.massAttendance, bg: '#fef9c3', fg: '#854d0e', border: '#fde047' },
                      { label: '📚 مدارس الأحد',         value: attendanceSummary.sundaySchoolAttendance, bg: '#dbeafe', fg: '#1e40af', border: '#93c5fd' },
                      { label: t('reports.uniqueMembers'), value: attendanceSummary.uniqueMembers, bg: '#dcfce7', fg: '#166534', border: '#86efac' },
                    ].map(c => (
                      <div key={c.label} style={{ padding: '14px 16px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: c.fg, marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: c.fg }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{t('reports.absences')}</h3>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['all','Mass','SundaySchool'] as const).map(v => (
                      <button key={v} className={`btn ${attendanceType === v ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setAttendanceType(v)}>
                        {v === 'all' ? t('visits.all') : v === 'Mass' ? '⛪ القداس' : '📚 مدارس الأحد'}
                      </button>
                    ))}
                    <ExportBtn onClick={() => downloadCSV(absentMembers.map(m => ({
                      الاسم: m.memberName, الأسرة: m.familyName, النوع: m.attendanceType,
                      'أسابيع الغياب': m.consecutiveAbsences, 'آخر حضور': m.lastAttendanceDate ?? 'لم يحضر قط',
                    })), 'غياب-الأعضاء')} />
                  </div>
                </div>
                {absentMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: '#f9fafb', borderRadius: 8 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                    <div>{t('reports.noAbsences')}</div>
                  </div>
                ) : (
                  <>
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#9a3412' }}>
                      {t('reports.membersAttention', { n: absentMembers.length })}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ minWidth: 600 }}>
                        <thead><tr>
                          <th>{t('reports.member')}</th><th>{t('reports.family')}</th>
                          <th>{t('reports.type')}</th><th>{t('reports.absenceCount')}</th>
                          <th>{t('reports.lastAttended')}</th><th></th>
                        </tr></thead>
                        <tbody>
                          {absentMembers.map(m => (
                            <tr key={`${m.memberId}-${m.attendanceType}`}>
                              <td style={{ fontWeight: 500 }}>{m.memberName}</td>
                              <td>{m.familyName}</td>
                              <td><span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: m.attendanceType === 'Mass' ? '#fef9c3' : '#dbeafe', color: m.attendanceType === 'Mass' ? '#854d0e' : '#1e40af' }}>{m.attendanceType === 'Mass' ? '⛪ القداس' : '📚 مدارس الأحد'}</span></td>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: m.consecutiveAbsences >= 5 ? '#dc2626' : '#d97706' }}>{m.consecutiveAbsences}w</td>
                              <td>{m.neverAttended ? <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>❌ لم يحضر قط</span> : m.lastAttendanceDate ? new Date(m.lastAttendanceDate).toLocaleDateString() : '—'}</td>
                              <td><Link to={`/families/${m.familyId}`} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>{t('reports.view')}</Link></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          )
        )}

        {/* ══ Trends tab ══ */}
        {tab === 'trends' && (
          trendsLoading ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
          ) : trends ? (
            <>
              {/* Overall 3-chart row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div className="card">
                  <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#374151' }}>الحضور الأسبوعي</h4>
                  <StackedBarChart data={trends.attendance.map(w => ({ label: w.label, a: w.mass, b: w.sundaySchool }))} colorA="#6366f1" colorB="#a5b4fc" labelA="القداس" labelB="مدارس الأحد" />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>آخر 8 أسابيع</div>
                </div>
                <div className="card">
                  <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#374151' }}>الحياة الروحية</h4>
                  <StackedBarChart data={trends.spiritual.map(w => ({ label: w.label, a: w.confession, b: w.communion }))} colorA="#0ea5e9" colorB="#38bdf8" labelA="اعتراف" labelB="تناول" />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>آخر 8 أسابيع</div>
                </div>
                <div className="card">
                  <h4 style={{ margin: '0 0 16px', fontSize: 14, color: '#374151' }}>نشاط الدرجات</h4>
                  <BarChart data={trends.scores.map(w => ({ label: w.label, value: w.count }))} color="#10b981" />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>درجات مسجلة أسبوعياً</div>
                </div>
              </div>

              {/* Class attendance trend over time */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: '#374151' }}>معدل حضور الفصل أسبوعياً</h4>
                  <select value={attTrendClassId} onChange={e => setAttTrendClassId(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 13, outline: 'none' }}>
                    <option value="">كل الأعضاء</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                  </select>
                </div>
                {attTrendLoading ? (
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>جارٍ التحميل…</p>
                ) : attTrend ? (
                  <>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      الفصل: <strong>{attTrend.className}</strong> — المسجلون: <strong>{attTrend.enrolled}</strong>
                    </div>
                    <LineChart
                      data={attTrend.weeks.map(w => ({ label: w.label, value: w.rate }))}
                      color="#6366f1"
                    />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>معدل الحضور % — آخر 8 أسابيع</div>
                  </>
                ) : null}
              </div>

              {/* Score trends per class */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14, color: '#374151' }}>توجهات الدرجات بالفصل</h4>
                  <select value={scoreTrendClassId} onChange={e => setScoreTrendClassId(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 13, outline: 'none' }}>
                    <option value="">كل الأعضاء</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                  </select>
                </div>
                {scoreTrendLoading ? (
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>جارٍ التحميل…</p>
                ) : scoreTrend ? (
                  <>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>النطاق: <strong>{scoreTrend.scopeName}</strong></div>
                    <BarChart
                      data={scoreTrend.weeks.map(w => ({ label: w.label, value: w.count }))}
                      color="#f59e0b"
                    />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>درجات مسجلة أسبوعياً — آخر 12 أسبوعاً</div>
                  </>
                ) : null}
              </div>

              {/* Class overview table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>نظرة عامة على الفصول (آخر 4 أسابيع)</h3>
                  <ExportBtn onClick={() => downloadCSV(classOverview.map(c => ({
                    الفصل: c.className, المجموعة: c.groupName ?? '—', المسجلون: c.enrolled,
                    الحضور: c.attCount, 'معدل الحضور%': c.attRatePct, الدرجات: c.scoreCount,
                  })), 'نظرة-الفصول')} />
                </div>
                {classOverview.length === 0 ? (
                  <p style={{ color: '#9ca3af', textAlign: 'center' }}>لا توجد فصول مسجلة.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ minWidth: 520 }}>
                      <thead><tr>
                        <th>الفصل</th><th>المجموعة</th><th>المسجلون</th>
                        <th>الحضور</th><th>معدل الحضور</th><th>الدرجات</th>
                      </tr></thead>
                      <tbody>
                        {classOverview.map(c => (
                          <tr key={c.classId}>
                            <td style={{ fontWeight: 600 }}>{c.className}</td>
                            <td style={{ color: '#6b7280', fontSize: 13 }}>{c.groupName ?? '—'}</td>
                            <td style={{ textAlign: 'center' }}>{c.enrolled}</td>
                            <td style={{ textAlign: 'center' }}>{c.attCount}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: 700, color: c.attRatePct >= 60 ? '#16a34a' : c.attRatePct >= 30 ? '#d97706' : '#dc2626' }}>{c.attRatePct}%</span>
                              <div style={{ background: '#f3f4f6', borderRadius: 9999, height: 4, marginTop: 4, overflow: 'hidden' }}>
                                <div style={{ background: c.attRatePct >= 60 ? '#16a34a' : c.attRatePct >= 30 ? '#d97706' : '#dc2626', height: '100%', width: `${Math.min(c.attRatePct, 100)}%`, borderRadius: 9999 }} />
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>{c.scoreCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: '#ef4444', textAlign: 'center' }}>تعذر تحميل بيانات التوجهات.</p>
          )
        )}

        {/* ══ Confession tab ══ */}
        {tab === 'confession' && (
          <div>
            <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>عرض الأعضاء الذين مضى على آخر اعتراف لهم أكثر من:</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[14, 30, 60, 90].map(d => (
                  <button key={d} className={`btn ${threshold === d ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setThreshold(d)}>
                    {d} يوم
                  </button>
                ))}
              </div>
              {confessionLoaded && confessionGaps.length > 0 && (
                <ExportBtn onClick={() => downloadCSV(confessionGaps.map(m => ({
                  الاسم: m.fullName, الأسرة: m.familyName ?? '—', 'أب الاعتراف': m.confessionFather ?? '—',
                  'آخر اعتراف': m.neverConfessed ? 'لم يعترف قط' : (m.lastConfessionDate ? new Date(m.lastConfessionDate).toLocaleDateString('ar-EG') : '—'),
                  'الفجوة (يوم)': m.neverConfessed ? '—' : m.gapDays,
                })), `فجوة-الاعتراف-${threshold}يوم`)} />
              )}
            </div>

            {confessionLoading ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
            ) : !confessionLoaded ? null : confessionGaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                <div style={{ fontWeight: 600, color: '#166534' }}>جميع الأعضاء اعترفوا خلال آخر {threshold} يوم</div>
              </div>
            ) : (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 700, padding: '4px 12px', borderRadius: 20, fontSize: 13 }}>⚠️ {confessionGaps.length} عضو</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>لم يعترفوا منذ أكثر من {threshold} يوماً</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ minWidth: 560 }}>
                    <thead><tr>
                      <th>العضو</th><th>الأسرة</th><th>أب الاعتراف</th><th>آخر اعتراف</th><th>الفجوة</th><th></th>
                    </tr></thead>
                    <tbody>
                      {confessionGaps.map(m => {
                        const urgent = m.neverConfessed || (m.gapDays ?? 0) >= 90
                        const warn   = !urgent && (m.gapDays ?? 0) >= 60
                        return (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                            <td style={{ color: '#6b7280', fontSize: 13 }}>{m.familyName ?? '—'}</td>
                            <td style={{ color: '#6b7280', fontSize: 13 }}>{m.confessionFather ?? '—'}</td>
                            <td>{m.neverConfessed ? <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>❌ لم يعترف قط</span> : <span>{new Date(m.lastConfessionDate!).toLocaleDateString('ar-EG')}</span>}</td>
                            <td>{!m.neverConfessed && m.gapDays != null && <span style={{ fontWeight: 700, color: urgent ? '#dc2626' : warn ? '#d97706' : '#6b7280' }}>{m.gapDays} يوم</span>}</td>
                            <td><Link to={`/families/${m.familyId}`} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}>عرض</Link></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ Growth tab ══ */}
        {tab === 'growth' && (
          !canGrowth ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>هذا التقرير متاح للقادة فقط.</p>
          ) : growthLoading ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>

                {/* Member growth */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, fontSize: 14, color: '#374151' }}>الأعضاء الجدد شهرياً</h4>
                    <ExportBtn onClick={() => downloadCSV(memberGrowth.map(m => ({
                      الشهر: m.label, 'أعضاء جدد': m.newMembers ?? 0, 'الإجمالي التراكمي': m.totalSoFar,
                    })), 'نمو-الأعضاء')} />
                  </div>
                  {memberGrowth.length > 0 ? (
                    <>
                      <BarChart
                        data={memberGrowth.map(p => ({ label: p.label, value: p.newMembers ?? 0 }))}
                        color="#6366f1"
                      />
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: '#6b7280' }}>
                        <span>الإجمالي الحالي: <strong style={{ color: '#1f2937' }}>{memberGrowth[memberGrowth.length - 1]?.totalSoFar ?? 0}</strong></span>
                        <span>متوسط شهري: <strong style={{ color: '#1f2937' }}>
                          {Math.round(memberGrowth.reduce((s, p) => s + (p.newMembers ?? 0), 0) / memberGrowth.length)}
                        </strong></span>
                      </div>
                    </>
                  ) : <p style={{ color: '#9ca3af', fontSize: 13 }}>لا توجد بيانات.</p>}
                </div>

                {/* Family growth */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0, fontSize: 14, color: '#374151' }}>الأسر الجديدة شهرياً</h4>
                    <ExportBtn onClick={() => downloadCSV(familyGrowth.map(f => ({
                      الشهر: f.label, 'أسر جديدة': f.newFamilies ?? 0, 'الإجمالي التراكمي': f.totalSoFar,
                    })), 'نمو-الأسر')} />
                  </div>
                  {familyGrowth.length > 0 ? (
                    <>
                      <BarChart
                        data={familyGrowth.map(p => ({ label: p.label, value: p.newFamilies ?? 0 }))}
                        color="#0ea5e9"
                      />
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: '#6b7280' }}>
                        <span>الإجمالي الحالي: <strong style={{ color: '#1f2937' }}>{familyGrowth[familyGrowth.length - 1]?.totalSoFar ?? 0}</strong></span>
                        <span>متوسط شهري: <strong style={{ color: '#1f2937' }}>
                          {Math.round(familyGrowth.reduce((s, p) => s + (p.newFamilies ?? 0), 0) / familyGrowth.length)}
                        </strong></span>
                      </div>
                    </>
                  ) : <p style={{ color: '#9ca3af', fontSize: 13 }}>لا توجد بيانات.</p>}
                </div>
              </div>

              {/* Combined growth table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ margin: 0, fontSize: 14 }}>تفاصيل النمو الشهري</h4>
                  <ExportBtn onClick={() => {
                    const rows = memberGrowth.map((m, i) => ({
                      الشهر: m.label,
                      'أعضاء جدد': m.newMembers ?? 0,
                      'إجمالي الأعضاء': m.totalSoFar,
                      'أسر جديدة': familyGrowth[i]?.newFamilies ?? 0,
                      'إجمالي الأسر': familyGrowth[i]?.totalSoFar ?? 0,
                    }))
                    downloadCSV(rows, 'تفاصيل-النمو')
                  }} label="تصدير الكل" />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ minWidth: 480 }}>
                    <thead><tr>
                      <th>الشهر</th><th>أعضاء جدد</th><th>إجمالي الأعضاء</th>
                      <th>أسر جديدة</th><th>إجمالي الأسر</th>
                    </tr></thead>
                    <tbody>
                      {memberGrowth.map((m, i) => (
                        <tr key={m.label}>
                          <td style={{ fontWeight: 600 }}>{m.label}</td>
                          <td style={{ textAlign: 'center', color: (m.newMembers ?? 0) > 0 ? '#6366f1' : '#9ca3af', fontWeight: (m.newMembers ?? 0) > 0 ? 700 : 400 }}>{m.newMembers ?? 0}</td>
                          <td style={{ textAlign: 'center', color: '#6b7280' }}>{m.totalSoFar}</td>
                          <td style={{ textAlign: 'center', color: (familyGrowth[i]?.newFamilies ?? 0) > 0 ? '#0ea5e9' : '#9ca3af', fontWeight: (familyGrowth[i]?.newFamilies ?? 0) > 0 ? 700 : 400 }}>{familyGrowth[i]?.newFamilies ?? 0}</td>
                          <td style={{ textAlign: 'center', color: '#6b7280' }}>{familyGrowth[i]?.totalSoFar ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        )}

      </div>
    </div>
  )
}
