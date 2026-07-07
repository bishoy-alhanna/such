import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Header from '../components/Header'
import api from '../services/api'
import { useT } from '../i18n'

interface Family {
  id: string
  familyName: string
  address?: string
  phone?: string
}

interface Member {
  id: string
  fullName: string
  familyId?: string
  familyName?: string
}

interface ScoreCategory {
  id: string
  name: string
  description?: string
  maxScore: number
}

export default function Dashboard() {
  const auth = useAuth()
  const { t } = useT()
  const isSuperAdmin = auth.hasRole('SuperAdmin')
  const isServiceLeader = auth.hasRole('ServiceLeader')
  const canManageGroups = isSuperAdmin || isServiceLeader
  const isMember = auth.user?.role === 'Member'

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    families: Family[]
    members: Member[]
  }>({ families: [], members: [] })
  const [isSearching, setIsSearching] = useState(false)

  // Member self-score state
  const [myCategories, setMyCategories] = useState<ScoreCategory[]>([])
  const [myPending, setMyPending] = useState<any[]>([])
  const [myProfile, setMyProfile] = useState<{ id: string } | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [submitMsg, setSubmitMsg] = useState<Record<string, string>>({})

  // Overdue tasks widget
  const [overdueCount, setOverdueCount] = useState<number | null>(null)
  const isStaff = !isMember && auth.user?.role !== undefined
  useEffect(() => {
    if (!isStaff) return
    api.get<{ count: number }>('/tasks/overdue-count').then(r => setOverdueCount(r.data.count)).catch(() => {})
  }, [isStaff])

  // Search function
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults({ families: [], members: [] })
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        const [familiesRes, membersRes] = await Promise.all([
          api.get<any>('/families', { params: { q: searchQuery, page: 1, pageSize: 5 } }),
          api.get<any>('/members/search', { params: { q: searchQuery, pageSize: 5 } })
        ])

        setSearchResults({
          families: familiesRes.data.items || [],
          members: membersRes.data.items || []
        })
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults({ families: [], members: [] })
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [searchQuery])

  const hasSearchResults = searchResults.families.length > 0 || searchResults.members.length > 0

  // Load member data when logged in as Member
  useEffect(() => {
    if (!isMember) return
    api.get('/scores/my-available-categories').then(r => setMyCategories(r.data)).catch(() => {})
    api.get('/members/profile').then(r => setMyProfile(r.data)).catch(() => {})
    api.get('/scores/my-pending').then(r => setMyPending(r.data)).catch(() => {})
  }, [isMember])

  const submitScore = async (categoryId: string) => {
    if (!myProfile?.id || submitting) return
    setSubmitting(categoryId)
    try {
      await api.post(`/scores/member/${myProfile.id}/self-report`, {
        categoryId,
        date: new Date().toISOString(),
        note: ''
      })
      setSubmitMsg(m => ({ ...m, [categoryId]: '✓ تم إرسال الطلب للمراجعة' }))
      const r = await api.get('/scores/my-pending')
      setMyPending(r.data)
    } catch (err: any) {
      setSubmitMsg(m => ({ ...m, [categoryId]: err?.response?.data?.message || 'حدث خطأ' }))
    }
    setSubmitting(null)
  }

  return (
    <div>
      <Header />
      <div className="container">
        <div style={{ padding: '40px 20px' }}>
          <h1 style={{ marginBottom: '10px', fontSize: '32px', color: '#1a1a1a' }}>
            {t('dashboard.welcome')}
          </h1>
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
            {t('dashboard.subtitle')}
          </p>

          {/* Overdue tasks alert */}
          {overdueCount !== null && overdueCount > 0 && (
            <Link to="/tasks" style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '0.75rem 1.25rem', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#dc2626',
              }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <span style={{ fontWeight: 600 }}>لديك {overdueCount} {overdueCount === 1 ? 'مهمة متأخرة' : 'مهام متأخرة'}</span>
                <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>— اضغط للعرض</span>
              </div>
            </Link>
          )}

          {/* Compact Navigation Icons */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '30px',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {/* Families Icon */}
            <Link to="/families" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '24px' }}>👨‍👩‍👧‍👦</div>
                <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.families')}</span>
              </div>
            </Link>

            {/* Visits Icon */}
            <Link to="/visits" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '24px' }}>🏠</div>
                <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.visits')}</span>
              </div>
            </Link>

            {/* Classes Icon */}
            <Link to="/classes" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '24px' }}>📚</div>
                <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.classes')}</span>
              </div>
            </Link>

            {/* Attendance Icon */}
            <Link to="/attendance" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '24px' }}>✅</div>
                <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.attendance')}</span>
              </div>
            </Link>

            {/* Reports Icon */}
            <Link to="/reports" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '24px' }}>📊</div>
                <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>Reports</span>
              </div>
            </Link>

            {/* Groups Icon - Only for SuperAdmin and ServiceLeader */}
            {canManageGroups && (
              <Link to="/groups" style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '24px' }}>👥</div>
                  <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.groups')}</span>
                </div>
              </Link>
            )}

            {/* Areas Icon - Only for SuperAdmin */}
            {isSuperAdmin && (
              <Link to="/areas" style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '24px' }}>📍</div>
                  <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.areas')}</span>
                </div>
              </Link>
            )}

            {/* Users Icon - Only for SuperAdmin */}
            {isSuperAdmin && (
              <Link to="/users" style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '24px' }}>👤</div>
                  <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.users')}</span>
                </div>
              </Link>
            )}

            {/* Audit Icon - Only for SuperAdmin */}
            {isSuperAdmin && (
              <Link to="/audit" style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7c3aed'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124,58,237,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '24px' }}>🔍</div>
                  <span style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>{t('nav.audit')}</span>
                </div>
              </Link>
            )}
          </div>

          {/* My Scores — Member only */}
          {isMember && myCategories.length > 0 && (
            <div style={{ maxWidth: 600, margin: '0 auto 24px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#1e1b4b' }}>درجاتي — سجّل إنجازاتك اليوم</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myCategories.map(cat => {
                  const msg = submitMsg[cat.id]
                  const alreadySubmitted = msg?.startsWith('✓') || myPending.some((p: any) => p.categoryId === cat.id && p.status === 'Pending' && new Date(p.date).toDateString() === new Date().toDateString())
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: alreadySubmitted ? '#f0fdf4' : '#f8fafc', borderRadius: 10, border: `1px solid ${alreadySubmitted ? '#86efac' : '#e5e7eb'}` }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.name}</div>
                        {cat.description && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{cat.description}</div>}
                        {msg && <div style={{ fontSize: '0.78rem', color: alreadySubmitted ? '#166534' : '#dc2626', marginTop: 2 }}>{msg}</div>}
                      </div>
                      {!alreadySubmitted && (
                        <button
                          onClick={() => submitScore(cat.id)}
                          disabled={submitting === cat.id}
                          style={{ padding: '6px 14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: submitting === cat.id ? 0.6 : 1 }}
                        >
                          {submitting === cat.id ? '...' : '✓ تم'}
                        </button>
                      )}
                      {alreadySubmitted && <span style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>✓ مُرسَل</span>}
                    </div>
                  )
                })}
              </div>
              {myPending.length > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>آخر الطلبات</div>
                  {myPending.slice(0, 5).map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '4px 0', borderBottom: '1px solid #f9fafb' }}>
                      <span>{p.categoryName} — {new Date(p.date).toLocaleDateString('ar-EG')}</span>
                      <span style={{ fontWeight: 600, color: p.status === 'Approved' ? '#16a34a' : p.status === 'Rejected' ? '#dc2626' : '#d97706' }}>
                        {p.status === 'Approved' ? '✓ مقبول' : p.status === 'Rejected' ? '✗ مرفوض' : 'معلق'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Bar */}
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            marginBottom: '30px'
          }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  fontSize: '16px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              {isSearching && (
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#666'
                }}>
                  {t('search.searching')}
                </div>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div style={{
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              {hasSearchResults ? (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  {/* Families Results */}
                  {searchResults.families.length > 0 && (
                    <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                      <h3 style={{
                        margin: '0 0 15px 0',
                        fontSize: '18px',
                        color: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        👨‍👩‍👧‍👦 {t('nav.families')} ({searchResults.families.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {searchResults.families.map(family => (
                          <Link
                            key={family.id}
                            to={`/families/${family.id}`}
                            style={{
                              textDecoration: 'none',
                              padding: '12px 16px',
                              backgroundColor: '#f9fafb',
                              borderRadius: '8px',
                              transition: 'all 0.2s',
                              border: '1px solid transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6'
                              e.currentTarget.style.borderColor = '#3b82f6'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb'
                              e.currentTarget.style.borderColor = 'transparent'
                            }}
                          >
                            <div style={{
                              fontSize: '16px',
                              fontWeight: 500,
                              color: '#1a1a1a',
                              marginBottom: '4px'
                            }}>
                              {family.familyName}
                            </div>
                            {family.address && (
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                📍 {family.address}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                      <Link
                        to={`/families?q=${encodeURIComponent(searchQuery)}`}
                        style={{
                          display: 'inline-block',
                          marginTop: '12px',
                          color: '#3b82f6',
                          fontSize: '14px',
                          textDecoration: 'none',
                          fontWeight: 500
                        }}
                      >
                        {t('search.allFamilies')}
                      </Link>
                    </div>
                  )}

                  {/* Members Results */}
                  {searchResults.members.length > 0 && (
                    <div style={{ padding: '20px' }}>
                      <h3 style={{
                        margin: '0 0 15px 0',
                        fontSize: '18px',
                        color: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        👤 {t('search.members')} ({searchResults.members.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {searchResults.members.map(member => (
                          <Link
                            key={member.id}
                            to={member.familyId ? `/families/${member.familyId}` : `/members/${member.id}`}
                            style={{
                              textDecoration: 'none',
                              padding: '12px 16px',
                              backgroundColor: '#f9fafb',
                              borderRadius: '8px',
                              transition: 'all 0.2s',
                              border: '1px solid transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6'
                              e.currentTarget.style.borderColor = '#3b82f6'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#f9fafb'
                              e.currentTarget.style.borderColor = 'transparent'
                            }}
                          >
                            <div style={{
                              fontSize: '16px',
                              fontWeight: 500,
                              color: '#1a1a1a',
                              marginBottom: '4px'
                            }}>
                              {member.fullName}
                            </div>
                            {member.familyName && (
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                {t('families.title')}: {member.familyName}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : !isSearching && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#666'
                }}>
                  {t('search.noResults', { q: searchQuery })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
