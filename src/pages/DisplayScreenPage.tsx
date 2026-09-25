import { useEffect, useState } from 'react'
import { Monitor, Clock } from 'lucide-react'
import { useQueue } from '@/lib/useQueue'
import { Logo } from '@/components/Logo'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export function DisplayScreenPage() {
  const { currentCall, waitingTickets, establishment, loading, connected } = useQueue()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const nextTicket = waitingTickets[0]

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <LoadingSpinner size="lg" label="Chargement de l'écran d'affichage..." />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-6">
        <Logo size={48} className="[&_span]:text-white" />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-neutral-300">
            <Monitor className="h-5 w-5" />
            <span className="text-sm font-medium">Écran d'affichage</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-2xl font-medium">
            <Clock className="h-5 w-5 text-neutral-400" />
            {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
            connected ? 'bg-success-500/20 text-success-500' : 'bg-error-500/20 text-error-500'
          }`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-success-500' : 'bg-error-500'}`} />
            {connected ? 'Connecté' : 'Hors ligne'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="mb-4 font-display text-3xl font-medium uppercase tracking-[0.3em] text-neutral-500">
            {establishment?.name || 'Daltek'}
          </p>
          <p className="mb-6 font-display text-4xl font-medium uppercase tracking-widest text-neutral-400">
            Numéro appelé
          </p>
          {currentCall?.ticket_number != null ? (
            <p
              key={currentCall.ticket_number}
              className="animate-number-pop font-display text-[16rem] font-bold leading-none text-daltek-400 sm:text-[20rem] lg:text-[28rem]"
            >
              {currentCall.ticket_number}
            </p>
          ) : (
            <p className="font-display text-[16rem] font-bold leading-none text-neutral-800 sm:text-[20rem] lg:text-[28rem]">
              —
            </p>
          )}
          {currentCall?.counter && (
            <p className="mt-6 font-display text-5xl font-medium text-accent-500">
              Guichet {currentCall.counter}
            </p>
          )}
        </div>
      </div>

      {/* Bottom bar — next tickets */}
      <div className="border-t border-white/10 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-neutral-500">
              Prochain numéro
            </p>
            {nextTicket ? (
              <p className="font-display text-5xl font-bold text-white">{nextTicket.number}</p>
            ) : (
              <p className="font-display text-5xl font-bold text-neutral-700">Aucun</p>
            )}
          </div>
          <div className="text-right">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-neutral-500">
              En attente
            </p>
            <p className="font-display text-5xl font-bold text-white">{waitingTickets.length}</p>
          </div>
          <div className="flex gap-2">
            {waitingTickets.slice(0, 5).map((ticket) => (
              <div
                key={ticket.id}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-display text-2xl font-bold text-neutral-300"
              >
                {ticket.number}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
