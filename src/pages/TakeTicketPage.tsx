import { useState } from 'react'
import { Ticket, Check, AlertCircle } from 'lucide-react'
import { takeTicket } from '@/lib/queueService'
import { useQueue } from '@/lib/useQueue'
import { CurrentNumberDisplay } from '@/components/CurrentNumberDisplay'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import type { TakeTicketResult } from '@/types'

export function TakeTicketPage() {
  const { currentCall, establishment, loading, connected } = useQueue()
  const [result, setResult] = useState<TakeTicketResult | null>(null)
  const [taking, setTaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTakeTicket = async () => {
    setTaking(true)
    setError(null)
    try {
      const res = await takeTicket(establishment?.id)
      setResult(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de prendre un ticket'
      setError(translateError(message))
    } finally {
      setTaking(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-daltek-50 text-daltek-600 dark:bg-daltek-500/10 dark:text-daltek-400">
            <Ticket className="h-8 w-8" />
          </div>
        </div>
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">
          Prendre un ticket
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          {establishment?.name || 'Daltek'} — Obtenez votre numéro dans la file d'attente
        </p>
      </div>

      {/* Current number being called */}
      <CurrentNumberDisplay
        currentCall={currentCall}
        establishmentName={establishment?.name}
        className="mb-6"
      />

      {/* Take ticket action */}
      {error && <ErrorDisplay message={error} className="mb-6" onRetry={() => setError(null)} />}

      {result ? (
        <div className="animate-slide-up rounded-3xl border-2 border-success-200 bg-gradient-to-br from-success-50 to-white p-8 text-center dark:border-success-500/20 dark:from-success-500/10 dark:to-neutral-900">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-500 text-white">
              <Check className="h-8 w-8" />
            </div>
          </div>
          <p className="font-display text-lg font-medium text-neutral-600 dark:text-neutral-400">
            Votre numéro
          </p>
          <p className="my-2 font-display text-8xl font-bold leading-none text-success-600 dark:text-success-500">
            {result.ticket_number}
          </p>
          <p className="text-neutral-500 dark:text-neutral-400">
            Veuillez patienter jusqu'à ce que votre numéro soit appelé
          </p>
          <button
            onClick={() => setResult(null)}
            className="mt-6 rounded-xl border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Prendre un autre ticket
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          {taking ? (
            <LoadingSpinner size="lg" label="Attribution de votre numéro..." />
          ) : (
            <>
              {!connected && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-warning-600 dark:text-warning-500">
                  <AlertCircle className="h-4 w-4" />
                  Connexion instable — votre ticket sera pris dès que possible
                </div>
              )}
              <button
                onClick={handleTakeTicket}
                disabled={loading || taking}
                className="w-full rounded-2xl bg-daltek-600 px-8 py-6 font-display text-xl font-bold text-white shadow-lg transition-all hover:bg-daltek-700 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 sm:w-auto sm:px-16"
              >
                Prendre un numéro
              </button>
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                Le système vous attribuera automatiquement le prochain numéro disponible
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function translateError(message: string): string {
  if (message.includes('maximum')) return 'Le nombre maximum de tickets a été atteint. Veuillez réessayer plus tard.'
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return 'Impossible de se connecter au serveur. Vérifiez votre connexion.'
  return 'Une erreur est survenue. Veuillez réessayer.'
}
