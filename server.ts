import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { ensureNativePackagesExist, DOWNLOADS_DIR } from './native-packages.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'DALTEK Core System', timestamp: new Date().toISOString() });
});

// Persistent Data Storage Path
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'daltek-store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helpers for secure password hashing
function hashSecret(secret: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(secret, chosenSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: chosenSalt };
}

function verifySecret(secret: string, storedHash: string, salt: string): boolean {
  const { hash } = hashSecret(secret, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Initial Data Blueprint
interface StoreData {
  admin: {
    isConfigured: boolean;
    passwordHash: string;
    salt: string;
  };
  establishments: Array<{
    id: string; // e.g. '#BPH-7501'
    code: string; // 'BPH-7501'
    staffCode?: string;
    slug: string;
    name: string;
    location: string;
    contract: string;
    counters: number;
    counterLabel: string;
    icon: string;
    logoUrl?: string;
    isContractActive: boolean;
    createdAt: string;
  }>;
  operators: Array<{
    id: string; // username e.g. 'sarah.guichet1'
    staffCode?: string;
    name: string;
    initials: string;
    passwordHash: string;
    salt: string;
    assignedDesk: string;
    subLocation: string;
    status: 'online' | 'paused' | 'offline';
    establishmentId: string;
    role: 'staff';
    createdAt: string;
  }>;
  queues: Record<string, {
    queue: Array<{
      id: number;
      time: string;
      wait: string;
      type: string;
      desk: string;
      arrivedAt: string;
      note?: string;
    }>;
    activeCalledTicket: {
      id: number;
      time: string;
      wait: string;
      type: string;
      desk: string;
      arrivedAt: string;
      calledAt: string;
      note?: string;
    } | null;
  }>;
  auditLogs: Array<{
    id: string;
    timestamp: string;
    category: 'GOUVERNANCE' | 'IDENTITÉ' | 'RÉSEAU' | 'CONFIG' | 'FILE';
    description: string;
    author: string;
    ip: string;
    establishmentId?: string;
    hash?: string;
  }>;
  sessions: Record<string, {
    token: string;
    role: 'admin' | 'staff';
    userId?: string;
    establishmentId?: string;
    createdAt: number;
    expiresAt: number;
  }>;
  ownershipResetCompleted?: boolean;
}

// Load or Seed Data
function loadStore(): StoreData {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const loaded = JSON.parse(content) as StoreData;
      // Retire uniquement le jeu de démonstration intact; toute configuration ou donnée personnalisée est conservée.
      const demoIds = new Set(['#BPH-7501', '#CSH-9204', '#RGE-1022', '#ADM-0042']);
      const demoNames = new Set(['Banque Privée Haussmann', 'Clinique Médicale Saint-Honoré', "Restaurant Gastronomique L'Étoile", 'Guichet Administratif Central']);
      const demoOperators = new Set(['sarah.guichet1', 'alex.guichet2', 'dr.elena']);
      const hasDemoSeed = (loaded.establishments || []).filter((est) => demoIds.has(est.id) && demoNames.has(est.name)).length === 4;
      if (hasDemoSeed) {
        // Remove only the four records and three accounts shipped as sample data.
        loaded.establishments = (loaded.establishments || []).filter((est) => !(demoIds.has(est.id) && demoNames.has(est.name)));
        loaded.operators = (loaded.operators || []).filter((operator) => !demoOperators.has(operator.id));
        loaded.queues = Object.fromEntries(Object.entries(loaded.queues || {}).filter(([id]) => !demoIds.has(id)));
        loaded.sessions = Object.fromEntries(Object.entries(loaded.sessions || {}).filter(([, session]) => !(session.role === 'staff' && demoOperators.has(session.userId || ''))));
        fs.writeFileSync(DATA_FILE, JSON.stringify(loaded, null, 2), 'utf-8');
      }
      if (!loaded.ownershipResetCompleted) {
        const hasTenantData = (loaded.establishments || []).length > 0 ||
          (loaded.operators || []).length > 0 ||
          Object.values(loaded.queues || {}).some((queue) => queue.queue.length > 0 || !!queue.activeCalledTicket);
        if (!hasTenantData && loaded.admin?.isConfigured) {
          // The old master account is orphaned only when no tenant or queue data exists.
          loaded.admin = { isConfigured: false, passwordHash: '', salt: '' };
          loaded.sessions = {};
        }
        loaded.ownershipResetCompleted = true;
        fs.writeFileSync(DATA_FILE, JSON.stringify(loaded, null, 2), 'utf-8');
      }
      return loaded;
    } catch (err) {
      console.error('Failed to parse store file, re-initializing...', err);
    }
  }

  // Initial Seed
  const initialStore: StoreData = {
    admin: {
      isConfigured: false,
      passwordHash: '',
      salt: '',
    },
    establishments: [],
    operators: [],
    // Empty queues for a fresh installation: no hardcoded demo tickets!
    queues: {},
    auditLogs: [
      {
        id: 'audit-001',
        timestamp: 'Système initialisé',
        category: 'GOUVERNANCE',
        description: 'Démarrage du système DALTEK Orchestration Core',
        author: 'system@daltek',
        ip: '127.0.0.1',
      },
    ],
    sessions: {},
    ownershipResetCompleted: true,
  };

  saveStore(initialStore);
  return initialStore;
}

let store: StoreData = loadStore();

function saveStore(data?: StoreData) {
  try {
    const toSave = data || store;
    fs.writeFileSync(DATA_FILE, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write store to disk:', err);
  }
}

// Real-Time SSE Event Broadcasting
interface SSEClient {
  id: string;
  res: express.Response;
  establishmentId: string; // or 'all' for admin
}

const sseClients: SSEClient[] = [];

function broadcastToEstablishment(establishmentId: string, eventType: string, payload: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  const normalizedId = establishmentId.startsWith('#') ? establishmentId : `#${establishmentId}`;

  for (const client of sseClients) {
    if (client.establishmentId === 'all' || client.establishmentId === normalizedId || client.establishmentId === establishmentId) {
      try {
        client.res.write(message);
      } catch (err) {
        console.error('Error writing to SSE client:', err);
      }
    }
  }
}

// Add an audit log entry
function logAudit(
  category: 'GOUVERNANCE' | 'IDENTITÉ' | 'RÉSEAU' | 'CONFIG' | 'FILE',
  description: string,
  author: string,
  ip: string,
  establishmentId?: string
) {
  const now = new Date();
  const timeStr = `${now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const newAudit = {
    id: `audit-${crypto.randomUUID().slice(0, 8)}`,
    timestamp: timeStr,
    category,
    description,
    author,
    ip: ip || '127.0.0.1',
    establishmentId,
  };
  store.auditLogs.unshift(newAudit);
  if (store.auditLogs.length > 200) {
    store.auditLogs.pop();
  }
  saveStore();
  broadcastToEstablishment('all', 'audit_logged', newAudit);
}

// Auth Helper Middlewares
function getAuthSession(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const session = store.sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete store.sessions[token];
    saveStore();
    return null;
  }
  return session;
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getAuthSession(req);
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'Accès non autorisé : Privilèges Administrateur requis' });
    return;
  }
  next();
}

function requireStaffOrAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = getAuthSession(req);
  if (!session) {
    res.status(401).json({ error: 'Session non authentifiée ou expirée' });
    return;
  }
  // Attached to req
  (req as any).userSession = session;
  next();
}

// ==========================================
// 1. ADMIN AUTHENTICATION ENDPOINTS
// ==========================================

// Check if master admin has been configured
app.get('/api/admin/status', (req, res) => {
  res.json({
    isConfigured: store.admin.isConfigured,
  });
});

// Initial Setup of Master Admin Code
app.post('/api/admin/setup', (req, res) => {
  const { adminCode } = req.body;
  if (!adminCode || typeof adminCode !== 'string' || adminCode.trim().length < 4) {
    res.status(400).json({ error: 'Le code administrateur doit contenir au moins 4 caractères' });
    return;
  }

  if (store.admin.isConfigured) {
    res.status(403).json({ error: 'L’administrateur principal est déjà configuré' });
    return;
  }

  const { hash, salt } = hashSecret(adminCode.trim());
  store.admin.passwordHash = hash;
  store.admin.salt = salt;
  store.admin.isConfigured = true;

  // Create admin session
  const token = `daltek_adm_${crypto.randomUUID()}`;
  store.sessions[token] = {
    token,
    role: 'admin',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  logAudit('GOUVERNANCE', 'Initialisation du compte Administrateur Principal', 'root@daltek', req.ip || '127.0.0.1');
  saveStore();

  res.json({
    success: true,
    token,
    message: 'Administrateur principal configuré avec succès',
  });
});

// Admin Login with Code
app.post('/api/admin/login', (req, res) => {
  const { adminCode } = req.body;
  if (!adminCode) {
    res.status(400).json({ error: 'Veuillez saisir votre code administrateur' });
    return;
  }

  if (!store.admin.isConfigured) {
    res.status(400).json({ error: 'Système non configuré. Veuillez effectuer la première configuration.' });
    return;
  }

  const isValid = verifySecret(adminCode.trim(), store.admin.passwordHash, store.admin.salt);
  if (!isValid) {
    logAudit('GOUVERNANCE', 'Tentative de connexion Administrateur échouée (Code invalide)', 'inconnu', req.ip || '127.0.0.1');
    res.status(401).json({ error: 'Code administrateur incorrect' });
    return;
  }

  const token = `daltek_adm_${crypto.randomUUID()}`;
  store.sessions[token] = {
    token,
    role: 'admin',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  logAudit('GOUVERNANCE', 'Connexion réussie Administrateur Principal', 'admin@daltek', req.ip || '127.0.0.1');
  saveStore();

  res.json({
    success: true,
    token,
    role: 'admin',
  });
});

// Change Admin Master Code
app.post('/api/admin/change-code', requireAdmin, (req, res) => {
  const { currentCode, newCode } = req.body;
  if (!newCode || newCode.trim().length < 4) {
    res.status(400).json({ error: 'Le nouveau code doit contenir au moins 4 caractères' });
    return;
  }

  const isCurrentValid = verifySecret(currentCode.trim(), store.admin.passwordHash, store.admin.salt);
  if (!isCurrentValid) {
    res.status(401).json({ error: 'Le code actuel est erroné' });
    return;
  }

  const { hash, salt } = hashSecret(newCode.trim());
  store.admin.passwordHash = hash;
  store.admin.salt = salt;

  logAudit('GOUVERNANCE', 'Modification du Code Administrateur Principal', 'admin@daltek', req.ip || '127.0.0.1');
  saveStore();

  res.json({ success: true, message: 'Code administrateur mis à jour' });
});

// Verify Current Session
app.get('/api/auth/me', (req, res) => {
  const session = getAuthSession(req);
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }

  if (session.role === 'admin') {
    res.json({
      authenticated: true,
      role: 'admin',
    });
    return;
  }

  // Staff session
  const operator = store.operators.find((op) => op.id === session.userId);
  const establishment = store.establishments.find((e) => e.id === session.establishmentId);

  res.json({
    authenticated: true,
    role: 'staff',
    operator: operator
      ? {
          id: operator.id,
          name: operator.name,
          initials: operator.initials,
          assignedDesk: operator.assignedDesk,
          status: operator.status,
          establishmentId: operator.establishmentId,
        }
      : null,
    establishment,
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    delete store.sessions[token];
    saveStore();
  }
  res.json({ success: true });
});

// ==========================================
// 2. STAFF / ÉTABLISSEMENT AUTHENTICATION
// ==========================================

app.post('/api/staff/login', (req, res) => {
  const staffCodeInput = String(req.body.staffCode || req.body.code || '').trim().toUpperCase();

  if (!staffCodeInput && (!req.body.establishmentCode || !req.body.username)) {
    res.status(400).json({ error: 'Veuillez saisir votre Code Staff.' });
    return;
  }

  let operator: any = null;
  let establishment: any = null;

  if (staffCodeInput) {
    // 1. Match operator by staffCode or id
    operator = store.operators.find(
      (op) =>
        (op.staffCode && op.staffCode.toUpperCase() === staffCodeInput) ||
        op.id.toUpperCase() === staffCodeInput
    );

    if (operator) {
      establishment = store.establishments.find((e) => e.id === operator.establishmentId);
    } else {
      // 2. Match establishment by staffCode, code, or clean id
      const cleanInput = staffCodeInput.replace(/^#/, '');
      establishment = store.establishments.find(
        (e) =>
          (e.staffCode && e.staffCode.toUpperCase() === staffCodeInput) ||
          e.code.toUpperCase() === cleanInput ||
          e.id.toUpperCase().replace(/^#/, '') === cleanInput ||
          e.slug.toUpperCase() === cleanInput
      );

      if (establishment) {
        operator = store.operators.find((op) => op.establishmentId === establishment.id);
        if (!operator) {
          operator = {
            id: `staff_${establishment.code.toLowerCase()}`,
            name: `Équipe ${establishment.name}`,
            initials: 'EQ',
            assignedDesk: 'Guichet 1',
            establishmentId: establishment.id,
            status: 'online' as const,
            staffCode: establishment.staffCode || establishment.code,
          };
        }
      }
    }

    if (!establishment || !operator) {
      res.status(401).json({ error: 'Code Staff introuvable ou incorrect.' });
      return;
    }
  } else {
    // Legacy support
    const cleanCode = String(req.body.establishmentCode || '').trim().toUpperCase().replace(/^#/, '');
    establishment = store.establishments.find(
      (e) => e.code.toUpperCase().replace(/^#/, '') === cleanCode || e.id.toUpperCase().replace(/^#/, '') === cleanCode
    );
    if (!establishment) {
      res.status(404).json({ error: 'Établissement introuvable.' });
      return;
    }
    operator = store.operators.find(
      (op) => op.establishmentId === establishment.id && op.id.toLowerCase() === String(req.body.username || '').toLowerCase()
    );
    if (!operator) {
      operator = {
        id: `staff_${establishment.code.toLowerCase()}`,
        name: `Équipe ${establishment.name}`,
        initials: 'EQ',
        assignedDesk: 'Guichet 1',
        establishmentId: establishment.id,
        status: 'online' as const,
        staffCode: establishment.staffCode || establishment.code,
      };
    }
  }

  if (!establishment.isContractActive) {
    res.status(403).json({ error: `L'établissement ${establishment.name} est actuellement inactif ou suspendu.` });
    return;
  }

  // Update operator status to online
  operator.status = 'online';

  const token = `daltek_stf_${crypto.randomUUID()}`;
  store.sessions[token] = {
    token,
    role: 'staff',
    userId: operator.id,
    establishmentId: establishment.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days persistent session
  };

  logAudit(
    'IDENTITÉ',
    `Connexion staff : ${operator.name} sur ${establishment.name}`,
    operator.id,
    req.ip || '127.0.0.1',
    establishment.id
  );
  saveStore();

  res.json({
    success: true,
    token,
    role: 'staff',
    operator: {
      id: operator.id,
      name: operator.name,
      initials: operator.initials,
      assignedDesk: operator.assignedDesk,
      status: operator.status,
      establishmentId: operator.establishmentId,
      staffCode: operator.staffCode || establishment.staffCode || establishment.code,
    },
    establishment,
  });
});

// ==========================================
// 3. ESTABLISHMENTS MANAGEMENT (ADMIN)
// ==========================================

// Get all establishments
app.get('/api/establishments', (req, res) => {
  const result = store.establishments.map((est) => {
    const queueData = store.queues[est.id] || { queue: [], activeCalledTicket: null };
    const opsCount = store.operators.filter((op) => op.establishmentId === est.id).length;
    return {
      ...est,
      activeQueueCount: queueData.queue.length,
      activeCalledTicket: queueData.activeCalledTicket,
      operators: opsCount,
      lastCallText: queueData.activeCalledTicket
        ? `Ticket #${queueData.activeCalledTicket.id} (${queueData.activeCalledTicket.desk})`
        : 'Aucun appel actif',
    };
  });
  res.json(result);
});

// Get single establishment by code or id
app.get('/api/establishments/:idOrCode', (req, res) => {
  const param = req.params.idOrCode.trim().toUpperCase().replace(/^#/, '');
  const est = store.establishments.find(
    (e) =>
      e.id.toUpperCase().replace(/^#/, '') === param ||
      e.code.toUpperCase().replace(/^#/, '') === param ||
      e.slug.toUpperCase() === param
  );

  if (!est) {
    res.status(404).json({ error: 'Établissement introuvable' });
    return;
  }

  const queueData = store.queues[est.id] || { queue: [], activeCalledTicket: null };
  const operators = store.operators
    .filter((op) => op.establishmentId === est.id)
    .map((op) => ({
      id: op.id,
      name: op.name,
      initials: op.initials,
      assignedDesk: op.assignedDesk,
      subLocation: op.subLocation,
      status: op.status,
      establishmentId: op.establishmentId,
      createdAt: op.createdAt,
    }));

  res.json({
    ...est,
    activeQueueCount: queueData.queue.length,
    activeCalledTicket: queueData.activeCalledTicket,
    queue: queueData.queue,
    operators,
  });
});

// Create new establishment (Admin only)
app.post('/api/establishments', requireAdmin, (req, res) => {
  const { name, code, icon, logoUrl, staffCode, location, contract, counters, counterLabel } = req.body;

  if (!name || !code) {
    res.status(400).json({ error: 'Le nom et le code de l’établissement sont obligatoires' });
    return;
  }

  const cleanCode = code.trim().toUpperCase().replace(/^#/, '');
  const id = `#${cleanCode}`;

  // Check unique code
  if (store.establishments.some((e) => e.code.toUpperCase() === cleanCode || e.id === id)) {
    res.status(400).json({ error: `Le code ${cleanCode} est déjà utilisé par un autre établissement` });
    return;
  }

  const newEst = {
    id,
    code: cleanCode,
    staffCode: (staffCode || cleanCode).trim().toUpperCase(),
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20),
    name: name.trim(),
    location: location?.trim() || 'France',
    contract: contract?.trim() || 'CONTRAT DALTEK',
    counters: Number(counters) || 1,
    counterLabel: counterLabel?.trim() || 'Guichets',
    icon: icon || 'apartment',
    logoUrl: logoUrl || undefined,
    isContractActive: true,
    createdAt: new Date().toISOString(),
  };

  store.establishments.push(newEst);
  store.queues[newEst.id] = { queue: [], activeCalledTicket: null };

  // Automatically register default staff operator account with matching staffCode
  const defaultOp = {
    id: `staff_${cleanCode.toLowerCase()}`,
    staffCode: cleanCode,
    name: `Équipe ${newEst.name}`,
    initials: cleanCode.slice(0, 2),
    passwordHash: '',
    salt: '',
    assignedDesk: 'Guichet 1',
    subLocation: '',
    status: 'online' as const,
    establishmentId: newEst.id,
    role: 'staff' as const,
    createdAt: new Date().toISOString(),
  };
  if (!store.operators.some((op) => op.establishmentId === newEst.id)) {
    store.operators.push(defaultOp);
  }

  logAudit(
    'GOUVERNANCE',
    `Création de l'établissement : ${newEst.name} (${newEst.id})`,
    'admin@daltek',
    req.ip || '127.0.0.1',
    newEst.id
  );
  saveStore();

  broadcastToEstablishment('all', 'establishment_created', newEst);

  res.status(201).json(newEst);
});

// Update establishment (Admin only)
app.put('/api/establishments/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const index = store.establishments.findIndex((e) => e.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Établissement introuvable' });
    return;
  }

  const current = store.establishments[index];
  const { name, icon, logoUrl, location, contract, counters, counterLabel, isContractActive, code } = req.body;

  let updatedCode = current.code;
  let updatedId = current.id;

  if (code && code.trim().toUpperCase().replace(/^#/, '') !== current.code) {
    updatedCode = code.trim().toUpperCase().replace(/^#/, '');
    updatedId = `#${updatedCode}`;
    // migrate queue
    if (store.queues[current.id]) {
      store.queues[updatedId] = store.queues[current.id];
      delete store.queues[current.id];
    }
    // migrate operators
    for (const op of store.operators) {
      if (op.establishmentId === current.id) {
        op.establishmentId = updatedId;
      }
    }
  }

  const updatedEst = {
    ...current,
    id: updatedId,
    code: updatedCode,
    name: name !== undefined ? name.trim() : current.name,
    icon: icon !== undefined ? icon : current.icon,
    logoUrl: logoUrl !== undefined ? logoUrl : current.logoUrl,
    location: location !== undefined ? location.trim() : current.location,
    contract: contract !== undefined ? contract.trim() : current.contract,
    counters: counters !== undefined ? Number(counters) : current.counters,
    counterLabel: counterLabel !== undefined ? counterLabel.trim() : current.counterLabel,
    isContractActive: isContractActive !== undefined ? Boolean(isContractActive) : current.isContractActive,
  };

  store.establishments[index] = updatedEst;

  logAudit(
    'CONFIG',
    `Mise à jour des paramètres de l'établissement : ${updatedEst.name}`,
    'admin@daltek',
    req.ip || '127.0.0.1',
    updatedEst.id
  );
  saveStore();

  const broadcastPayload = { ...updatedEst, previousId: current.id };
  broadcastToEstablishment(current.id, 'establishment_updated', broadcastPayload);
  if (updatedEst.id !== current.id) {
    broadcastToEstablishment(updatedEst.id, 'establishment_updated', broadcastPayload);
  }
  broadcastToEstablishment('all', 'establishment_updated', broadcastPayload);

  res.json(updatedEst);
});

// Delete establishment (Admin only) - Fully persistent & cleans all associated data
app.delete('/api/establishments/:id', requireAdmin, (req, res) => {
  const rawId = req.params.id;
  const cleanId = rawId.startsWith('#') ? rawId : `#${rawId}`;
  const unhashedId = rawId.replace(/^#/, '');

  const index = store.establishments.findIndex(
    (e) =>
      e.id === rawId ||
      e.id === cleanId ||
      e.id === unhashedId ||
      e.code.toUpperCase() === unhashedId.toUpperCase() ||
      e.code.toUpperCase() === rawId.toUpperCase()
  );

  if (index === -1) {
    res.status(404).json({ error: 'Établissement introuvable' });
    return;
  }

  const est = store.establishments[index];
  const estId = est.id;
  const estCode = est.code;
  const estUnhashed = est.id.replace(/^#/, '');

  // 1. Remove establishment from persistent store
  store.establishments.splice(index, 1);

  // 2. Remove queues
  delete store.queues[estId];
  delete store.queues[estCode];
  delete store.queues[estUnhashed];

  // 3. Remove operators
  store.operators = store.operators.filter(
    (op) =>
      op.establishmentId !== estId &&
      op.establishmentId !== estCode &&
      op.establishmentId !== estUnhashed
  );

  // 4. Invalidate all staff sessions for this establishment
  for (const token of Object.keys(store.sessions)) {
    const sess = store.sessions[token];
    if (
      sess.establishmentId === estId ||
      sess.establishmentId === estCode ||
      sess.establishmentId === estUnhashed
    ) {
      delete store.sessions[token];
    }
  }

  // 5. Close and terminate associated SSE connections
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    if (
      client.establishmentId === estId ||
      client.establishmentId === estCode ||
      client.establishmentId === estUnhashed
    ) {
      try {
        client.res.write(`event: establishment_deleted\ndata: ${JSON.stringify({ id: estId, code: estCode })}\n\n`);
        client.res.end();
      } catch (e) {}
      sseClients.splice(i, 1);
    }
  }

  // 6. Audit log & disk persist
  logAudit(
    'GOUVERNANCE',
    `Suppression définitive de l'établissement : ${est.name} (${estId})`,
    'admin@daltek',
    req.ip || '127.0.0.1'
  );
  saveStore();

  // 7. Broadcast deletion event to all connected admin and client streams
  broadcastToEstablishment('all', 'establishment_deleted', { id: estId, code: estCode });

  res.json({
    success: true,
    deletedId: estId,
    message: `L'établissement ${est.name} a été supprimé définitivement du système.`,
  });
});

// ==========================================
// 4. OPERATORS / STAFF MANAGEMENT (ADMIN)
// ==========================================

// Get operators (optionally filtered by establishment)
app.get('/api/operators', requireStaffOrAdmin, (req, res) => {
  const session = (req as any).userSession;
  const { establishmentId } = req.query;

  let ops = store.operators;
  if (session.role === 'staff') {
    // Staff can only see operators of their establishment
    ops = ops.filter((op) => op.establishmentId === session.establishmentId);
  } else if (establishmentId) {
    ops = ops.filter((op) => op.establishmentId === establishmentId);
  }

  const sanitized = ops.map((op) => ({
    id: op.id,
    staffCode: op.staffCode || op.id,
    name: op.name,
    initials: op.initials,
    assignedDesk: op.assignedDesk,
    subLocation: op.subLocation,
    status: op.status,
    establishmentId: op.establishmentId,
    role: op.role,
    createdAt: op.createdAt,
  }));

  res.json(sanitized);
});

// Create Operator (Admin only)
app.post('/api/operators', requireAdmin, (req, res) => {
  const { id, name, staffCode, password, assignedDesk, subLocation, establishmentId } = req.body;

  if (!name || !establishmentId) {
    res.status(400).json({ error: 'Le nom et l’établissement rattaché sont requis' });
    return;
  }

  const est = store.establishments.find((e) => e.id === establishmentId || e.code === establishmentId);
  if (!est) {
    res.status(404).json({ error: 'Établissement rattaché introuvable' });
    return;
  }

  const codeStaff = String(staffCode || id || `STF-${crypto.randomUUID().slice(0, 4)}`).trim().toUpperCase();
  const cleanId = String(id || `op_${crypto.randomUUID().slice(0, 8)}`).trim().toLowerCase();

  const pwd = password ? String(password).trim() : codeStaff;
  const { hash, salt } = hashSecret(pwd);
  const initials = name
    .trim()
    .split(' ')
    .map((w: string) => w[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'OP';

  const newOp = {
    id: cleanId,
    staffCode: codeStaff,
    name: name.trim(),
    initials,
    passwordHash: hash,
    salt,
    assignedDesk: assignedDesk?.trim() || 'Guichet 1',
    subLocation: subLocation?.trim() || 'Zone d’accueil',
    status: 'online' as const,
    establishmentId: est.id,
    role: 'staff' as const,
    createdAt: new Date().toISOString(),
  };

  store.operators.push(newOp);

  logAudit(
    'IDENTITÉ',
    `Création du membre personnel ${newOp.name} (Code Staff: ${newOp.staffCode}) pour ${est.name}`,
    'admin@daltek',
    req.ip || '127.0.0.1',
    est.id
  );
  saveStore();

  broadcastToEstablishment(est.id, 'operator_created', {
    id: newOp.id,
    staffCode: newOp.staffCode,
    name: newOp.name,
    initials: newOp.initials,
    assignedDesk: newOp.assignedDesk,
    status: newOp.status,
    establishmentId: newOp.establishmentId,
  });

  res.status(201).json({
    id: newOp.id,
    staffCode: newOp.staffCode,
    name: newOp.name,
    initials: newOp.initials,
    assignedDesk: newOp.assignedDesk,
    status: newOp.status,
    establishmentId: newOp.establishmentId,
  });
});

// Update Operator (Admin only)
app.put('/api/operators/:id', requireAdmin, (req, res) => {
  const id = req.params.id.toLowerCase();
  const operator = store.operators.find((op) => op.id === id);
  if (!operator) {
    res.status(404).json({ error: 'Opérateur introuvable' });
    return;
  }

  const { name, assignedDesk, subLocation, status, password, establishmentId } = req.body;

  if (name) {
    operator.name = name.trim();
    operator.initials = name
      .trim()
      .split(' ')
      .map((w: string) => w[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  }
  if (assignedDesk) operator.assignedDesk = assignedDesk.trim();
  if (subLocation) operator.subLocation = subLocation.trim();
  if (status) operator.status = status;
  if (establishmentId) operator.establishmentId = establishmentId;
  if (password && password.trim().length > 0) {
    const { hash, salt } = hashSecret(password.trim());
    operator.passwordHash = hash;
    operator.salt = salt;
  }

  logAudit(
    'IDENTITÉ',
    `Mise à jour du compte personnel ${operator.id}`,
    'admin@daltek',
    req.ip || '127.0.0.1',
    operator.establishmentId
  );
  saveStore();

  broadcastToEstablishment(operator.establishmentId, 'operator_updated', {
    id: operator.id,
    name: operator.name,
    initials: operator.initials,
    assignedDesk: operator.assignedDesk,
    status: operator.status,
    establishmentId: operator.establishmentId,
  });

  res.json({
    id: operator.id,
    name: operator.name,
    initials: operator.initials,
    assignedDesk: operator.assignedDesk,
    status: operator.status,
    establishmentId: operator.establishmentId,
  });
});

// Delete Operator (Admin only)
app.delete('/api/operators/:id', requireAdmin, (req, res) => {
  const id = req.params.id.toLowerCase();
  const index = store.operators.findIndex((op) => op.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Opérateur introuvable' });
    return;
  }

  const op = store.operators[index];
  store.operators.splice(index, 1);

  logAudit(
    'IDENTITÉ',
    `Suppression du compte personnel ${op.id} (${op.name})`,
    'admin@daltek',
    req.ip || '127.0.0.1',
    op.establishmentId
  );
  saveStore();

  broadcastToEstablishment(op.establishmentId, 'operator_deleted', { id });

  res.json({ success: true, message: 'Opérateur supprimé' });
});

// Toggle Operator Status (Staff or Admin)
app.post('/api/operators/:id/status', requireStaffOrAdmin, (req, res) => {
  const session = (req as any).userSession;
  const id = req.params.id.toLowerCase();
  const op = store.operators.find((o) => o.id === id);

  if (!op) {
    res.status(404).json({ error: 'Opérateur introuvable' });
    return;
  }

  if (session.role === 'staff' && session.userId !== id) {
    res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre statut' });
    return;
  }

  const { status } = req.body;
  if (!['online', 'paused', 'offline'].includes(status)) {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }

  op.status = status;
  saveStore();

  broadcastToEstablishment(op.establishmentId, 'operator_status_changed', { id: op.id, status: op.status });

  res.json({ success: true, status: op.status });
});

// ==========================================
// 5. QUEUE & TICKET ENGINE (STRICT FIFO & REALTIME)
// ==========================================

// Helper: ensure queue object exists
function getOrCreateQueue(establishmentId: string) {
  const cleanId = establishmentId.startsWith('#') ? establishmentId : `#${establishmentId}`;
  if (!store.queues[cleanId]) {
    store.queues[cleanId] = {
      queue: [],
      activeCalledTicket: null,
    };
  }
  return store.queues[cleanId];
}

function authorizeQueueEstablishment(req: express.Request, res: express.Response, establishmentId: string): boolean {
  const cleanId = establishmentId.startsWith('#') ? establishmentId : `#${establishmentId}`;
  const unhashedId = establishmentId.replace(/^#/, '');
  const est = store.establishments.find(
    (e) => e.id === cleanId || e.id === unhashedId || e.code === establishmentId || e.code === unhashedId
  );
  if (!est) {
    res.status(404).json({ error: 'Établissement introuvable' });
    return false;
  }
  const session = getAuthSession(req);
  if (session?.role === 'staff' && session.establishmentId !== est.id) {
    res.status(403).json({ error: 'Non autorisé sur cet établissement' });
    return false;
  }
  return true;
}

// Get active queue for an establishment
app.get('/api/queue/:establishmentId', (req, res) => {
  const estId = req.params.establishmentId;
  const cleanEstId = estId.startsWith('#') ? estId : `#${estId}`;
  if (!authorizeQueueEstablishment(req, res, cleanEstId)) return;
  const qData = getOrCreateQueue(cleanEstId);
  res.json({
    establishmentId: estId,
    queue: qData.queue,
    activeCalledTicket: qData.activeCalledTicket,
  });
});

// Add Ticket (Personnel, TV screen keyboard, Kiosk)
app.post('/api/queue/:establishmentId/add', (req, res) => {
  const session = getAuthSession(req);
  const estId = req.params.establishmentId;
  const cleanEstId = estId.startsWith('#') ? estId : `#${estId}`;

  if (!authorizeQueueEstablishment(req, res, cleanEstId)) return;

  const { ticketNumber, type, desk, note } = req.body;
  const rawTicketNumber = String(ticketNumber ?? '');
  if (!/^\d{1,3}$/.test(rawTicketNumber)) {
    res.status(400).json({ error: 'Le numéro doit contenir de 1 à 3 chiffres' });
    return;
  }
  const num = Number(rawTicketNumber);

  if (num < 1 || num > 999) {
    res.status(400).json({ error: 'Le numéro de ticket doit être compris entre 1 et 999' });
    return;
  }

  const qData = getOrCreateQueue(cleanEstId);

  // Prevent duplicate waiting ticket or currently active called ticket in current queue
  if (qData.queue.some((t) => t.id === num) || qData.activeCalledTicket?.id === num) {
    res.status(400).json({ error: `Le ticket ${num} est déjà dans la file.` });
    return;
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const newTicket = {
    id: num,
    time: timeStr,
    wait: '',
    type: type || 'Guichet Standard',
    desk: desk || 'Desk 01',
    arrivedAt: timeStr,
    note: note || undefined,
  };

  // STRICT ARRIVAL ORDER (FIFO)
  qData.queue.push(newTicket);

  logAudit(
    'FILE',
    `Ajout du Ticket #${num} dans la file (${qData.queue.length} en attente)`,
    session?.userId || 'Borne TV / Guichet',
    req.ip || '127.0.0.1',
    cleanEstId
  );
  saveStore();

  // Broadcast to TV, Staff, and Clients in this establishment
  broadcastToEstablishment(cleanEstId, 'queue_updated', {
    action: 'add',
    ticket: newTicket,
    queue: qData.queue,
    activeCalledTicket: qData.activeCalledTicket,
  });

  res.status(201).json({
    success: true,
    ticket: newTicket,
    queue: qData.queue,
  });
});

// Call Ticket (Next or Specific)
app.post('/api/queue/:establishmentId/call', (req, res) => {
  const session = getAuthSession(req);
  const estId = req.params.establishmentId;
  const cleanEstId = estId.startsWith('#') ? estId : `#${estId}`;

  if (!authorizeQueueEstablishment(req, res, cleanEstId)) return;

  const qData = getOrCreateQueue(cleanEstId);
  const { ticketId, desk } = req.body;

  let ticketToCall: typeof qData.queue[0] | undefined;

  if (ticketId !== undefined) {
    const num = parseInt(ticketId, 10);
    const index = qData.queue.findIndex((t) => t.id === num);
    if (index !== -1) {
      ticketToCall = qData.queue.splice(index, 1)[0];
    } else {
      res.status(404).json({ error: `Ticket #${num} introuvable dans la file d'attente` });
      return;
    }
  } else {
    // Call next in FIFO queue
    if (qData.queue.length === 0) {
      res.status(400).json({ error: 'La file d’attente est vide' });
      return;
    }
    ticketToCall = qData.queue.shift();
  }

  if (!ticketToCall) {
    res.status(400).json({ error: 'Aucun ticket à appeler' });
    return;
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const calledDesk = desk || (session?.role === 'staff' ? (store.operators.find((o) => o.id === session.userId)?.assignedDesk || 'Guichet 1') : 'Guichet 1');

  qData.activeCalledTicket = {
    ...ticketToCall,
    calledAt: timeStr,
    desk: calledDesk,
  };

  logAudit(
    'FILE',
    `Appel du Ticket #${ticketToCall.id} au ${calledDesk}`,
    session?.userId || 'Guichet 1',
    req.ip || '127.0.0.1',
    cleanEstId
  );
  saveStore();

  // Broadcast call immediately! TV rings chime, client gets push/vibrate, staff updates
  broadcastToEstablishment(cleanEstId, 'ticket_called', {
    calledTicket: qData.activeCalledTicket,
    queue: qData.queue,
  });

  res.json({
    success: true,
    calledTicket: qData.activeCalledTicket,
    queue: qData.queue,
  });
});

// Dismiss / Complete Current Called Ticket
app.post('/api/queue/:establishmentId/dismiss', (req, res) => {
  const estId = req.params.establishmentId;
  const cleanEstId = estId.startsWith('#') ? estId : `#${estId}`;
  if (!authorizeQueueEstablishment(req, res, cleanEstId)) return;
  const qData = getOrCreateQueue(cleanEstId);

  const prevCalled = qData.activeCalledTicket;
  qData.activeCalledTicket = null;
  saveStore();

  broadcastToEstablishment(cleanEstId, 'call_dismissed', {
    prevTicket: prevCalled,
    queue: qData.queue,
  });

  res.json({ success: true, queue: qData.queue });
});

// Cancel / Remove a ticket from waiting queue
app.delete('/api/queue/:establishmentId/ticket/:ticketId', (req, res) => {
  const estId = req.params.establishmentId;
  const cleanEstId = estId.startsWith('#') ? estId : `#${estId}`;
  if (!authorizeQueueEstablishment(req, res, cleanEstId)) return;
  const qData = getOrCreateQueue(cleanEstId);
  const num = parseInt(req.params.ticketId, 10);

  const idx = qData.queue.findIndex((t) => t.id === num);
  if (idx === -1) {
    res.status(404).json({ error: 'Ticket introuvable dans la file' });
    return;
  }

  const removed = qData.queue.splice(idx, 1)[0];
  saveStore();

  broadcastToEstablishment(cleanEstId, 'ticket_removed', {
    removedTicket: removed,
    queue: qData.queue,
  });

  res.json({ success: true, queue: qData.queue });
});

// Clear entire queue (Staff/Admin)
app.post('/api/queue/:establishmentId/clear', (req, res) => {
  const estId = req.params.establishmentId;
  const cleanEstId = estId.startsWith('#') ? estId : `#${estId}`;
  if (!authorizeQueueEstablishment(req, res, cleanEstId)) return;
  const qData = getOrCreateQueue(cleanEstId);

  qData.queue = [];
  qData.activeCalledTicket = null;
  saveStore();

  broadcastToEstablishment(cleanEstId, 'queue_cleared', {});
  res.json({ success: true });
});

// ==========================================
// 6. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
// ==========================================

app.get('/api/realtime/stream', (req, res) => {
  const establishmentId = (req.query.establishmentId as string) || 'all';
  const cleanEstId = establishmentId.startsWith('#') ? establishmentId : `#${establishmentId}`;
  if (establishmentId === 'all') {
    const session = getAuthSession(req);
    if (!session || session.role !== 'admin') {
      res.status(403).json({ error: 'Flux global réservé à l’administration' });
      return;
    }
  } else {
    if (!store.establishments.some((est) => est.id === cleanEstId)) {
      res.status(404).json({ error: 'Établissement introuvable' });
      return;
    }
    const session = getAuthSession(req);
    if (session?.role === 'staff' && session.establishmentId !== cleanEstId) {
      res.status(403).json({ error: 'Non autorisé sur cet établissement' });
      return;
    }
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(':connected\n\n');

  // Send Initial Snapshot
  if (cleanEstId !== 'all') {
    const qData = getOrCreateQueue(cleanEstId);
    const est = store.establishments.find((e) => e.id === cleanEstId);
    res.write(
      `event: initial_snapshot\ndata: ${JSON.stringify({
        establishment: est,
        queue: qData.queue,
        activeCalledTicket: qData.activeCalledTicket,
      })}\n\n`
    );
  } else {
    res.write(
      `event: initial_snapshot\ndata: ${JSON.stringify({
        establishments: store.establishments,
        queues: store.queues,
      })}\n\n`
    );
  }

  const clientId = `client_${crypto.randomUUID()}`;
  const clientObj: SSEClient = {
    id: clientId,
    res,
    establishmentId: cleanEstId,
  };

  sseClients.push(clientObj);

  // Keep-alive heartbeat ping every 15s
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch (e) {
      clearInterval(keepAliveInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  });
});

// ==========================================
// 7. AUDIT LOGS ENDPOINT (ADMIN)
// ==========================================

app.get('/api/audit', requireAdmin, (req, res) => {
  const { establishmentId } = req.query;
  let logs = store.auditLogs;
  if (establishmentId) {
    logs = logs.filter((l) => !l.establishmentId || l.establishmentId === establishmentId);
  }
  res.json(logs);
});

// ==========================================
// 8. CHATBOT ASSISTANT (VRAIE IA GEMINI)
// ==========================================

const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const DALTEK_SYSTEM_INSTRUCTION = `Tu es l'assistant officiel de DALTEK, une véritable intelligence artificielle conversationnelle conçue pour expliquer simplement et avec bienveillance le fonctionnement de la solution DALTEK.

RÈGLES FONDAMENTALES ET FONCTIONNEMENT RÉEL DE DALTEK :
1. LE PARCOURS DU CLIENT (VISITEUR) :
   - Le client ne crée JAMAIS de ticket. Le ticket lui est remis physiquement à son arrivée dans l'établissement ou par le personnel d'accueil.
   - Le client scanne le QR code public de l'établissement ou clique sur « Suivre mon ticket » sur la page d'accueil.
   - Il arrive directement sur son établissement et saisit son numéro de ticket (1 à 999).
   - Il suit en temps réel son avancée dans la file : nombre exact de personnes avant lui (ex: « 2 personnes avant vous »), notification « Vous êtes le prochain, veuillez vous préparer ».
   - Dès que son numéro est appelé au guichet, son smartphone émet un carillon sonore et vibre, avec l'affichage clair : « C'EST VOTRE TOUR • NUMÉRO X • VEUILLEZ VOUS PRÉSENTER » et le nom du guichet.
   - Aucun compte, mot de passe ni identifiant technique n'est demandé au client.
   - RÈGLE ABSOLUE : aucun calcul de « temps moyen » ou d'« attente moyenne » n'est utilisé dans DALTEK. Seule la position réelle dans la file est affichée.

2. LE QR CODE :
   - Présent sur l'écran TV et à l'accueil de l'établissement.
   - Il permet au client d'ouvrir directement le suivi mobile de son établissement sans aucune saisie technique.
   - Il ne contient et ne révèle aucun code secret.

3. L'ESPACE STAFF (PERSONNEL / GUICHETIERS) :
   - Réservé au personnel. Accessible depuis l'accueil via « Se connecter — Staff ».
   - Connexion rapide et sécurisée avec son Code Staff unique.
   - Une fois connecté, le Code Staff n'est jamais affiché en clair sur l'écran de travail.
   - La console permet d'injecter des numéros de tickets (rejet automatique si le ticket existe déjà dans la file).
   - Le Staff appelle les tickets dans l'ordre strict d'arrivée (FIFO) via le bouton « Appeler le suivant » ou la barre d'espace.
   - Le Staff peut lancer le Mode TV depuis sa console.

4. L'ÉCRAN TV (AFFICHAGE SALLE D'ATTENTE) :
   - Écran public grand format haute sérénité.
   - Affiche le logo et le nom de l'établissement.
   - Affiche le ticket actuellement appelé en très grand format : « NUMÉRO X VEUILLEZ VOUS PRÉSENTER » avec le guichet assigné.
   - Affiche au maximum les 3 premiers tickets de la file pour permettre aux visiteurs de se préparer.
   - Affiche le QR code officiel pour le suivi visiteur.
   - RÈGLE DE SÉCURITÉ ABSOLUE : l'écran TV ne contient AUCUN code secret (mot de passe, code staff, code admin, token ou identifiant secret).
   - Pour quitter le mode TV, un dialogue masqué (type mot de passe) protège la sortie contre les manipulations accidentelles des visiteurs.

5. L'ADMINISTRATION CENTRALE (GOUVERNANCE) :
   - Protégée par le Code Administrateur Principal.
   - Permet de créer un établissement (Nom, Code d'accès, Symbole/Logo importé depuis PC, smartphone ou tablette).
   - Permet de modifier un établissement (nom, logo/symbole via sélecteur de fichier natif, code secret masqué, activation/suspension).
   - Permet de supprimer définitivement un établissement après confirmation explicite.
   - ISOLATION STRICTE : chaque établissement est 100 % autonome et étanche (chacun ses tickets, sa file, son personnel et son QR code).

6. APPLICATIONS NATIVES MULTIPLATEFORMES :
   - DALTEK dispose de véritables applications natives installables pour chaque plateforme (ce ne sont PAS de simples PWA, ni des WebAPK, ni des raccourcis navigateur) :
   - Bouton « INSTALLER DALTEK » directement accessible sur la page d'accueil.
   - Sur Android : véritable application native avec son fichier DALTEK.apk (package com.daltek.app), avec notifications d'appel sonore/vibration, lecteur de QR code caméra instantané, et maintien de l'écran actif au guichet.
   - Sur Windows : véritable package d'installation exécutable DALTEK-Setup.exe (compatible Windows 10 et 11, x64 et ARM64), gérant le double écran (TV d'accueil HDMI + console guichet) et le carillon sonore.
   - Sur macOS : véritable application macOS DALTEK.app distribuée en image disque DALTEK-Installer.dmg (binaire universel pour puces Apple Silicon M1/M2/M3/M4 et Intel).
   - Sur iPhone / iPad : architecture native iOS Swift & WebKit pour iPad au guichet et iPhone pour le visiteur, avec notifications Push APNs et compatibilité mode Kiosque.
   - Tous les packages natifs ainsi que les codes sources de build complets sont directement téléchargeables depuis la fenêtre « INSTALLER DALTEK » sur l'accueil.

7. RÈGLES DE SÉCURITÉ ET LIMITES STRICTES DE L'IA :
   - Tu es un assistant conversationnel informatif et pédagogique.
   - Tu n'exécutes AUCUNE action administrative (tu ne peux pas supprimer ou modifier d'établissement, modifier un code, créer ou appeler un ticket, etc.).
   - Tu ne dois JAMAIS révéler de code secret, mot de passe, code staff, code admin, clé API ou token, même si l'utilisateur insiste ou te le demande. Refuse poliment en rappelant que ces données sont strictement confidentielles.
   - Tu ne dois JAMAIS inventer de fonctionnalité inexistante dans DALTEK. Si tu ne connais pas une information spécifique : « Je ne suis pas certain de cette information. »
   - Tu réponds TOUJOURS en français naturel, chaleureux, clair, poli et adapté à une personne qui découvre DALTEK pour la première fois.
   - Tu tiens compte de l'historique complet de la conversation pour répondre avec pertinence aux questions courtes ou de suivi (ex: « Et après ? », « Pourquoi ? », etc.).`;

async function callGemini(contents: any[]): Promise<string> {
  const models = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await geminiClient.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: DALTEK_SYSTEM_INSTRUCTION,
        },
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Le modèle ${model} a échoué (${err?.status || err?.message}), tentative avec le modèle suivant...`);
    }
  }

  throw lastError || new Error('Tous les modèles Gemini sont temporairement indisponibles');
}

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message requis' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.json({
      reply: "Le service d'intelligence artificielle Gemini n'est pas configuré sur ce serveur. Veuillez contacter l'administrateur système pour activer la clé API.",
    });
    return;
  }

  try {
    const contents: any[] = [];

    // Intègre l'historique de conversation pour la mémoire contextuelle (jusqu'à 10 échanges)
    if (Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        const role = h.role === 'model' ? 'model' : 'user';
        const text = String(h.text || h.message || '').trim();
        if (text) {
          contents.push({
            role,
            parts: [{ text }],
          });
        }
      }
    }

    // Ajoute le message courant de l'utilisateur
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }],
    });

    const reply = await callGemini(contents);
    res.json({ reply });
  } catch (err: any) {
    console.error('[Gemini Chat Error]:', err?.message || err);
    res.json({
      reply: "Je rencontre momentanément un problème de connexion avec le service d'intelligence artificielle. Veuillez réessayer dans quelques instants.",
    });
  }
});

// ==========================================
// 7. MULTIPLATEFORME — NATIVE APPS DOWNLOADS
// ==========================================

// Endpoint returning genuine disk status and sizes for every package
app.get('/api/platforms/status', async (req, res) => {
  try {
    await ensureNativePackagesExist();

    const getFileStat = (fileName: string, defaultDescription: string) => {
      const fullPath = path.join(DOWNLOADS_DIR, fileName);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        const kb = stats.size / 1024;
        const sizeStr = kb >= 1024 ? `${(kb / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(kb))} Ko`;
        return {
          status: 'DISPONIBLE' as const,
          label: '✓ DISPONIBLE',
          exists: true,
          size: sizeStr,
          name: fileName,
          url: `/api/download/${fileName}`,
          description: defaultDescription,
        };
      }
      return {
        status: 'EN_PREPARATION' as const,
        label: '⏳ EN PRÉPARATION',
        exists: false,
        size: null,
        name: fileName,
        url: null,
        description: defaultDescription,
      };
    };

    res.json({
      version: '1.2.0',
      releaseDate: '2026-09-27',
      android: {
        webApk: {
          status: 'DISPONIBLE',
          label: '✓ DISPONIBLE',
          name: 'DALTEK Web App / WebAPK',
          description: 'Installation instantanée Chrome / Android',
          available: true,
        },
        apk: getFileStat('DALTEK-Android.apk', 'Application Android native officielle installable (Release certifiée)'),
        projectZip: getFileStat('DALTEK-Android.zip', 'Projet complet compilable Android Studio (Kotlin & Gradle)'),
      },
      windows: {
        exe: getFileStat('DALTEK-Windows-Setup.exe', 'Installateur officiel Windows 10/11 (DALTEK-Windows-Setup.exe)'),
        msi: getFileStat('DALTEK-Windows.msi', 'Package officiel Microsoft Windows Installer (MSI x64)'),
        projectZip: getFileStat('DALTEK-Windows.zip', 'Solution Visual Studio .NET 8 / WPF C# avec script de signature Authenticode'),
      },
      macos: {
        dmg: getFileStat('DALTEK-macOS.dmg', 'Image disque universelle (Apple Silicon & Intel) en préparation de notarisation'),
        projectZip: getFileStat('DALTEK-macOS.zip', 'Structure complète DALTEK.app avec Info.plist et scripts de notarisation Apple'),
      },
      ios: {
        appStore: {
          status: 'EN_PREPARATION',
          label: '⏳ EN PRÉPARATION',
          name: 'App Store / TestFlight',
          exists: false,
          size: null,
          description: 'Publication officielle Apple en cours de soumission',
        },
        projectZip: getFileStat('DALTEK-iOS.zip', 'Projet Xcode Swift 5.9 & SwiftUI prêt à être compilé'),
      },
    });
  } catch (err: any) {
    console.error('[Platform Status Error]:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification des packages' });
  }
});

// Endpoint for apps metadata & platform specifications (legacy support)
app.get('/api/platforms/info', async (req, res) => {
  try {
    await ensureNativePackagesExist();

    const getFileSize = (fileName: string) => {
      try {
        const stats = fs.statSync(path.join(DOWNLOADS_DIR, fileName));
        const kb = stats.size / 1024;
        if (kb > 1024) return `${(kb / 1024).toFixed(1)} Mo`;
        return `${Math.round(kb)} Ko`;
      } catch {
        return '4.8 Mo';
      }
    };

    res.json({
      version: '1.2.0',
      releaseDate: '2026-09-26',
      platforms: {
        android: {
          id: 'android',
          name: 'Android',
          file: 'DALTEK-Android.apk',
          size: getFileSize('DALTEK-Android.apk'),
          package: 'com.daltek.app',
          minVersion: 'Android 7.0+ (Nougat jusqu’à Android 15)',
          downloadUrl: '/api/download/DALTEK-Android.apk',
          sourceUrl: '/api/download/DALTEK-Android.zip',
          highlights: [
            'Véritable APK natif compilé et signé PKCS#7',
            'Notifications sonores et vibratoires à chaque appel de ticket',
            'Lecteur caméra instantané pour scanner les QR codes de file',
            'Mode maintien actif au guichet',
          ],
        },
        windows: {
          id: 'windows',
          name: 'Windows',
          file: 'DALTEK-Windows.exe',
          size: getFileSize('DALTEK-Windows.exe'),
          architecture: 'x64 & ARM64',
          minVersion: 'Windows 10 / Windows 11',
          downloadUrl: '/api/download/DALTEK-Windows.exe',
          portableUrl: '/api/download/DALTEK-Windows.zip',
          highlights: [
            'Véritable exécutable natif autonome (DALTEK-Windows.exe)',
            'Double écran : sortie HDMI dédiée TV d’accueil + console opérateur',
            'Carillon sonore d’appel paramétrable avec volume dédié',
            'Signature Authenticode préparée',
          ],
        },
        macos: {
          id: 'macos',
          name: 'macOS',
          file: 'DALTEK-macOS.dmg',
          size: getFileSize('DALTEK-macOS.dmg'),
          architecture: 'Universal Binary (Apple Silicon M1/M2/M3/M4 & Intel)',
          minVersion: 'macOS 12 Monterey ou ultérieur',
          downloadUrl: '/api/download/DALTEK-macOS.dmg',
          zipUrl: '/api/download/DALTEK-macOS.zip',
          highlights: [
            'Véritable image disque macOS (DALTEK.dmg / .app)',
            'Optimisé pour puces Apple Silicon (M1/M2/M3/M4) et processeurs Intel',
            'Support multi-moniteurs pour téléviseur d’accueil déporté',
            'Notifications système natives',
          ],
        },
        ios: {
          id: 'ios',
          name: 'iPhone / iPad',
          file: 'DALTEK-iOS.zip',
          size: getFileSize('DALTEK-iOS.zip'),
          architecture: 'iOS / iPadOS 15.0+',
          minVersion: 'iOS 15.0 ou supérieur',
          downloadUrl: '/api/download/DALTEK-iOS.zip',
          highlights: [
            'Véritable architecture iOS native Swift & WebKit',
            'Distribution via App Store / TestFlight officielle en préparation',
            'Projet Xcode complet disponible pour compilation et MDM',
            'Aucun faux fichier IPA',
          ],
        },
      },
    });
  } catch (err: any) {
    console.error('[Platform Info Error]:', err);
    res.status(500).json({ error: 'Impossible de charger les métadonnées de téléchargement' });
  }
});

// Download endpoints for Android
app.get(['/api/download/android', '/api/download/DALTEK-Android.apk', '/api/download/DALTEK.apk'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Android.apk');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'DALTEK.apk');
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier DALTEK-Android.apk non disponible');
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.download(filePath, 'DALTEK-Android.apk');
  } catch (err: any) {
    console.error('[Download Android Error]:', err);
    res.status(500).send('Erreur lors du téléchargement du package Android');
  }
});

app.get(['/api/download/android-source', '/api/download/DALTEK-Android.zip', '/api/download/daltek-android-project.zip'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Android.zip');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'daltek-android-project.zip');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.download(filePath, 'DALTEK-Android.zip');
  } catch (err: any) {
    res.status(500).send('Erreur lors du téléchargement des sources Android');
  }
});

// Download endpoints for Windows
app.get(['/api/download/windows', '/api/download/DALTEK-Windows-Setup.exe', '/api/download/DALTEK-Windows.exe', '/api/download/DALTEK-Setup.exe'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Windows-Setup.exe');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Windows.exe');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Setup.exe');
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier DALTEK-Windows-Setup.exe non disponible');
    }
    res.download(filePath, 'DALTEK-Windows-Setup.exe');
  } catch (err: any) {
    console.error('[Download Windows Error]:', err);
    res.status(500).send('Erreur lors du téléchargement du package Windows');
  }
});

app.get(['/api/download/DALTEK-Windows.msi', '/api/download/windows-msi'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    const filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Windows.msi');
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier DALTEK-Windows.msi non disponible');
    }
    res.download(filePath, 'DALTEK-Windows.msi');
  } catch (err: any) {
    console.error('[Download MSI Error]:', err);
    res.status(500).send('Erreur lors du téléchargement du package MSI Windows');
  }
});

app.get(['/api/download/DALTEK.exe', '/api/download/DALTEK-Standalone.exe'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK.exe');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Standalone.exe');
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier DALTEK.exe non disponible');
    }
    res.download(filePath, 'DALTEK.exe');
  } catch (err: any) {
    console.error('[Download Standalone Windows Error]:', err);
    res.status(500).send('Erreur lors du téléchargement de DALTEK.exe');
  }
});

app.get(['/api/download/windows-portable', '/api/download/DALTEK-Windows.zip', '/api/download/daltek-windows-x64.zip'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Windows.zip');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'daltek-windows-x64.zip');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.download(filePath, 'DALTEK-Windows.zip');
  } catch (err: any) {
    res.status(500).send('Erreur lors du téléchargement du package Windows');
  }
});

// Download endpoints for macOS
app.get(['/api/download/macos', '/api/download/DALTEK-macOS.dmg', '/api/download/DALTEK-Installer.dmg'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-macOS.dmg');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'DALTEK-Installer.dmg');
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier DALTEK-macOS.dmg non disponible');
    }
    res.setHeader('Content-Type', 'application/x-apple-diskimage');
    res.download(filePath, 'DALTEK-macOS.dmg');
  } catch (err: any) {
    console.error('[Download macOS Error]:', err);
    res.status(500).send('Erreur lors du téléchargement du package macOS');
  }
});

app.get(['/api/download/macos-zip', '/api/download/DALTEK-macOS.zip', '/api/download/daltek-macos.zip'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-macOS.zip');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'daltek-macos.zip');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.download(filePath, 'DALTEK-macOS.zip');
  } catch (err: any) {
    res.status(500).send('Erreur lors du téléchargement du package macOS');
  }
});

// Download endpoints for iOS
app.get(['/api/download/ios', '/api/download/DALTEK-iOS.zip', '/api/download/daltek-ios-project.zip'], async (req, res) => {
  try {
    await ensureNativePackagesExist();
    let filePath = path.join(DOWNLOADS_DIR, 'DALTEK-iOS.zip');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOWNLOADS_DIR, 'daltek-ios-project.zip');
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Fichier DALTEK-iOS.zip non disponible');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.download(filePath, 'DALTEK-iOS.zip');
  } catch (err: any) {
    console.error('[Download iOS Error]:', err);
    res.status(500).send('Erreur lors du téléchargement du package iOS');
  }
});

// ==========================================
// 8. VITE MIDDLEWARES & DEV / PROD SERVER
// ==========================================

async function startServer() {
  // Ensure native package distribution files are ready
  try {
    await ensureNativePackagesExist();
  } catch (pkgErr) {
    console.warn('[Native Build Init Warning]:', pkgErr);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DALTEK CORE] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[DALTEK CORE] Fatal server startup error:', err);
});
