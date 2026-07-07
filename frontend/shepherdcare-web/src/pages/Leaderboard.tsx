import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'
import type { Member } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────

interface LBEntry {
  rank: number; memberId: string; memberName: string; photoUrl?: string
  className?: string; totalScore: number; count: number; isMe?: boolean
}
interface ClassBoard { classId: string; className: string; myRank?: number; myScore: number; totalMembers: number; leaderboard: LBEntry[] }
interface GroupBoard  { groupId: string; groupName: string; myRank?: number; myScore: number; totalMembers: number; leaderboard: LBEntry[] }
interface MyLeaderboards { myMemberId?: string; myName?: string; classes: ClassBoard[]; groups: GroupBoard[] }
interface GroupOption    { id: string; name: string }
interface ClassOption    { id: string; className: string }
interface CategoryOption { id: string; name: string }
interface ScoreTeam {
  id: string; name: string; classId?: string; groupId?: string
  startDate?: string; endDate?: string; memberCount: number
  members: { memberId: string; memberName: string; photoUrl?: string }[]
}
interface TeamLB { rank: number; teamId: string; teamName: string; memberCount: number; totalScore: number }
interface MemberOption { id: string; fullName: string }

// ── Podium (top 3 spotlight) ───────────────────────────────────────────────

function Podium({ rows, highlightId, canLink }: { rows: LBEntry[]; highlightId?: string; canLink?: boolean }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return null
  const order = [top[1], top[0], top[2]].filter(Boolean)
  const heights = { 0: 90, 1: 110, 2: 70 }
  const medals  = ['🥈', '🥇', '🥉']
  const colors  = ['#94a3b8', '#f59e0b', '#b45309']

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, marginBottom: 24, padding: '0 8px' }}>
      {order.map((row, idx) => {
        if (!row) return null
        const isMe = row.isMe || row.memberId === highlightId
        return (
          <div key={row.memberId} style={{ textAlign: 'center', flex: 1, maxWidth: 140 }}>
            {row.photoUrl
              ? <img src={row.photoUrl} alt={row.memberName} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${colors[idx]}`, marginBottom: 6 }} />
              : <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f1f5f9', border: `3px solid ${colors[idx]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 6px' }}>👤</div>}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', lineHeight: 1.3, marginBottom: 2 }}>
              {canLink
                ? <Link to={`/members/${row.memberId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{row.memberName}</Link>
                : row.memberName}
              {isMe && <span style={{ display: 'block', fontSize: 9, color: '#2563eb', fontWeight: 800 }}>YOU</span>}
            </div>
            <div style={{
              height: heights[idx as keyof typeof heights], background: colors[idx],
              borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10,
              boxShadow: idx === 1 ? '0 4px 16px rgba(245,158,11,0.35)' : undefined
            }}>
              <div style={{ fontSize: idx === 1 ? 28 : 22 }}>{medals[idx]}</div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: idx === 1 ? 18 : 15 }}>{row.totalScore}</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>{row.count} entries</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Full table ─────────────────────────────────────────────────────────────

function LBTable({ rows, showClass, highlightId, canLink }: { rows: LBEntry[]; showClass?: boolean; highlightId?: string; canLink?: boolean }) {
  const rest = rows.slice(3)
  if (rest.length === 0) return null
  return (
    <table className="table" style={{ fontSize: '0.87rem' }}>
      <thead>
        <tr>
          <th style={{ width: 44 }}>#</th>
          <th>Member</th>
          {showClass && <th>Class</th>}
          <th style={{ width: 90, textAlign: 'right' }}>Score</th>
          <th style={{ width: 60, textAlign: 'right' }}>Entries</th>
        </tr>
      </thead>
      <tbody>
        {rest.map(row => {
          const isMe = row.isMe || row.memberId === highlightId
          return (
            <tr key={row.memberId} style={isMe ? { background: '#eff6ff', outline: '2px solid #3b82f6', outlineOffset: -2 } : undefined}>
              <td style={{ fontWeight: 700, color: '#6b7280' }}>{row.rank}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: '#f1f5f9', border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    {row.photoUrl ? <img src={row.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                  </div>
                  {canLink
                    ? <Link to={`/members/${row.memberId}`} style={{ color: '#1d4ed8', fontWeight: isMe ? 700 : 400, textDecoration: 'none' }}>{row.memberName}</Link>
                    : <span style={{ fontWeight: isMe ? 700 : 400 }}>{row.memberName}</span>}
                  {isMe && <span style={{ fontSize: 9, fontWeight: 800, color: '#2563eb', background: '#dbeafe', padding: '1px 5px', borderRadius: 8 }}>YOU</span>}
                </div>
              </td>
              {showClass && <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{row.className ?? '—'}</td>}
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{row.totalScore}</td>
              <td style={{ textAlign: 'right', color: '#64748b' }}>{row.count}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LBSection({ rows, showClass, highlightId, canLink, title, subtitle }: {
  rows: LBEntry[]; showClass?: boolean; highlightId?: string; canLink?: boolean; title: string; subtitle?: string
}) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {subtitle && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {rows.length > 3 && (
          <button className="btn-sm" onClick={() => setExpanded(e => !e)} style={{ fontSize: '0.78rem' }}>
            {expanded ? 'Show less' : `Show all ${rows.length}`}
          </button>
        )}
      </div>
      {rows.length === 0
        ? <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.88rem' }}>No scores recorded yet.</p>
        : <>
            <Podium rows={rows} highlightId={highlightId} canLink={canLink} />
            {expanded && <LBTable rows={rows} showClass={showClass} highlightId={highlightId} canLink={canLink} />}
          </>}
    </div>
  )
}

// ── Team comparison podium ─────────────────────────────────────────────────

function TeamPodium({ teams }: { teams: TeamLB[] }) {
  const top = teams.slice(0, 3)
  if (top.length === 0) return null
  const order = [top[1], top[0], top[2]].filter((x): x is TeamLB => !!x)
  const heights = { 0: 80, 1: 100, 2: 60 }
  const medals  = ['🥈', '🥇', '🥉']
  const colors  = ['#94a3b8', '#f59e0b', '#b45309']

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, marginBottom: 20, padding: '0 8px' }}>
      {order.map((teamData, idx) => {
        return (
          <div key={teamData.teamId} style={{ textAlign: 'center', flex: 1, maxWidth: 140 }}>
            <div style={{ fontSize: 32, marginBottom: 4 }}>{medals[idx]}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 4, lineHeight: 1.2 }}>{teamData.teamName}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{teamData.memberCount} members</div>
            <div style={{ height: heights[idx as keyof typeof heights], background: colors[idx], borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: idx === 1 ? 20 : 16 }}>{teamData.totalScore}</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>pts</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── My rank summary ────────────────────────────────────────────────────────

function MyRankBadge({ rank, total, score }: { rank?: number; total: number; score: number }) {
  if (!rank) return null
  const pct = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      {[
        { label: 'Your rank',     val: `#${rank}`,    bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
        { label: 'Your score',    val: String(score),  bg: '#fefce8', border: '#fde68a', color: '#92400e' },
        { label: 'Top',           val: `${pct}%`,      bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
        { label: 'Total members', val: String(total),  bg: '#f8fafc', border: '#e5e7eb', color: '#374151' },
      ].map(b => (
        <div key={b.label} style={{ background: b.bg, border: `1px solid ${b.border}`, borderRadius: 10, padding: '7px 14px', textAlign: 'center', minWidth: 72 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: b.color }}>{b.val}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Date range bar ─────────────────────────────────────────────────────────

function DateBar({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Period:</span>
      <input type="date" value={start} onChange={e => onStart(e.target.value)}
        style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }} />
      <span style={{ color: '#9ca3af' }}>→</span>
      <input type="date" value={end} onChange={e => onEnd(e.target.value)}
        style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }} />
      {(start || end) && (
        <button onClick={() => { onStart(''); onEnd('') }}
          style={{ fontSize: '0.78rem', color: '#6b7280', background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
          Clear
        </button>
      )}
    </div>
  )
}

// ── Team management panel ──────────────────────────────────────────────────

function TeamsPanel({ classId, groupId, catId, startDate, endDate }: {
  classId?: string; groupId?: string; catId: string; startDate: string; endDate: string
}) {
  const auth = useAuth()
  const [teams, setTeams]           = useState<ScoreTeam[]>([])
  const [teamLBs, setTeamLBs]       = useState<Record<string, LBEntry[]>>({})
  const [compareRows, setCompareRows] = useState<any[]>([])
  const [expandTeam, setExpandTeam]  = useState<Record<string, boolean>>({})
  const [showCreate, setShowCreate]  = useState(false)
  const [newName, setNewName]        = useState('')
  const [newStart, setNewStart]      = useState('')
  const [newEnd, setNewEnd]          = useState('')
  const [memberSearch, setMemberSearch] = useState<Record<string, string>>({})
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [saving, setSaving]          = useState(false)

  const canManage = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader') || auth.hasRole('Priest') ||
                    auth.hasRole('SeniorPriest') || auth.hasRole('Servant') || auth.hasRole('DataEntry')

  const params = classId ? { classId } : { groupId }

  const loadTeams = useCallback(async () => {
    const r = await api.get<ScoreTeam[]>('/score-teams', { params }).catch(() => ({ data: [] as ScoreTeam[] }))
    setTeams(r.data)
  }, [classId, groupId])

  const loadCompare = useCallback(async () => {
    const qp: Record<string, string> = { ...(classId ? { classId } : { groupId: groupId! }) }
    if (catId) qp.categoryId = catId
    if (startDate) qp.startDate = startDate
    if (endDate) qp.endDate = endDate
    const r = await api.get<{ teams: any[] }>('/score-teams/compare', { params: qp }).catch(() => ({ data: { teams: [] } }))
    setCompareRows(r.data.teams ?? [])
  }, [classId, groupId, catId, startDate, endDate])

  useEffect(() => { loadTeams() }, [loadTeams])
  useEffect(() => { if (teams.length > 0) loadCompare() }, [teams.length, loadCompare])

  const loadTeamLB = async (teamId: string) => {
    const qp: Record<string, string> = {}
    if (catId) qp.categoryId = catId
    if (startDate) qp.startDate = startDate
    if (endDate) qp.endDate = endDate
    const r = await api.get<{ members: LBEntry[] }>(`/score-teams/${teamId}/leaderboard`, { params: qp }).catch(() => ({ data: { members: [] } }))
    setTeamLBs(prev => ({ ...prev, [teamId]: r.data.members ?? [] }))
  }

  const toggleTeam = (id: string) => {
    const next = !expandTeam[id]
    setExpandTeam(prev => ({ ...prev, [id]: next }))
    if (next && !teamLBs[id]) loadTeamLB(id)
  }

  const createTeam = async () => {
    if (!newName.trim()) return
    setSaving(true)
    await api.post('/score-teams', { name: newName.trim(), classId, groupId, startDate: newStart || undefined, endDate: newEnd || undefined })
    setNewName(''); setNewStart(''); setNewEnd(''); setShowCreate(false)
    await loadTeams()
    setSaving(false)
  }

  const deleteTeam = async (id: string) => {
    if (!confirm('Delete this team?')) return
    await api.delete(`/score-teams/${id}`)
    await loadTeams()
  }

  const addMember = async (teamId: string, memberId: string) => {
    await api.post(`/score-teams/${teamId}/members`, { memberId }).catch(() => {})
    await loadTeams()
    if (expandTeam[teamId]) loadTeamLB(teamId)
  }

  const removeMember = async (teamId: string, memberId: string) => {
    await api.delete(`/score-teams/${teamId}/members/${memberId}`)
    await loadTeams()
    if (expandTeam[teamId]) loadTeamLB(teamId)
  }

  useEffect(() => {
    const q = Object.values(memberSearch).find(v => v.length >= 2)
    if (!q) { setMemberOptions([]); return }
    api.get<{ items: MemberOption[] }>('/members/search', { params: { q, pageSize: 10 } })
      .then(r => setMemberOptions(r.data.items ?? [])).catch(() => {})
  }, [memberSearch])

  const compareTeams = compareRows.map(r => ({
    rank: r.rank,
    teamId: r.team?.teamId ?? r.teamId,
    teamName: r.team?.teamName ?? r.teamName,
    memberCount: r.team?.memberCount ?? r.memberCount ?? 0,
    totalScore: r.team?.totalScore ?? r.totalScore ?? 0,
  } as TeamLB))

  return (
    <div>
      {/* Team vs team */}
      {compareTeams.length > 1 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>🏆 Team Rankings</h3>
          <TeamPodium teams={compareTeams} />
          {compareTeams.length > 3 && (
            <table className="table" style={{ fontSize: '0.87rem' }}>
              <thead><tr><th style={{ width: 44 }}>#</th><th>Team</th><th style={{ width: 80 }}>Members</th><th style={{ textAlign: 'right', width: 90 }}>Score</th></tr></thead>
              <tbody>
                {compareTeams.slice(3).map(t => (
                  <tr key={t.teamId}>
                    <td style={{ fontWeight: 700, color: '#6b7280' }}>{t.rank}</td>
                    <td style={{ fontWeight: 600 }}>{t.teamName}</td>
                    <td>{t.memberCount}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{t.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Individual teams */}
      {teams.map(team => (
        <div key={team.id} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{team.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                {team.memberCount} members
                {team.startDate && ` · ${new Date(team.startDate).toLocaleDateString()} → ${team.endDate ? new Date(team.endDate).toLocaleDateString() : '…'}`}
              </div>
            </div>
            <button className="btn-sm" onClick={() => toggleTeam(team.id)}>
              {expandTeam[team.id] ? 'Hide' : 'Leaderboard'}
            </button>
            {canManage && <button className="btn-sm btn-danger" onClick={() => deleteTeam(team.id)}>Delete</button>}
          </div>

          {expandTeam[team.id] && (
            <div style={{ marginTop: 14 }}>
              <LBSection
                rows={teamLBs[team.id] ?? []}
                title={`${team.name} — Members`}
                canLink={!auth.hasRole('Member')}
              />
              {canManage && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Add member</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={memberSearch[team.id] ?? ''}
                      onChange={e => setMemberSearch(prev => ({ ...prev, [team.id]: e.target.value }))}
                      placeholder="Search by name…" list={`ms-${team.id}`}
                      style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                    <datalist id={`ms-${team.id}`}>
                      {memberOptions.map(m => <option key={m.id} value={m.fullName} data-id={m.id} />)}
                    </datalist>
                    <button className="btn-sm btn-primary"
                      onClick={() => {
                        const found = memberOptions.find(m => m.fullName === memberSearch[team.id])
                        if (found) addMember(team.id, found.id)
                      }}>
                      Add
                    </button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {team.members.map(m => (
                      <span key={m.memberId} style={{ background: '#f1f5f9', border: '1px solid #e5e7eb', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {m.memberName}
                        <button onClick={() => removeMember(team.id, m.memberId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {canManage && (
        showCreate ? (
          <div className="card">
            <h4 style={{ marginTop: 0 }}>New Team</h4>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Team name *" autoFocus
              style={{ width: '100%', marginBottom: 10, padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 3 }}>Start date</label>
                <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: 3 }}>End date</label>
                <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={createTeam} disabled={saving || !newName.trim()}>
                {saving ? 'Creating…' : 'Create Team'}
              </button>
              <button onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ New Team</button>
        )
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

type Tab = 'leaderboard' | 'teams'

export default function LeaderboardPage() {
  const auth = useAuth()
  const isMember    = auth.hasRole('Member')
  const isFullAccess = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader') || auth.hasRole('Priest') || auth.hasRole('SeniorPriest')
  const canLink     = !isMember

  const [tab, setTab]     = useState<Tab>('leaderboard')
  const [catId, setCatId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])

  // Member mode
  const [myData, setMyData]     = useState<MyLeaderboards | null>(null)
  const [myLoading, setMyLoading] = useState(false)

  // Admin/servant mode
  const [groups, setGroups]     = useState<GroupOption[]>([])
  const [selGroupId, setSelGroupId] = useState('')
  const [groupBoard, setGroupBoard] = useState<{ groupName: string; members: LBEntry[] } | null>(null)
  const [groupLoading, setGroupLoading] = useState(false)
  const [classes, setClasses]   = useState<ClassOption[]>([])
  const [selClassId, setSelClassId] = useState('')
  const [classBoard, setClassBoard] = useState<{ members: LBEntry[] } | null>(null)
  const [classLoading, setClassLoading] = useState(false)

  useEffect(() => {
    api.get<CategoryOption[]>('/score-categories').then(r => setCategories(r.data)).catch(() => {})
  }, [])

  // Member mode load
  useEffect(() => {
    if (!isMember) return
    setMyLoading(true)
    const params: Record<string, string> = {}
    if (catId) params.categoryId = catId
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    api.get<MyLeaderboards>('/scores/my-leaderboards', { params })
      .then(r => setMyData(r.data)).catch(() => setMyData(null)).finally(() => setMyLoading(false))
  }, [isMember, catId, startDate, endDate])

  // Admin/servant: load groups
  useEffect(() => { if (!isMember) api.get<GroupOption[]>('/groups').then(r => setGroups(r.data)).catch(() => {}) }, [isMember])

  // Group selection
  useEffect(() => {
    if (!selGroupId) { setClasses([]); setGroupBoard(null); setClassBoard(null); return }
    api.get<any>(`/groups/${selGroupId}`).then(r => setClasses((r.data as any).classes ?? [])).catch(() => {})
    setGroupLoading(true)
    const params: Record<string, string> = {}
    if (catId) params.categoryId = catId
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    api.get<{ groupName: string; members: LBEntry[] }>(`/scores/group/${selGroupId}/member-leaderboard`, { params })
      .then(r => setGroupBoard(r.data)).catch(() => setGroupBoard(null)).finally(() => setGroupLoading(false))
  }, [selGroupId, catId, startDate, endDate])

  // Class selection
  useEffect(() => {
    if (!selClassId) { setClassBoard(null); return }
    setClassLoading(true)
    const params: Record<string, string> = {}
    if (catId) params.categoryId = catId
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    api.get<{ members: LBEntry[] }>(`/scores/class/${selClassId}/leaderboard`, { params })
      .then(r => setClassBoard(r.data)).catch(() => setClassBoard(null)).finally(() => setClassLoading(false))
  }, [selClassId, catId, startDate, endDate])

  const filterBar = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
      <select value={catId} onChange={e => setCatId(e.target.value)}
        style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
        <option value="">All categories</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <DateBar start={startDate} end={endDate} onStart={setStartDate} onEnd={setEndDate} />
    </div>
  )

  // ── Member view ───────────────────────────────────────────────────────────
  if (isMember) {
    return (
      <div>
        <Header />
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="page-header">
            <div>
              <h2>🏆 Leaderboard</h2>
              {myData?.myName && <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Welcome, {myData.myName}</div>}
            </div>
          </div>
          {filterBar}
          {myLoading && <p style={{ color: '#888' }}>Loading…</p>}
          {!myLoading && myData && myData.classes.length === 0 && myData.groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p>You haven't been enrolled in any classes yet.</p>
            </div>
          )}
          {myData?.classes.map(cls => (
            <div key={cls.classId}>
              <MyRankBadge rank={cls.myRank} total={cls.totalMembers} score={cls.myScore} />
              <LBSection rows={cls.leaderboard} title={`📚 ${cls.className}`} subtitle="Class leaderboard" highlightId={myData.myMemberId} canLink={false} />
            </div>
          ))}
          {myData?.groups.map(grp => (
            <div key={grp.groupId}>
              <MyRankBadge rank={grp.myRank} total={grp.totalMembers} score={grp.myScore} />
              <LBSection rows={grp.leaderboard} showClass title={`👥 ${grp.groupName}`} subtitle="Group leaderboard" highlightId={myData.myMemberId} canLink={false} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Admin / Servant / Leader view ─────────────────────────────────────────
  return (
    <div>
      <Header />
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="page-header">
          <h2>🏆 Leaderboard</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn-sm${tab === 'leaderboard' ? ' btn-primary' : ''}`} onClick={() => setTab('leaderboard')}>Rankings</button>
            <button className={`btn-sm${tab === 'teams' ? ' btn-primary' : ''}`} onClick={() => setTab('teams')}>⚔️ Teams</button>
          </div>
        </div>

        {/* Selectors */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <select value={selGroupId} onChange={e => { setSelGroupId(e.target.value); setSelClassId('') }}
            style={{ minWidth: 190, fontSize: '0.85rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="">— Select group —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {classes.length > 0 && (
            <select value={selClassId} onChange={e => setSelClassId(e.target.value)}
              style={{ minWidth: 190, fontSize: '0.85rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
              <option value="">— All classes —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
            </select>
          )}
        </div>
        {filterBar}

        {!selGroupId && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <p>Select a group to view leaderboards and manage teams.</p>
          </div>
        )}

        {selGroupId && tab === 'leaderboard' && (
          <>
            {selClassId ? (
              classLoading
                ? <p style={{ color: '#888' }}>Loading…</p>
                : <LBSection rows={classBoard?.members ?? []} title={`📚 ${classes.find(c => c.id === selClassId)?.className} — Members`} canLink={canLink} />
            ) : (
              groupLoading
                ? <p style={{ color: '#888' }}>Loading…</p>
                : <LBSection rows={groupBoard?.members ?? []} showClass title={`👥 ${groups.find(g => g.id === selGroupId)?.name} — All Members`} canLink={canLink} />
            )}
          </>
        )}

        {selGroupId && tab === 'teams' && (
          <TeamsPanel
            classId={selClassId || undefined}
            groupId={selClassId ? undefined : selGroupId}
            catId={catId}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </div>
    </div>
  )
}
