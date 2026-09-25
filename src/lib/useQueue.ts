import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import type { CurrentCall, Ticket, Establishment } from '@/types'

interface QueueData {
  establishment: Establishment | null
  currentCall: CurrentCall | null
  waitingTickets: Ticket[]
  loading: boolean
  error: string | null
  connected: boolean
}

export function useQueue(establishmentId?: string): QueueData {
  const [establishment, setEstablishment] = useState<Establishment | null>(null)
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null)
  const [waitingTickets, setWaitingTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([])

  const loadData = useCallback(async () => {
    try {
      setError(null)

      let estId = establishmentId

      if (!estId) {
        const { data: est, error: estError } = await supabase
          .from('establishments')
          .select('*')
          .order('created_at')
          .limit(1)
          .maybeSingle()

        if (estError) throw estError
        if (est) {
          setEstablishment(est as Establishment)
          estId = est.id
        }
      } else {
        const { data: est, error: estError } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', estId)
          .maybeSingle()
        if (estError) throw estError
        setEstablishment(est as Establishment)
      }

      if (!estId) {
        setLoading(false)
        return
      }

      const [callResult, ticketsResult] = await Promise.all([
        supabase.from('current_calls').select('*').eq('establishment_id', estId).maybeSingle(),
        supabase
          .from('tickets')
          .select('*')
          .eq('establishment_id', estId)
          .eq('status', 'waiting')
          .order('number', { ascending: true }),
      ])

      if (callResult.error) throw callResult.error
      if (ticketsResult.error) throw ticketsResult.error

      setCurrentCall(callResult.data as CurrentCall | null)
      setWaitingTickets(ticketsResult.data as Ticket[])
      setConnected(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion'
      setError(message)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [establishmentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!establishment?.id) return

    const channels: ReturnType<typeof supabase.channel>[] = []

    // Realtime subscription for current_calls
    const callChannel = supabase
      .channel(`current_calls_${establishment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'current_calls',
          filter: `establishment_id=eq.${establishment.id}`,
        },
        (payload) => {
          setConnected(true)
          if (payload.eventType === 'DELETE') {
            setCurrentCall(null)
          } else {
            setCurrentCall(payload.new as CurrentCall)
          }
        }
      )
      .on('system', { event: 'connected' }, () => setConnected(true))
      .on('system', { event: 'disconnected' }, () => setConnected(false))
      .subscribe()

    channels.push(callChannel)

    // Realtime subscription for tickets (waiting queue changes)
    const ticketChannel = supabase
      .channel(`tickets_${establishment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `establishment_id=eq.${establishment.id}`,
        },
        () => {
          // Reload waiting tickets on any ticket change
          supabase
            .from('tickets')
            .select('*')
            .eq('establishment_id', establishment.id)
            .eq('status', 'waiting')
            .order('number', { ascending: true })
            .then(({ data, error }) => {
              if (!error && data) {
                setWaitingTickets(data as Ticket[])
              }
            })
        }
      )
      .subscribe()

    channels.push(ticketChannel)

    channelsRef.current = channels

    return () => {
      channels.forEach((ch) => {
        supabase.removeChannel(ch)
      })
      channelsRef.current = []
    }
  }, [establishment?.id])

  // Connection status monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const channels = channelsRef.current
      if (channels.length > 0) {
        const state = channels[0].state
        if (state === 'closed' || state === 'errored') {
          setConnected(false)
        } else if (state === 'joined') {
          setConnected(true)
        }
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return {
    establishment,
    currentCall,
    waitingTickets,
    loading,
    error,
    connected,
  }
}
