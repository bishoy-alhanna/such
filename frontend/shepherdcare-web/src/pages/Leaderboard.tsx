import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Header from '../components/Header'
import { useAuth } from '../auth'

// ── Types ──────────────────────────────────────────────────────────────────

interface LBEntry {
  rank: number
  memberId: string
  memberName: string
  photoUrl?: string
  className?: string
  totalScore: number
  count: number
  isMe?: boolean
}

interface ClassBoard {
  classId: string
  className: string
  myRank?: number
  myScore: number
  totalMembers: number
  leaderboard: LBEntry[]
}

interface GroupBoard {
  groupId: string
  groupName: string
  myRank?: number
  myScore: number
  totalMembers: number
  leaderboard: LBEntry[]
}

interface MyLeaderboards {
  myMemberId?: string
  myName?: string
  classes: ClassBoard[]
  groups: GroupBoard[]
}

interface GroupOption  { id: string; name: string }
interface ClassOption  { id: string; className: string }
interface CategoryOption { id: string; name: string }

// ── Helpers ────────────────────────────────────────────────────────────────

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span title="1st">🥇</span>
  if (rank === 2) return <span title="2nd">🥈</span>
  if (rank === 3) return <span title="3rd">🥉</span>
  return <span style={{ fontWeight: 700, color: '#374151' }}>{rank}</span>
}

function LBTable({
  rows,
  showClass,
  highlightId,
  canLink,
}: {
  rows: LBEntry[]
  showClass?: boolean
  highlightId?: string
  canLink?: boolean
}) {
  if (rows.length === 0)
    return <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.88rem' }}>No scores recorded yet.</p>

  return (
    <table className="table" style={{ fontSize: '0.88rem' }}>
      <thead>
        <tr>
          <th style={{ width: 44 }}>#</th>
          <th>Member</th>
          {showClass && <th>Class</th>}
          <th style={{ width: 90, textAlign: 'right' }}>Score</th>
          <th style={{ width: 70, textAlign: 'right' }}>Entries</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const isHighlighted = row.isMe || row.memberId === highlightId
          return (
            <tr key={row.memberId} style={isHighlighted ? {
              background: '#eff6ff', outline: '2px solid #3b82f6', outlineOffset: -2
            } : undefined}>
              <td><Medal rank={row.rank} /></td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: '#f1f5f9', border: '1px solid #e5e7eb',
                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15
                  }}>
                    {row.photoUrl
                      ? <img src={row.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '👤'}
                  </div>
                  <div>
                    {canLink
                      ? <Link to={`/members/${row.memberId}`} style={{ color: '#1d4ed8', fontWeight: isHighlighted ? 700 : 500, textDecoration: 'none' }}>{row.memberName}</Link>
                      : <span style={{ fontWeight: isHighlighted ? 700 : 400 }}>{row.memberName}</span>}
                    {isHighlighted && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: 10 }}>YOU</span>
                    )}
                  </div>
                </div>
              </td>
              {showClass && <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{row.className ?? '—'}</td>}
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{row.totalScore}</td>
              <td style={{ textAlign: 'right', color: '#64748b' }}>{row.count}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RankBadge({ rank, total }: { rank?: number; total: number }) {
  if (!rank) return null
  const pct = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8' }}>#{rank}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Your rank</div>
      </div>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#166534' }}>{pct}%</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Top percentile</div>
      </div>
      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#374151' }}>{total}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total members</div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const auth = useAuth()
  const isMember   = auth.hasRole('Member')
  const isFullAccess = auth.hasRole('SuperAdmin') || auth.hasRole('ServiceLeader') || auth.hasRole('Priest') || auth.hasRole('SeniorPriest')
  const canLink    = !isMember

  // Member mode
  const [myData, setMyData]       = useState<MyLeaderboards | null>(null)
  const [myLoading, setMyLoading] = useState(false)

  // Admin/servant mode — group selector
  const [groups, setGroups]       = useState<GroupOption[]>([])
  const [selGroupId, setSelGroupId] = useState('')
  const [groupBoard, setGroupBoard] = useState<{ groupName: string; members: LBEntry[] } | null>(null)
  const [groupLoading, setGroupLoading] = useState(false)

  // Admin/servant mode — class selector
  const [classes, setClasses]     = useState<ClassOption[]>([])
  const [selClassId, setSelClassId] = useState('')
  const [classBoard, setClassBoard] = useState<{ className?: string; members: LBEntry[] } | null>(null)
  const [classLoading, setClassLoading] = useState(false)

  // Shared
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [catId, setCatId]           = useState('')

  // ── Load categories ──────────────────────────────────────────────────────
  useEffect(() => {
    api.get<CategoryOption[]>('/score-categories').then(r => setCategories(r.data)).catch(() => {})
  }, [])

  // ── Member mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMember) return
    setMyLoading(true)
    api.get<MyLeaderboards>('/scores/my-leaderboards', { params: catId ? { categoryId: catId } : {} })
      .then(r => setMyData(r.data))
      .catch(() => setMyData(null))
      .finally(() => setMyLoading(false))
  }, [isMember, catId])

  // ── Admin/servant mode ───────────────────────────────────────────────────
  useEffect(() => {
    if (isMember) return
    api.get<GroupOption[]>('/groups').then(r => setGroups(r.data)).catch(() => {})
  }, [isMember])

  useEffect(() => {
    if (!selGroupId) { setClasses([]); setClassBoard(null); setGroupBoard(null); return }
    // Load classes in group
    api.get<{ classes?: ClassOption[] }>(`/groups/${selGroupId}`)
      .then(r => setClasses((r.data as any).classes ?? []))
      .catch(() => setClasses([]))
    // Load group member leaderboard
    setGroupLoading(true)
    api.get<{ groupName: string; members: LBEntry[] }>(
      `/scores/group/${selGroupId}/member-leaderboard`,
      { params: catId ? { categoryId: catId } : {} }
    ).then(r => setGroupBoard(r.data))
      .catch(() => setGroupBoard(null))
      .finally(() => setGroupLoading(false))
  }, [selGroupId, catId])

  useEffect(() => {
    if (!selClassId) { setClassBoard(null); return }
    setClassLoading(true)
    api.get<{ members: LBEntry[] }>(
      `/scores/class/${selClassId}/leaderboard`,
      { params: catId ? { categoryId: catId } : {} }
    ).then(r => setClassBoard(r.data))
      .catch(() => setClassBoard(null))
      .finally(() => setClassLoading(false))
  }, [selClassId, catId])

  // ── Render ───────────────────────────────────────────────────────────────

  const categoryBar = (
    <div style={{ marginBottom: 20 }}>
      <select value={catId} onChange={e => setCatId(e.target.value)}
        style={{ fontSize: '0.88rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
        <option value="">All categories</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  )

  // ── Member view ──────────────────────────────────────────────────────────
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

          {categoryBar}

          {myLoading && <p style={{ color: '#888' }}>Loading…</p>}

          {!myLoading && myData && myData.classes.length === 0 && myData.groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p>You haven't been enrolled in any classes yet.</p>
            </div>
          )}

          {/* Per-class leaderboards */}
          {myData?.classes.map(cls => (
            <div key={cls.classId} className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0 }}>📚 {cls.className}</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Class leaderboard</span>
              </div>
              <RankBadge rank={cls.myRank} total={cls.totalMembers} />
              <LBTable rows={cls.leaderboard} highlightId={myData.myMemberId} canLink={false} />
            </div>
          ))}

          {/* Per-group leaderboards */}
          {myData?.groups.map(grp => (
            <div key={grp.groupId} className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0 }}>👥 {grp.groupName}</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Group leaderboard</span>
              </div>
              <RankBadge rank={grp.myRank} total={grp.totalMembers} />
              <LBTable rows={grp.leaderboard} showClass highlightId={myData.myMemberId} canLink={false} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Admin / Servant / Leader view ────────────────────────────────────────
  return (
    <div>
      <Header />
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="page-header">
          <h2>🏆 Leaderboard</h2>
        </div>

        {/* Selectors */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {(isFullAccess || groups.length > 0) && (
            <select value={selGroupId} onChange={e => { setSelGroupId(e.target.value); setSelClassId('') }}
              style={{ minWidth: 200, fontSize: '0.88rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
              <option value="">— Select group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          {classes.length > 0 && (
            <select value={selClassId} onChange={e => setSelClassId(e.target.value)}
              style={{ minWidth: 200, fontSize: '0.88rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
              <option value="">— Select class —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
            </select>
          )}
          <select value={catId} onChange={e => setCatId(e.target.value)}
            style={{ minWidth: 160, fontSize: '0.88rem', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {!selGroupId && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <p>Select a group to view the leaderboard.</p>
          </div>
        )}

        {/* Class leaderboard (shown when a class is selected) */}
        {selClassId && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>
              📚 {classes.find(c => c.id === selClassId)?.className} — Members
            </h3>
            {classLoading
              ? <p style={{ color: '#888' }}>Loading…</p>
              : <LBTable rows={classBoard?.members ?? []} canLink={canLink} />}
          </div>
        )}

        {/* Group member leaderboard */}
        {selGroupId && !selClassId && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              👥 {groups.find(g => g.id === selGroupId)?.name} — All Members
            </h3>
            {groupLoading
              ? <p style={{ color: '#888' }}>Loading…</p>
              : <LBTable rows={groupBoard?.members ?? []} showClass canLink={canLink} />}
          </div>
        )}
      </div>
    </div>
  )
}
