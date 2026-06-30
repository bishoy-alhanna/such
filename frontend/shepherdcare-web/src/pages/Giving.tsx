import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'

interface Family { id: string; familyName: string }
interface GivingRecord {
  id: string; familyId: string; familyName: string
  amount: number; date: string; type: string
  notes?: string; isConfidential: boolean
}
interface GivingSummary {
  year: number; totalGiven: number; pledgedAmount: number; pledgeId?: string
  byType: { type: string; total: number }[]
}
interface Pledge {
  id: string; familyId: string; familyName: string
  year: number; pledgedAmount: number; notes?: string; isActive: boolean
}

const GIVING_TYPES = ['Tithe', 'Pledge', 'Donation', 'Building', 'Other']
const TYPE_AR: Record<string, string> = {
  Tithe: 'عشور', Pledge: 'نذر', Donation: 'تبرع', Building: 'مبنى', Other: 'أخرى',
}
const TYPE_COLOR: Record<string, string> = {
  Tithe: '#6366f1', Pledge: '#0ea5e9', Donation: '#10b981', Building: '#f59e0b', Other: '#6b7280',
}

function fmt(n: number) { return n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }

export default function GivingPage() {
  const { user } = useAuth()
  const year = new Date().getFullYear()

  const [families, setFamilies]         = useState<Family[]>([])
  const [selectedFamily, setSelected]   = useState<string>('')
  const [records, setRecords]           = useState<GivingRecord[]>([])
  const [summary, setSummary]           = useState<GivingSummary | null>(null)
  const [pledge, setPledge]             = useState<Pledge | null>(null)
  const [loading, setLoading]           = useState(false)
  const [selectedYear, setSelectedYear] = useState(year)

  // Create modal
  const [showCreate, setShowCreate]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [amount, setAmount]           = useState('')
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10))
  const [gType, setGType]             = useState('Tithe')
  const [notes, setNotes]             = useState('')
  const [confidential, setConf]       = useState(true)
  const [editId, setEditId]           = useState<string | null>(null)

  // Pledge modal
  const [showPledge, setShowPledge]   = useState(false)
  const [pledgeAmount, setPledgeAmt]  = useState('')
  const [pledgeNotes, setPledgeNotes] = useState('')

  useEffect(() => {
    api.get<{ items: Family[] }>('/families?pageSize=500')
      .then(r => setFamilies(r.data.items ?? []))
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    if (!selectedFamily) return
    setLoading(true)
    try {
      const [rec, sum] = await Promise.all([
        api.get<GivingRecord[]>('/giving', { params: { familyId: selectedFamily, year: selectedYear } }),
        api.get<GivingSummary>('/giving/summary', { params: { familyId: selectedFamily, year: selectedYear } }),
      ])
      setRecords(rec.data)
      setSummary(sum.data)
      const pl = await api.get<Pledge[]>('/giving/pledges', { params: { familyId: selectedFamily } })
      setPledge(pl.data.find(p => p.year === selectedYear) ?? null)
    } catch { setRecords([]); setSummary(null) }
    finally { setLoading(false) }
  }, [selectedFamily, selectedYear])

  useEffect(() => { loadData() }, [loadData])

  const openCreate = (rec?: GivingRecord) => {
    if (rec) {
      setEditId(rec.id); setAmount(String(rec.amount)); setDate(rec.date.slice(0,10))
      setGType(rec.type); setNotes(rec.notes ?? ''); setConf(rec.isConfidential)
    } else {
      setEditId(null); setAmount(''); setDate(new Date().toISOString().slice(0,10))
      setGType('Tithe'); setNotes(''); setConf(true)
    }
    setShowCreate(true)
  }

  const saveRecord = async () => {
    if (!amount || !selectedFamily) return
    setSaving(true)
    try {
      const body = { familyId: selectedFamily, amount: parseFloat(amount), date, type: gType, notes, isConfidential: confidential }
      if (editId) await api.put(`/giving/${editId}`, body)
      else await api.post('/giving', body)
      setShowCreate(false); loadData()
    } catch {} finally { setSaving(false) }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return
    await api.delete(`/giving/${id}`); loadData()
  }

  const savePledge = async () => {
    if (!pledgeAmount || !selectedFamily) return
    setSaving(true)
    try {
      await api.post('/giving/pledges', { familyId: selectedFamily, year: selectedYear, pledgedAmount: parseFloat(pledgeAmount), notes: pledgeNotes, isActive: true })
      setShowPledge(false); loadData()
    } catch {} finally { setSaving(false) }
  }

  const openPledge = () => {
    setPledgeAmt(pledge ? String(pledge.pledgedAmount) : '')
    setPledgeNotes(pledge?.notes ?? '')
    setShowPledge(true)
  }

  const progress = summary && summary.pledgedAmount > 0
    ? Math.min(100, (summary.totalGiven / summary.pledgedAmount) * 100) : 0

  // Report tab
  const [tab, setTab] = useState<'family' | 'report'>('family')
  const [reportYear, setReportYear] = useState(year)
  interface GivingReport {
    year: number; totalGiven: number; totalPledged: number; familiesCount: number
    byType: { type: string; total: number; count: number }[]
    byMonth: { month: number; total: number }[]
    topFamilies: { familyId: string; familyName: string; total: number }[]
  }
  const [report, setReport] = useState<GivingReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'report') return
    setReportLoading(true)
    api.get<GivingReport>('/giving/report', { params: { year: reportYear } })
      .then(r => setReport(r.data))
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false))
  }, [tab, reportYear])

  const MONTH_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

  return (
    <div>
      <Header />
      <div className="container">
        <div className="page-header">
          <h2 style={{ margin: 0 }}>💰 العطاء والإدارة المالية</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {([['family', '👨‍👩‍👧‍👦 عرض أسرة'], ['report', '📊 تقرير الكنيسة']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: 8, border: '2px solid', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              borderColor: tab === t ? '#6366f1' : '#e5e7eb',
              background: tab === t ? '#6366f1' : '#fff',
              color: tab === t ? '#fff' : '#6b7280',
            }}>{label}</button>
          ))}
        </div>

        {/* Church-wide Report Tab */}
        {tab === 'report' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
              <label style={{ fontWeight: 600, fontSize: 14 }}>السنة:</label>
              <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))}
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
                {Array.from({ length: 5 }, (_, i) => year - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {reportLoading ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
            ) : report ? (
              <>
                {/* KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'إجمالي العطاء', value: `${fmt(report.totalGiven)} ج`, color: '#16a34a' },
                    { label: 'إجمالي النذور', value: `${fmt(report.totalPledged)} ج`, color: '#6366f1' },
                    { label: 'عدد الأسر المشاركة', value: String(report.familiesCount), color: '#0ea5e9' },
                  ].map(c => (
                    <div key={c.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{c.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                  ))}
                </div>

                {/* By type */}
                <div className="card" style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: 14 }}>العطاء حسب النوع</h4>
                  {report.byType.map(bt => {
                    const pct = report.totalGiven > 0 ? (bt.total / report.totalGiven * 100).toFixed(1) : '0'
                    return (
                      <div key={bt.type} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{TYPE_AR[bt.type] ?? bt.type}</span>
                          <span style={{ color: '#6b7280' }}>{fmt(bt.total)} ج ({pct}%)</span>
                        </div>
                        <div style={{ background: '#f3f4f6', borderRadius: 9999, height: 8 }}>
                          <div style={{ background: TYPE_COLOR[bt.type] ?? '#6366f1', height: '100%', width: `${pct}%`, borderRadius: 9999 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Monthly chart */}
                {report.byMonth.length > 0 && (
                  <div className="card" style={{ marginBottom: 20 }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: 14 }}>التوزيع الشهري</h4>
                    {(() => {
                      const maxM = Math.max(...report.byMonth.map(m => m.total), 1)
                      return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                          {Array.from({ length: 12 }, (_, i) => {
                            const d = report.byMonth.find(m => m.month === i + 1)
                            const h = d ? Math.max(6, (d.total / maxM) * 100) : 6
                            return (
                              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div title={`${MONTH_AR[i]}: ${d ? fmt(d.total) : '0'} ج`}
                                  style={{ width: '100%', height: `${h}%`, background: d ? '#6366f1' : '#e5e7eb', borderRadius: '4px 4px 0 0', transition: 'height .3s' }} />
                                <span style={{ fontSize: 8, color: '#9ca3af' }}>{MONTH_AR[i].substring(0, 3)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Top families */}
                {report.topFamilies.length > 0 && (
                  <div className="card">
                    <h4 style={{ margin: '0 0 14px', fontSize: 14 }}>أكثر الأسر عطاءً</h4>
                    {report.topFamilies.map((f, i) => (
                      <div key={f.familyId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < report.topFamilies.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          <span style={{ color: '#9ca3af', marginInlineEnd: 8 }}>#{i + 1}</span>
                          {f.familyName}
                        </span>
                        <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 14 }}>{fmt(f.total)} ج</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ textAlign: 'center', color: '#9ca3af' }}>لا توجد بيانات</p>
            )}
          </div>
        )}

        {/* Family + year selector */}
        {tab === 'family' && (<>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <select value={selectedFamily} onChange={e => setSelected(e.target.value)}
            style={{ flex: '2 1 200px', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none' }}>
            <option value="">— اختر أسرة —</option>
            {families.map(f => <option key={f.id} value={f.id}>{f.familyName}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ flex: '0 0 110px', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none' }}>
            {Array.from({ length: 5 }, (_, i) => year - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {selectedFamily && (
            <>
              <button onClick={() => openCreate()} className="btn btn-primary" style={{ flex: '0 0 auto' }}>+ إضافة سجل</button>
              <button onClick={openPledge} className="btn btn-secondary" style={{ flex: '0 0 auto' }}>🤝 النذر / التعهد</button>
            </>
          )}
        </div>

        {!selectedFamily ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
            <div style={{ fontSize: 16 }}>اختر أسرة لعرض سجلات العطاء</div>
          </div>
        ) : loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>جارٍ التحميل…</p>
        ) : (
          <>
            {/* Summary cards */}
            {summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>إجمالي العطاء {selectedYear}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{fmt(summary.totalGiven)} ج</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>النذر / التعهد</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#6366f1' }}>{fmt(summary.pledgedAmount)} ج</div>
                </div>
                {summary.pledgedAmount > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 20px', gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: '#6b7280' }}>تقدم النذر</span>
                      <span style={{ fontWeight: 700, color: progress >= 100 ? '#16a34a' : '#6366f1' }}>{progress.toFixed(0)}%</span>
                    </div>
                    <div style={{ background: '#f3f4f6', borderRadius: 9999, height: 10, overflow: 'hidden' }}>
                      <div style={{ background: progress >= 100 ? '#16a34a' : '#6366f1', height: '100%', width: `${progress}%`, borderRadius: 9999, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}
                {summary.byType.map(bt => (
                  <div key={bt.type} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px' }}>
                    <div style={{ fontSize: 11, color: TYPE_COLOR[bt.type] ?? '#6b7280', marginBottom: 4, fontWeight: 600 }}>{TYPE_AR[bt.type] ?? bt.type}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>{fmt(bt.total)} ج</div>
                  </div>
                ))}
              </div>
            )}

            {/* Records table */}
            <div className="card">
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>السجلات ({records.length})</h3>
              {records.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af' }}>لا توجد سجلات لهذه السنة.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ minWidth: 500 }}>
                    <thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظات</th><th>سري</th><th></th></tr></thead>
                    <tbody>
                      {records.map(r => (
                        <tr key={r.id}>
                          <td>{new Date(r.date).toLocaleDateString('ar-EG')}</td>
                          <td><span style={{ background: TYPE_COLOR[r.type] + '22', color: TYPE_COLOR[r.type], padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{TYPE_AR[r.type] ?? r.type}</span></td>
                          <td style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(r.amount)} ج</td>
                          <td style={{ color: '#6b7280', fontSize: 13 }}>{r.notes ?? '—'}</td>
                          <td>{r.isConfidential ? '🔒' : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => openCreate(r)} className="btn btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>تعديل</button>
                              <button onClick={() => deleteRecord(r.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        </>)}

        {/* Create / Edit modal */}
        {showCreate && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
              <h3 style={{ margin: '0 0 20px' }}>{editId ? 'تعديل سجل' : 'إضافة سجل عطاء'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>المبلغ (ج.م)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>التاريخ</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>النوع</label>
                  <select value={gType} onChange={e => setGType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}>
                    {GIVING_TYPES.map(t => <option key={t} value={t}>{TYPE_AR[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>ملاحظات</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={confidential} onChange={e => setConf(e.target.checked)} />
                  🔒 سري (يظهر للكهنة والقادة فقط)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={saveRecord} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
                <button onClick={() => setShowCreate(false)} className="btn btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {/* Pledge modal */}
        {showPledge && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 20px' }}>🤝 النذر / التعهد {selectedYear}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>المبلغ المتعهد به (ج.م)</label>
                  <input type="number" value={pledgeAmount} onChange={e => setPledgeAmt(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: '#6b7280', marginBottom: 4, display: 'block' }}>ملاحظات</label>
                  <input value={pledgeNotes} onChange={e => setPledgeNotes(e.target.value)} placeholder="اختياري"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={savePledge} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
                <button onClick={() => setShowPledge(false)} className="btn btn-secondary" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
