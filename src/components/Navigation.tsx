import { NavLink, useLocation } from 'react-router-dom'
import { Home, Ticket, LayoutDashboard, Monitor, History, Settings, LogIn, LogOut, UserCircle } from 'lucide-react'
import { Logo } from './Logo'
import { ConnectionStatus } from './ConnectionStatus'
import { useAuth } from '@/lib/auth'
import type { UserRole } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/ticket', label: 'Prendre un ticket', icon: Ticket },
  { to: '/gestion', label: 'Gestion', icon: LayoutDashboard, roles: ['admin', 'agent'] },
  { to: '/affichage', label: 'Écran d\'affichage', icon: Monitor },
  { to: '/historique', label: 'Historique', icon: History },
  { to: '/parametres', label: 'Paramètres', icon: Settings, roles: ['admin', 'agent'] },
]

export function Navigation() {
  const { session, profile, signOut, hasRole } = useAuth()
  const location = useLocation()

  const visibleItems = navItems.filter((item) => {
    if (item.roles && !item.roles.some((r) => hasRole(r))) return false
    return true
  })

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:flex">
        <div className="flex h-16 items-center border-b border-neutral-200 px-6 dark:border-neutral-800">
          <NavLink to="/">
            <Logo size={36} />
          </NavLink>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-daltek-50 text-daltek-700 dark:bg-daltek-500/10 dark:text-daltek-400'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
          <ConnectionStatus connected={true} className="mb-3 w-full justify-center" />
          {session ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                <UserCircle className="h-5 w-5 text-neutral-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900 dark:text-white">
                    {profile?.display_name || profile?.email}
                  </p>
                  <p className="text-xs text-neutral-500">{profile?.role}</p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="flex w-full items-center gap-2 rounded-lg bg-daltek-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-daltek-700"
            >
              <LogIn className="h-4 w-4" />
              Connexion
            </NavLink>
          )}
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
        <div className="flex items-center justify-around px-2 py-1.5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {visibleItems.slice(0, 5).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-daltek-600 dark:text-daltek-400'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-[64px] truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}
