import { supabase } from './supabase'
import type {
  Ticket,
  CurrentCall,
  TicketHistoryEntry,
  Establishment,
  TakeTicketResult,
  QueueState,
} from '@/types'

// Re-export for convenience
export { supabase }

// ============================================================
// Establishment
// ============================================================

export async function getEstablishment(): Promise<Establishment | null> {
  const { data, error } = await supabase
    .from('establishments')
    .select('*')
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as Establishment | null
}

export async function updateEstablishment(
  id: string,
  updates: Partial<Establishment>
): Promise<Establishment> {
  const { data, error } = await supabase
    .from('establishments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Establishment
}

// ============================================================
// Tickets
// ============================================================

export async function getWaitingTickets(establishmentId?: string): Promise<Ticket[]> {
  let query = supabase
    .from('tickets')
    .select('*')
    .eq('status', 'waiting')
    .order('number', { ascending: true })

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Ticket[]
}

export async function getRecentTickets(establishmentId?: string, limit = 20): Promise<Ticket[]> {
  let query = supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Ticket[]
}

// ============================================================
// Current Call
// ============================================================

export async function getCurrentCall(establishmentId?: string): Promise<CurrentCall | null> {
  let query = supabase
    .from('current_calls')
    .select('*')

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId)
  }

  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return data as CurrentCall | null
}

// ============================================================
// Queue State (RPC)
// ============================================================

export async function getQueueState(establishmentId?: string): Promise<QueueState | null> {
  const { data, error } = await supabase
    .rpc('get_queue_state', { p_establishment_id: establishmentId ?? null })
    .maybeSingle()

  if (error) throw error
  return data as QueueState | null
}

// ============================================================
// Actions (RPC functions)
// ============================================================

export async function takeTicket(establishmentId?: string, category?: string): Promise<TakeTicketResult> {
  const { data, error } = await supabase
    .rpc('take_ticket', {
      p_establishment_id: establishmentId ?? null,
      p_category: category ?? null,
    })
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Impossible de prendre un ticket')
  return data as TakeTicketResult
}

export async function callNextTicket(establishmentId?: string, counter?: string): Promise<void> {
  const { error } = await supabase.rpc('call_next_ticket', {
    p_establishment_id: establishmentId ?? null,
    p_counter: counter ?? null,
  })
  if (error) throw error
}

export async function callSpecificTicket(
  ticketNumber: number,
  establishmentId?: string,
  counter?: string
): Promise<void> {
  const { error } = await supabase.rpc('call_specific_ticket', {
    p_ticket_number: ticketNumber,
    p_establishment_id: establishmentId ?? null,
    p_counter: counter ?? null,
  })
  if (error) throw error
}

export async function recallTicket(establishmentId?: string): Promise<void> {
  const { error } = await supabase.rpc('recall_ticket', {
    p_establishment_id: establishmentId ?? null,
  })
  if (error) throw error
}

export async function serveTicket(establishmentId?: string): Promise<void> {
  const { error } = await supabase.rpc('serve_ticket', {
    p_establishment_id: establishmentId ?? null,
  })
  if (error) throw error
}

export async function cancelTicket(ticketNumber: number, establishmentId?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_ticket', {
    p_ticket_number: ticketNumber,
    p_establishment_id: establishmentId ?? null,
  })
  if (error) throw error
}

export async function resetQueue(establishmentId?: string): Promise<void> {
  const { error } = await supabase.rpc('reset_queue', {
    p_establishment_id: establishmentId ?? null,
  })
  if (error) throw error
}

// ============================================================
// History
// ============================================================

export async function getHistory(
  establishmentId?: string,
  filters?: {
    date?: string
    status?: string
    agent?: string
    ticketNumber?: number
  },
  limit = 100
): Promise<TicketHistoryEntry[]> {
  let query = supabase
    .from('ticket_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (establishmentId) {
    query = query.eq('establishment_id', establishmentId)
  }

  if (filters?.date) {
    const start = new Date(filters.date)
    const end = new Date(filters.date)
    end.setDate(end.getDate() + 1)
    query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
  }

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('action', filters.status)
  }

  if (filters?.agent) {
    query = query.eq('performed_by', filters.agent)
  }

  const { data, error } = await query
  if (error) throw error
  return data as TicketHistoryEntry[]
}

// ============================================================
// Profiles
// ============================================================

export async function getProfiles(): Promise<Array<{ id: string; email: string; role: string; display_name: string | null }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, display_name')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function updateProfileRole(profileId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
  if (error) throw error
}
