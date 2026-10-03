import QRCode from 'qrcode';
import { Establishment, OperatorAccount, QueueTicket, AuditEvent, AuthSession } from '../types';

const TOKEN_KEY = 'daltek_session_token';
const ROLE_KEY = 'daltek_session_role';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string, role: 'admin' | 'staff'): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erreur serveur (${res.status})`);
  }
  return data as T;
}

// ================= ADMIN & AUTH =================

export async function checkAdminStatus(): Promise<{ isConfigured: boolean }> {
  return request<{ isConfigured: boolean }>('/api/admin/status');
}

export async function setupAdmin(adminCode: string): Promise<{ success: boolean; token: string }> {
  const data = await request<{ success: boolean; token: string }>('/api/admin/setup', {
    method: 'POST',
    body: JSON.stringify({ adminCode }),
  });
  setStoredToken(data.token, 'admin');
  return data;
}

export async function loginAdmin(adminCode: string): Promise<{ success: boolean; token: string }> {
  const data = await request<{ success: boolean; token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ adminCode }),
  });
  setStoredToken(data.token, 'admin');
  return data;
}

export async function changeAdminCode(currentCode: string, newCode: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/admin/change-code', {
    method: 'POST',
    body: JSON.stringify({ currentCode, newCode }),
  });
}

export async function loginStaff(
  staffCode: string
): Promise<{ success: boolean; token: string; operator: OperatorAccount; establishment: Establishment }> {
  const data = await request<{
    success: boolean;
    token: string;
    operator: OperatorAccount;
    establishment: Establishment;
  }>('/api/staff/login', {
    method: 'POST',
    body: JSON.stringify({ staffCode }),
  });
  setStoredToken(data.token, 'staff');
  return data;
}

export async function fetchCurrentSession(): Promise<AuthSession> {
  const token = getStoredToken();
  if (!token) return { role: null, operator: null, establishment: null };
  try {
    const data = await request<{
      authenticated: boolean;
      role: 'admin' | 'staff';
      operator?: OperatorAccount | null;
      establishment?: Establishment | null;
    }>('/api/auth/me');

    if (data.authenticated) {
      return {
        role: data.role,
        operator: data.operator || null,
        establishment: data.establishment || null,
      };
    }
  } catch (err) {
    clearStoredToken();
  }
  return { role: null, operator: null, establishment: null };
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // Ignore error
  }
  clearStoredToken();
}

// ================= ESTABLISHMENTS =================

export async function fetchEstablishments(): Promise<Establishment[]> {
  return request<Establishment[]>('/api/establishments');
}

export async function fetchEstablishmentByCode(idOrCode: string): Promise<Establishment & { queue: QueueTicket[]; operators: OperatorAccount[] }> {
  return request<Establishment & { queue: QueueTicket[]; operators: OperatorAccount[] }>(`/api/establishments/${encodeURIComponent(idOrCode)}`);
}

export async function createEstablishment(payload: Partial<Establishment>): Promise<Establishment> {
  return request<Establishment>('/api/establishments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEstablishment(id: string, payload: Partial<Establishment>): Promise<Establishment> {
  return request<Establishment>(`/api/establishments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteEstablishment(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/establishments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ================= OPERATORS =================

export async function fetchOperators(establishmentId?: string): Promise<OperatorAccount[]> {
  const q = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return request<OperatorAccount[]>(`/api/operators${q}`);
}

export async function createOperator(payload: {
  id?: string;
  name: string;
  staffCode?: string;
  password?: string;
  assignedDesk?: string;
  subLocation?: string;
  establishmentId: string;
}): Promise<OperatorAccount> {
  return request<OperatorAccount>('/api/operators', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOperator(id: string, payload: Partial<OperatorAccount> & { password?: string }): Promise<OperatorAccount> {
  return request<OperatorAccount>(`/api/operators/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOperator(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/operators/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function setOperatorStatus(id: string, status: 'online' | 'paused' | 'offline'): Promise<{ success: boolean; status: string }> {
  return request<{ success: boolean; status: string }>(`/api/operators/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

// ================= QUEUES & TICKETS =================

export async function fetchQueue(establishmentId: string): Promise<{
  queue: QueueTicket[];
  activeCalledTicket: QueueTicket | null;
}> {
  return request<{ queue: QueueTicket[]; activeCalledTicket: QueueTicket | null }>(
    `/api/queue/${encodeURIComponent(establishmentId)}`
  );
}

export async function addTicket(
  establishmentId: string,
  ticketNumber: number,
  type?: string,
  desk?: string,
  note?: string
): Promise<{ ticket: QueueTicket; queue: QueueTicket[] }> {
  return request<{ ticket: QueueTicket; queue: QueueTicket[] }>(
    `/api/queue/${encodeURIComponent(establishmentId)}/add`,
    {
      method: 'POST',
      body: JSON.stringify({ ticketNumber, type, desk, note }),
    }
  );
}

export async function callTicket(
  establishmentId: string,
  ticketId?: number,
  desk?: string
): Promise<{ calledTicket: QueueTicket; queue: QueueTicket[] }> {
  return request<{ calledTicket: QueueTicket; queue: QueueTicket[] }>(
    `/api/queue/${encodeURIComponent(establishmentId)}/call`,
    {
      method: 'POST',
      body: JSON.stringify({ ticketId, desk }),
    }
  );
}

export async function dismissCall(establishmentId: string): Promise<{ success: boolean; queue: QueueTicket[] }> {
  return request<{ success: boolean; queue: QueueTicket[] }>(
    `/api/queue/${encodeURIComponent(establishmentId)}/dismiss`,
    { method: 'POST' }
  );
}

export async function removeTicket(establishmentId: string, ticketId: number): Promise<{ success: boolean; queue: QueueTicket[] }> {
  return request<{ success: boolean; queue: QueueTicket[] }>(
    `/api/queue/${encodeURIComponent(establishmentId)}/ticket/${ticketId}`,
    { method: 'DELETE' }
  );
}

// ================= AUDIT LOGS =================

export async function fetchAuditLogs(establishmentId?: string): Promise<AuditEvent[]> {
  const q = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return request<AuditEvent[]>(`/api/audit${q}`);
}

// ================= CHATBOT (GEMINI) =================

export async function sendChatMessage(message: string, history?: Array<{ role: string; text: string }>): Promise<string> {
  const data = await request<{ reply: string }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
  return data.reply;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 320,
      color: {
        dark: '#0c0e12',
        light: '#f2ca50',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    return '';
  }
}
