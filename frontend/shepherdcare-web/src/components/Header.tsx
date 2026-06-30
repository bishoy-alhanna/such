import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
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
  const { t, lang, setLang } = useT()
  const [collapsed, setCollapsed] = useState(false)

  const w = collapsed ? SIDEBAR_MINI : SIDEBAR_FULL

  // Push page content right via a CSS variable so pages need zero changes
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`)
    return () => { document.documentElement.style.setProperty('--sidebar-w', '0px') }
  }, [w])

  const logout = () => { auth.logout(); nav('/login') }

  const is = (role: string) => auth.hasRole(role)
  const isAdmin    = is('SuperAdmin')
  const isLeader   = is('ServiceLeader')
  const isPriest   = is('Priest') || is('SeniorPriest')
  const isServant  = is('Servant')
  const isDataEntry = is('DataEntry')

  const groups: NavGroup[] = [
    {
      label: t('nav.main'),
      items: [
        { to: '/',         label: t('nav.dashboard'),  icon: '⊞' },
        { to: '/families', label: t('nav.families'),   icon: '🏠' },
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
        { to: '/users', label: t('nav.users'),  icon: '👤' },
        { to: '/areas', label: t('nav.areas'),  icon: '🗺'  },
        { to: '/audit', label: t('nav.audit'),  icon: '📋' },
      ],
    }] : []),
  ]

  return (
    <aside className="sidebar" style={{ width: w }}>

      {/* Logo */}
      <div className="sidebar-logo">
        {!collapsed && (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>ShepherdCare</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>رعاية</div>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? t('nav.expand') : t('nav.collapse')}
          style={{ marginInlineStart: collapsed ? 'auto' : undefined }}
        >
          {collapsed
            ? (lang === 'ar' ? '‹' : '›')
            : (lang === 'ar' ? '›' : '‹')}
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
  )
}
