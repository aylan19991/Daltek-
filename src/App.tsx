import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from '@/lib/auth'
import { Navigation } from '@/components/Navigation'
import { HomePage } from '@/pages/HomePage'
import { TakeTicketPage } from '@/pages/TakeTicketPage'
import { ManagementPage } from '@/pages/ManagementPage'
import { DisplayScreenPage } from '@/pages/DisplayScreenPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Navigation />
      <main className="px-4 py-6 pb-24 lg:ml-64 lg:px-8 lg:py-8 lg:pb-8">
        <Outlet />
      </main>
    </div>
  )
}

function DisplayLayout() {
  return <DisplayScreenPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Full-screen display — no nav */}
          <Route path="/affichage" element={<DisplayLayout />} />

          {/* Standard pages with navigation */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/ticket" element={<TakeTicketPage />} />
            <Route path="/gestion" element={<ManagementPage />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/parametres" element={<SettingsPage />} />
          </Route>

          {/* Auth pages — no nav */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Fallback */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
