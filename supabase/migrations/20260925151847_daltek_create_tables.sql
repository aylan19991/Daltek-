/*
# DALTEK — Tables et structure initiale

1. Nouvelles tables
- `establishments` : établissements utilisant DALTEK
- `profiles` : profils utilisateurs liés à auth.users avec rôle
- `tickets` : tickets de la file d'attente
- `current_calls` : état courant (un seul ticket appelé par établissement)
- `settings` : paramètres par établissement
- `ticket_history` : journal des actions sur tickets

2. Notes importantes
- Toutes les tables sont créées avec RLS activée.
- Les politiques RLS et fonctions SECURITY DEFINER sont dans une migration séparée.
- Un seul current_call par établissement (contrainte UNIQUE sur establishment_id).
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- establishments
CREATE TABLE IF NOT EXISTS establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Daltek',
  starting_number int NOT NULL DEFAULT 1,
  max_tickets int NOT NULL DEFAULT 999,
  sound_enabled boolean NOT NULL DEFAULT true,
  display_theme text NOT NULL DEFAULT 'dark',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','agent','user','screen')),
  display_name text,
  establishment_id uuid REFERENCES establishments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number int NOT NULL,
  establishment_id uuid NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','called','served','cancelled','recalled')),
  category text,
  counter text,
  called_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  called_at timestamptz,
  served_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_establishment_status ON tickets(establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_establishment_number ON tickets(establishment_id, number);
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- current_calls
CREATE TABLE IF NOT EXISTS current_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES establishments(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  ticket_number int,
  counter text,
  called_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  called_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_current_calls_establishment ON current_calls(establishment_id);
ALTER TABLE current_calls ENABLE ROW LEVEL SECURITY;

-- settings
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(establishment_id, key)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ticket_history
CREATE TABLE IF NOT EXISTS ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  ticket_number int NOT NULL,
  establishment_id uuid NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created','called','recalled','served','cancelled','reset')),
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  counter text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_establishment ON ticket_history(establishment_id, created_at DESC);
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;

-- Seed default establishment
INSERT INTO establishments (name, starting_number, max_tickets, sound_enabled, display_theme)
SELECT 'Daltek', 1, 999, true, 'dark'
WHERE NOT EXISTS (SELECT 1 FROM establishments);
