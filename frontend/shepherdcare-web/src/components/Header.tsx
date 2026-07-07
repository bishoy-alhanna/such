import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useT } from '../i18n'
import NotificationBell from './NotificationBell'

interface NavItem  { to: string; label: string; icon: string }
interface NavGroup { label: string; items: NavItem[] }

const SIDEBAR_FULL = 230
const SIDEBAR_MINI = 56

export default function Header() {
  const auth = useAuth()
  const nav  = useNavigate()
  const location = useLocation()
  const { t, lang, setLang } = useT()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarW = collapsed ? SIDEBAR_MINI : SIDEBAR_FULL

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close drawer on navigation
  useEffect(() => {
    if (isMobile) setMobileOpen(false)
  }, [location.pathname])

  // Push page content right via a CSS variable so pages need zero changes
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', isMobile ? '0px' : `${sidebarW}px`)
    return () => { document.documentElement.style.setProperty('--sidebar-w', '0px') }
  }, [sidebarW, isMobile])

  const logout = () => { auth.logout(); nav('/login') }

  const is = (role: string) => auth.hasRole(role)
  const isSysAdmin  = is('SystemAdmin')
  const isAdmin     = is('SuperAdmin')
  const isLeader    = is('ServiceLeader')
  const isPriest    = is('Priest') || is('SeniorPriest')
  const isServant   = is('Servant')
  const isDataEntry = is('DataEntry')

  // SystemAdmin sees only the platform churches page — nothing church-specific
  const groups: NavGroup[] = isSysAdmin ? [
    {
      label: 'Platform',
      items: [
        { to: '/churches', label: t('nav.churches'), icon: '⛪' },
      ],
    },
  ] : [
    {
      label: t('nav.main'),
      items: [
        { to: '/',         label: t('nav.dashboard'),  icon: '⊞' },
        { to: '/families', label: t('nav.families'),   icon: '🏠' },
        { to: '/members',  label: 'Members',            icon: '👤' },
      ],
    },
    ...(isAdmin || isLeader || isPriest || isServant || isDataEntry ? [{
      label: t('nav.ministry'),
      items: [
        { to: '/classes',            label: t('nav.classes'),           icon: '📚' },
        ...(isAdmin || isLeader   ? [{ to: '/groups',            label: t('nav.groups'),            icon: '👥' }] : []),
        { to: '/attendance',         label: t('nav.attendance'),        icon: '✓'  },
        { to: '/spiritual-records',  label: t('nav.spiritualRecords'), icon: '✝'  },
        ...(isAdmin || isLeader || isServant || isDataEntry
          ? [{ to: '/scores',          label: t('nav.scores'),            icon: '★'  }] : []),
        { to: '/leaderboard',        label: 'Leaderboard',              icon: '🏆' },
        ...(isAdmin || isLeader
          ? [{ to: '/score-categories', label: t('nav.scoreCategories'), icon: '⊟' }] : []),
      ],
    }] : []),
    ...(isAdmin || isPriest || isLeader || isServant ? [{
      label: t('nav.pastoral'),
      items: [
        { to: '/visits',    label: t('nav.visits'),    icon: '🚗' },
        { to: '/events',    label: t('nav.events'),    icon: '📅' },
        { to: '/tasks',     label: t('nav.tasks'),     icon: '✅' },
        { to: '/checkin',   label: t('nav.checkin'),   icon: '🚪' },
        { to: '/volunteer', label: t('nav.volunteer'), icon: '🙋' },
        { to: '/map',       label: t('nav.map'),       icon: '📍' },
      ],
    }] : []),
    ...(isAdmin || isPriest ? [{
      label: t('nav.stewardship'),
      items: [
        { to: '/giving',    label: t('nav.giving'),    icon: '💰' },
        { to: '/approvals', label: t('nav.approvals'), icon: '✅' },
      ],
    }] : []),
    ...(!isAdmin && !isPriest && (isServant || isLeader || isDataEntry) ? [{
      label: t('nav.stewardship'),
      items: [
        { to: '/approvals', label: t('nav.approvals'), icon: '✅' },
      ],
    }] : []),
    ...(isAdmin ? [{
      label: t('nav.admin'),
      items: [
        { to: '/users',        label: t('nav.users'),        icon: '👤' },
        { to: '/areas',        label: t('nav.areas'),        icon: '🗺'  },
        { to: '/audit',        label: t('nav.audit'),        icon: '📋' },
        { to: '/subscription', label: t('nav.subscription'), icon: '💳' },
        { to: '/church-qr',   label: 'Church QR',            icon: '📲' },
      ],
    }] : []),
  ]

  return (
    <>
      {/* Mobile hamburger — only shown when drawer is closed */}
      {isMobile && !mobileOpen && (
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>☰</button>
      )}

      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

    <aside
      className={`sidebar${isMobile && mobileOpen ? ' mobile-open' : ''}`}
      style={{ width: isMobile ? SIDEBAR_FULL : sidebarW }}
    >

      {/* Logo */}
      <div className="sidebar-logo">
        {(!collapsed || isMobile) && (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>ShepherdCare</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>رعاية</div>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(c => !c)}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
          style={{ marginInlineStart: collapsed && !isMobile ? 'auto' : undefined }}
        >
          {isMobile ? '✕' : (collapsed
            ? (lang === 'ar' ? '‹' : '›')
            : (lang === 'ar' ? '›' : '‹'))}
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {groups.map(group => (
          <div key={group.label} className="sidebar-group">
            {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {!collapsed && <span className="sidebar-label">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          title={collapsed ? (auth.user?.displayName || auth.user?.username) : undefined}
        >
          <span className="sidebar-icon">◉</span>
          {!collapsed && (
            <span className="sidebar-label" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {auth.user?.displayName || auth.user?.username}
            </span>
          )}
        </NavLink>
        <NotificationBell collapsed={collapsed} />
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="sidebar-logout" title="Toggle language">
          🌐 {!collapsed && (lang === 'ar' ? 'EN' : 'ع')}
        </button>
        <button className="sidebar-logout" onClick={logout} title={t('nav.logout')}>
          <span className="sidebar-icon">⏻</span>
          {!collapsed && <span>{t('nav.logout')}</span>}
        </button>
      </div>
    </aside>
    </>
  )
}
