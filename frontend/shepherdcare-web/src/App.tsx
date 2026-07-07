import React, { Component, useState } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import ChurchSetup from './pages/ChurchSetup'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App error:', error, info) }
  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1a4e', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%' }}>
            <h2 style={{ color: '#dc2626', marginBottom: 12 }}>Something went wrong</h2>
            <pre style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {(error as Error).message}
            </pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import LoginPage from './pages/Login'
import SignupPage from './pages/Signup'
import Dashboard from './pages/Dashboard'
import FamiliesPage from './pages/Families'
import FamilyPage from './pages/Family'
import UsersPage from './pages/Users'
import VisitsPage from './pages/Visits'
import ClassesPage from './pages/Classes'
import AttendancePage from './pages/Attendance'
import ReportsPage from './pages/Reports'
import AreasPage from './pages/Areas'
import GroupsPage from './pages/Groups'
import ClassDetailPage from './pages/ClassDetail'
import AuditPage from './pages/Audit'
import MemberProfilePage from './pages/MemberProfile'
import MembersPage from './pages/Members'
import LeaderboardPage from './pages/Leaderboard'
import SpiritualRecordsPage from './pages/SpiritualRecords'
import MapPage from './pages/Map'
import ScoreCategoriesPage from './pages/ScoreCategories'
import ScoresPage from './pages/Scores'
import ProfilePage from './pages/Profile'
import EventsPage from './pages/Events'
import FollowUpTasksPage from './pages/FollowUpTasks'
import CheckInPage from './pages/CheckIn'
import GivingPage from './pages/Giving'
import VolunteerPage from './pages/Volunteer'
import ApprovalsPage from './pages/Approvals'
import ChurchesPage from './pages/Churches'
import RegisterChurchPage from './pages/RegisterChurch'
import SubscriptionPage from './pages/Subscription'
import ChurchQRPage from './pages/ChurchQR'
import SubscriptionBanner from './components/SubscriptionBanner'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" />
  return children
}

function ChurchRoute({ children }: { children: JSX.Element }) {
  const { token, hasRole } = useAuth()
  if (!token) return <Navigate to="/login" />
  if (hasRole('SystemAdmin')) return <Navigate to="/churches" replace />
  return children
}

function AppContent() {
  const { hasRole } = useAuth()
  const [churchReady, setChurchReady] = useState(
    // SystemAdmin has no church; everyone else must set one first
    () => hasRole('SystemAdmin') || !!localStorage.getItem('churchSlug')
  )

  if (!churchReady) {
    return <ChurchSetup onSetup={() => setChurchReady(true)} />
  }

  return (
    <>
      <SubscriptionBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<ChurchRoute><Dashboard /></ChurchRoute>} />
        <Route path="/families" element={<PrivateRoute><FamiliesPage /></PrivateRoute>} />
        <Route path="/families/:id" element={<PrivateRoute><FamilyPage /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
        <Route path="/visits" element={<PrivateRoute><VisitsPage /></PrivateRoute>} />
        <Route path="/classes" element={<PrivateRoute><ClassesPage /></PrivateRoute>} />
        <Route path="/attendance" element={<PrivateRoute><AttendancePage /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="/areas" element={<PrivateRoute><AreasPage /></PrivateRoute>} />
        <Route path="/groups" element={<PrivateRoute><GroupsPage /></PrivateRoute>} />
        <Route path="/classes/:id" element={<PrivateRoute><ClassDetailPage /></PrivateRoute>} />
        <Route path="/audit" element={<PrivateRoute><AuditPage /></PrivateRoute>} />
        <Route path="/members" element={<PrivateRoute><MembersPage /></PrivateRoute>} />
        <Route path="/members/:id" element={<PrivateRoute><MemberProfilePage /></PrivateRoute>} />
        <Route path="/spiritual-records" element={<PrivateRoute><SpiritualRecordsPage /></PrivateRoute>} />
        <Route path="/map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
        <Route path="/score-categories" element={<PrivateRoute><ScoreCategoriesPage /></PrivateRoute>} />
        <Route path="/scores" element={<PrivateRoute><ScoresPage /></PrivateRoute>} />
        <Route path="/leaderboard" element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
        <Route path="/tasks" element={<PrivateRoute><FollowUpTasksPage /></PrivateRoute>} />
        <Route path="/checkin" element={<PrivateRoute><CheckInPage /></PrivateRoute>} />
        <Route path="/giving" element={<PrivateRoute><GivingPage /></PrivateRoute>} />
        <Route path="/volunteer" element={<PrivateRoute><VolunteerPage /></PrivateRoute>} />
        <Route path="/approvals" element={<PrivateRoute><ApprovalsPage /></PrivateRoute>} />
        <Route path="/churches" element={<PrivateRoute><ChurchesPage /></PrivateRoute>} />
        <Route path="/subscription" element={<PrivateRoute><SubscriptionPage /></PrivateRoute>} />
        <Route path="/church-qr" element={<PrivateRoute><ChurchQRPage /></PrivateRoute>} />
        <Route path="/register-church" element={<RegisterChurchPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
