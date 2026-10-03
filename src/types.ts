export type TabType =
  | 'accueil'
  | 'connexion-etablissement'
  | 'console-personnel'
  | 'affichage-ecran-tv'
  | 'suivi-client-mobile'
  | 'administration-centrale'
  | 'installer-daltek';

export interface Establishment {
  id: string; // e.g. '#BPH-7501'
  code: string; // e.g. 'BPH-7501'
  staffCode?: string; // Code for staff login
  slug: string;
  name: string;
  location?: string;
  contract?: string;
  counters?: number;
  counterLabel?: string;
  operators?: number;
  activeQueueCount: number;
  lastCallText: string;
  icon: string;
  logoUrl?: string;
  isContractActive: boolean;
}

export interface QueueTicket {
  id: number;
  time: string;
  wait: string;
  type: string;
  desk: string;
  arrivedAt: string;
  calledAt?: string;
  note?: string;
}

export interface OperatorAccount {
  id: string;
  staffCode?: string;
  name: string;
  initials: string;
  assignedDesk: string;
  subLocation?: string;
  status: 'online' | 'paused' | 'offline';
  establishmentId: string;
  role?: 'staff';
  createdAt?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  category: 'GOUVERNANCE' | 'IDENTITÉ' | 'RÉSEAU' | 'CONFIG' | 'FILE';
  description: string;
  author: string;
  ip: string;
  establishmentId?: string;
  hash?: string;
}

export interface AuthSession {
  role: 'admin' | 'staff' | null;
  operator: OperatorAccount | null;
  establishment: Establishment | null;
}
