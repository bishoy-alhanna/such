import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
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

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
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
        <Route path="/members/:id" element={<PrivateRoute><MemberProfilePage /></PrivateRoute>} />
        <Route path="/spiritual-records" element={<PrivateRoute><SpiritualRecordsPage /></PrivateRoute>} />
        <Route path="/map" element={<PrivateRoute><MapPage /></PrivateRoute>} />
        <Route path="/score-categories" element={<PrivateRoute><ScoreCategoriesPage /></PrivateRoute>} />
        <Route path="/scores" element={<PrivateRoute><ScoresPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
        <Route path="/tasks" element={<PrivateRoute><FollowUpTasksPage /></PrivateRoute>} />
        <Route path="/checkin" element={<PrivateRoute><CheckInPage /></PrivateRoute>} />
        <Route path="/giving" element={<PrivateRoute><GivingPage /></PrivateRoute>} />
        <Route path="/volunteer" element={<PrivateRoute><VolunteerPage /></PrivateRoute>} />
        <Route path="/approvals" element={<PrivateRoute><ApprovalsPage /></PrivateRoute>} />
      </Routes>
    </AuthProvider>
  )
}
