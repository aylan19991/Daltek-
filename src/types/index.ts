export type TicketStatus = 'waiting' | 'called' | 'served' | 'cancelled' | 'recalled'
export type UserRole = 'admin' | 'agent' | 'user' | 'screen'
export type DisplayTheme = 'dark' | 'light'

export interface Establishment {
  id: string
  name: string
  starting_number: number
  max_tickets: number
  sound_enabled: boolean
  display_theme: DisplayTheme
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  role: UserRole
  display_name: string | null
  establishment_id: string | null
  created_at: string
}

export interface Ticket {
  id: string
  number: number
  establishment_id: string
  status: TicketStatus
  category: string | null
  counter: string | null
  called_by: string | null
  called_at: string | null
  served_at: string | null
  created_at: string
  updated_at: string
}

export interface CurrentCall {
  id: string
  establishment_id: string
  ticket_id: string | null
  ticket_number: number | null
  counter: string | null
  called_by: string | null
  called_at: string
  updated_at: string
}

export interface Setting {
  id: string
  establishment_id: string
  key: string
  value: string
  updated_at: string
}

export interface TicketHistoryEntry {
  id: string
  ticket_id: string | null
  ticket_number: number
  establishment_id: string
  action: 'created' | 'called' | 'recalled' | 'served' | 'cancelled' | 'reset'
  performed_by: string | null
  counter: string | null
  created_at: string
}

export interface QueueState {
  current_ticket_number: number | null
  current_counter: string | null
  current_called_at: string | null
  waiting_count: number
  next_waiting_number: number | null
}

export interface TakeTicketResult {
  ticket_id: string
  ticket_number: number
  establishment_id: string
  establishment_name: string
}
