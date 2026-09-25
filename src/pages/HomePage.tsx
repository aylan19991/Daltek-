import { Link } from 'react-router-dom'
import { Ticket, LayoutDashboard, Monitor, History, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useQueue } from '@/lib/useQueue'
import { CurrentNumberDisplay } from '@/components/CurrentNumberDisplay'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function HomePage() {
  const { currentCall, establishment, loading, connected } = useQueue()

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo size={64} showText={false} />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">
          DALTEK
        </h1>
        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
          Système numérique de gestion de files d'attente
        </p>
        <div className="mt-4 flex justify-center">
          <ConnectionStatus connected={connected} />
        </div>
      </div>

      {/* Current number */}
      {loading ? (
        <LoadingSpinner label="Chargement de l'état du système..." className="py-20" />
      ) : (
        <CurrentNumberDisplay
          currentCall={currentCall}
          establishmentName={establishment?.name}
          size="large"
          className="mb-8"
        />
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/ticket"
          className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-daltek-400 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-daltek-500"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-daltek-50 text-daltek-600 dark:bg-daltek-500/10 dark:text-daltek-400">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">
              Prendre un ticket
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Obtenez votre numéro dans la file
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          to="/gestion"
          className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-daltek-400 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-daltek-500"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-500">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">
              Gestion
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Interface agent et administrateur
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          to="/affichage"
          className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-daltek-400 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-daltek-500"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">
              Écran d'affichage
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Affichage plein écran pour téléviseur
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          to="/historique"
          className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-daltek-400 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-daltek-500"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">
              Historique
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Consultez l'historique des tickets
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  )
}
