/*
# DALTEK — Politiques RLS et fonctions

1. Sécurité (RLS policies)
- establishments: lecture publique, écriture admin/agent
- profiles: lecture propre + lecture agents/admins, écriture propre + admin
- tickets: lecture publique, insertion publique, MAJ/annulation agents/admins
- current_calls: lecture publique, écriture agents/admins
- settings: lecture publique, écriture agents/admins
- ticket_history: lecture publique, insertion agents/admins

2. Fonctions SECURITY DEFINER
- handle_new_user: auto-création de profil à l'inscription
- take_ticket: prise de numéro (public)
- call_next_ticket: appeler le prochain (agent/admin)
- call_specific_ticket: appeler un numéro précis (agent/admin)
- recall_ticket: rappeler le numéro actuel (agent/admin)
- serve_ticket: terminer le ticket actuel (agent/admin)
- cancel_ticket: annuler un ticket (agent/admin)
- reset_queue: réinitialiser la file (admin)
- get_queue_state: récupérer l'état complet (public)
*/

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- establishments
DROP POLICY IF EXISTS "public_read_establishments" ON establishments;
CREATE POLICY "public_read_establishments"
  ON establishments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_establishments" ON establishments;
CREATE POLICY "admin_insert_establishments"
  ON establishments FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "admin_update_establishments" ON establishments;
CREATE POLICY "admin_update_establishments"
  ON establishments FOR UPDATE TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

-- profiles
DROP POLICY IF EXISTS "read_own_profile" ON profiles;
CREATE POLICY "read_own_profile"
  ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles"
  ON profiles FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles"
  ON profiles FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- tickets
DROP POLICY IF EXISTS "public_read_tickets" ON tickets;
CREATE POLICY "public_read_tickets"
  ON tickets FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_tickets" ON tickets;
CREATE POLICY "public_insert_tickets"
  ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "agent_update_tickets" ON tickets;
CREATE POLICY "agent_update_tickets"
  ON tickets FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "admin_delete_tickets" ON tickets;
CREATE POLICY "admin_delete_tickets"
  ON tickets FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- current_calls
DROP POLICY IF EXISTS "public_read_current_calls" ON current_calls;
CREATE POLICY "public_read_current_calls"
  ON current_calls FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "agent_insert_current_calls" ON current_calls;
CREATE POLICY "agent_insert_current_calls"
  ON current_calls FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "agent_update_current_calls" ON current_calls;
CREATE POLICY "agent_update_current_calls"
  ON current_calls FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "agent_delete_current_calls" ON current_calls;
CREATE POLICY "agent_delete_current_calls"
  ON current_calls FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

-- settings
DROP POLICY IF EXISTS "public_read_settings" ON settings;
CREATE POLICY "public_read_settings"
  ON settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "agent_insert_settings" ON settings;
CREATE POLICY "agent_insert_settings"
  ON settings FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "agent_update_settings" ON settings;
CREATE POLICY "agent_update_settings"
  ON settings FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

DROP POLICY IF EXISTS "agent_delete_settings" ON settings;
CREATE POLICY "agent_delete_settings"
  ON settings FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

-- ticket_history
DROP POLICY IF EXISTS "public_read_history" ON ticket_history;
CREATE POLICY "public_read_history"
  ON ticket_history FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "agent_insert_history" ON ticket_history;
CREATE POLICY "agent_insert_history"
  ON ticket_history FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','agent'))
  );

-- ============================================================================
-- FUNCTION: handle_new_user (auto-create profile on signup)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- FUNCTION: take_ticket (public)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.take_ticket(
  p_establishment_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number int,
  establishment_id uuid,
  establishment_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_establishment_name text;
  v_starting_number int;
  v_max_tickets int;
  v_next_number int;
  v_current_max int;
  v_ticket_id uuid;
  v_count_active int;
BEGIN
  IF p_establishment_id IS NOT NULL THEN
    SELECT id, name, starting_number, max_tickets
    INTO v_establishment_id, v_establishment_name, v_starting_number, v_max_tickets
    FROM establishments WHERE id = p_establishment_id;
  ELSE
    SELECT id, name, starting_number, max_tickets
    INTO v_establishment_id, v_establishment_name, v_starting_number, v_max_tickets
    FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    INSERT INTO establishments (name, starting_number, max_tickets, sound_enabled, display_theme)
    VALUES ('Daltek', 1, 999, true, 'dark')
    RETURNING id, name, starting_number, max_tickets
    INTO v_establishment_id, v_establishment_name, v_starting_number, v_max_tickets;
  END IF;

  SELECT COALESCE(MAX(number), v_starting_number - 1)
  INTO v_current_max
  FROM tickets WHERE establishment_id = v_establishment_id;

  v_next_number := GREATEST(v_current_max + 1, v_starting_number);

  SELECT COUNT(*)::int INTO v_count_active
  FROM tickets
  WHERE establishment_id = v_establishment_id AND status NOT IN ('served','cancelled');

  IF v_count_active >= v_max_tickets THEN
    RAISE EXCEPTION 'Nombre maximum de tickets atteint (%)', v_max_tickets;
  END IF;

  INSERT INTO tickets (number, establishment_id, status, category)
  VALUES (v_next_number, v_establishment_id, 'waiting', p_category)
  RETURNING id INTO v_ticket_id;

  INSERT INTO ticket_history (ticket_id, ticket_number, establishment_id, action)
  VALUES (v_ticket_id, v_next_number, v_establishment_id, 'created');

  RETURN QUERY
  SELECT v_ticket_id, v_next_number, v_establishment_id, v_establishment_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_ticket(uuid, text) TO anon, authenticated;

-- ============================================================================
-- FUNCTION: call_next_ticket (agent/admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.call_next_ticket(
  p_establishment_id uuid DEFAULT NULL,
  p_counter text DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number int,
  counter text,
  establishment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_ticket_id uuid;
  v_ticket_number int;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_existing_call_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour appeler un numéro';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'Permissions insuffisantes. Rôle agent ou admin requis.';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé';
  END IF;

  SELECT id, number INTO v_ticket_id, v_ticket_number
  FROM tickets
  WHERE establishment_id = v_establishment_id AND status = 'waiting'
  ORDER BY number ASC
  LIMIT 1;

  IF v_ticket_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE tickets
  SET status = 'called', called_by = v_caller_id, called_at = now(),
      counter = COALESCE(p_counter, counter), updated_at = now()
  WHERE id = v_ticket_id;

  SELECT id INTO v_existing_call_id FROM current_calls WHERE establishment_id = v_establishment_id;

  IF v_existing_call_id IS NOT NULL THEN
    UPDATE current_calls
    SET ticket_id = v_ticket_id, ticket_number = v_ticket_number,
        counter = p_counter, called_by = v_caller_id, called_at = now(), updated_at = now()
    WHERE establishment_id = v_establishment_id;
  ELSE
    INSERT INTO current_calls (establishment_id, ticket_id, ticket_number, counter, called_by, called_at)
    VALUES (v_establishment_id, v_ticket_id, v_ticket_number, p_counter, v_caller_id, now());
  END IF;

  INSERT INTO ticket_history (ticket_id, ticket_number, establishment_id, action, performed_by, counter)
  VALUES (v_ticket_id, v_ticket_number, v_establishment_id, 'called', v_caller_id, p_counter);

  RETURN QUERY
  SELECT v_ticket_id, v_ticket_number, COALESCE(p_counter, ''), v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.call_next_ticket(uuid, text) TO authenticated;

-- ============================================================================
-- FUNCTION: call_specific_ticket (agent/admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.call_specific_ticket(
  p_ticket_number int,
  p_establishment_id uuid DEFAULT NULL,
  p_counter text DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number int,
  counter text,
  establishment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_ticket_id uuid;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_existing_call_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour appeler un numéro';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'Permissions insuffisantes. Rôle agent ou admin requis.';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé';
  END IF;

  SELECT id INTO v_ticket_id
  FROM tickets
  WHERE establishment_id = v_establishment_id AND number = p_ticket_number
  ORDER BY created_at DESC LIMIT 1;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ce ticket n''existe pas';
  END IF;

  UPDATE tickets
  SET status = 'called', called_by = v_caller_id, called_at = now(),
      counter = COALESCE(p_counter, counter), updated_at = now()
  WHERE id = v_ticket_id;

  SELECT id INTO v_existing_call_id FROM current_calls WHERE establishment_id = v_establishment_id;

  IF v_existing_call_id IS NOT NULL THEN
    UPDATE current_calls
    SET ticket_id = v_ticket_id, ticket_number = p_ticket_number,
        counter = p_counter, called_by = v_caller_id, called_at = now(), updated_at = now()
    WHERE establishment_id = v_establishment_id;
  ELSE
    INSERT INTO current_calls (establishment_id, ticket_id, ticket_number, counter, called_by, called_at)
    VALUES (v_establishment_id, v_ticket_id, p_ticket_number, p_counter, v_caller_id, now());
  END IF;

  INSERT INTO ticket_history (ticket_id, ticket_number, establishment_id, action, performed_by, counter)
  VALUES (v_ticket_id, p_ticket_number, v_establishment_id, 'called', v_caller_id, p_counter);

  RETURN QUERY
  SELECT v_ticket_id, p_ticket_number, COALESCE(p_counter, ''), v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.call_specific_ticket(int, uuid, text) TO authenticated;

-- ============================================================================
-- FUNCTION: recall_ticket (agent/admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recall_ticket(
  p_establishment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number int,
  counter text,
  establishment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_ticket_id uuid;
  v_ticket_number int;
  v_counter text;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé';
  END IF;

  SELECT cc.ticket_id, cc.ticket_number, cc.counter
  INTO v_ticket_id, v_ticket_number, v_counter
  FROM current_calls cc
  WHERE cc.establishment_id = v_establishment_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Aucun numéro n''est actuellement appelé';
  END IF;

  UPDATE current_calls
  SET called_at = now(), updated_at = now()
  WHERE establishment_id = v_establishment_id;

  UPDATE tickets SET status = 'recalled', called_at = now(), updated_at = now()
  WHERE id = v_ticket_id;

  INSERT INTO ticket_history (ticket_id, ticket_number, establishment_id, action, performed_by, counter)
  VALUES (v_ticket_id, v_ticket_number, v_establishment_id, 'recalled', v_caller_id, v_counter);

  RETURN QUERY
  SELECT v_ticket_id, v_ticket_number, COALESCE(v_counter, ''), v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recall_ticket(uuid) TO authenticated;

-- ============================================================================
-- FUNCTION: serve_ticket (agent/admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.serve_ticket(
  p_establishment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number int,
  establishment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_ticket_id uuid;
  v_ticket_number int;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé';
  END IF;

  SELECT cc.ticket_id, cc.ticket_number
  INTO v_ticket_id, v_ticket_number
  FROM current_calls cc
  WHERE cc.establishment_id = v_establishment_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Aucun numéro n''est actuellement appelé';
  END IF;

  UPDATE tickets SET status = 'served', served_at = now(), updated_at = now()
  WHERE id = v_ticket_id;

  DELETE FROM current_calls WHERE establishment_id = v_establishment_id;

  INSERT INTO ticket_history (ticket_id, ticket_number, establishment_id, action, performed_by)
  VALUES (v_ticket_id, v_ticket_number, v_establishment_id, 'served', v_caller_id);

  RETURN QUERY
  SELECT v_ticket_id, v_ticket_number, v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.serve_ticket(uuid) TO authenticated;

-- ============================================================================
-- FUNCTION: cancel_ticket (agent/admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_ticket(
  p_ticket_number int,
  p_establishment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number int,
  establishment_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_ticket_id uuid;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé';
  END IF;

  SELECT id INTO v_ticket_id
  FROM tickets
  WHERE establishment_id = v_establishment_id AND number = p_ticket_number
  ORDER BY created_at DESC LIMIT 1;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Ce ticket n''existe pas';
  END IF;

  UPDATE tickets SET status = 'cancelled', updated_at = now() WHERE id = v_ticket_id;

  DELETE FROM current_calls
  WHERE establishment_id = v_establishment_id AND ticket_id = v_ticket_id;

  INSERT INTO ticket_history (ticket_id, ticket_number, establishment_id, action, performed_by)
  VALUES (v_ticket_id, p_ticket_number, v_establishment_id, 'cancelled', v_caller_id);

  RETURN QUERY
  SELECT v_ticket_id, p_ticket_number, v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_ticket(int, uuid) TO authenticated;

-- ============================================================================
-- FUNCTION: reset_queue (admin/agent)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_queue(
  p_establishment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin','agent') THEN
    RAISE EXCEPTION 'Permissions insuffisantes';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Aucun établissement trouvé';
  END IF;

  INSERT INTO ticket_history (ticket_number, establishment_id, action, performed_by)
  SELECT number, v_establishment_id, 'reset', v_caller_id
  FROM tickets
  WHERE establishment_id = v_establishment_id AND status IN ('waiting','called','recalled');

  UPDATE tickets
  SET status = 'cancelled', updated_at = now()
  WHERE establishment_id = v_establishment_id AND status NOT IN ('served','cancelled');

  DELETE FROM current_calls WHERE establishment_id = v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_queue(uuid) TO authenticated;

-- ============================================================================
-- FUNCTION: get_queue_state (public)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_queue_state(
  p_establishment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  current_ticket_number int,
  current_counter text,
  current_called_at timestamptz,
  waiting_count int,
  next_waiting_number int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
BEGIN
  IF p_establishment_id IS NOT NULL THEN
    v_establishment_id := p_establishment_id;
  ELSE
    SELECT id INTO v_establishment_id FROM establishments ORDER BY created_at LIMIT 1;
  END IF;

  IF v_establishment_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cc.ticket_number,
    cc.counter,
    cc.called_at,
    (SELECT COUNT(*)::int FROM tickets WHERE establishment_id = v_establishment_id AND status = 'waiting'),
    (
      SELECT t.number FROM tickets t
      WHERE t.establishment_id = v_establishment_id AND t.status = 'waiting'
      ORDER BY t.number ASC LIMIT 1
    )
  FROM current_calls cc
  WHERE cc.establishment_id = v_establishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_state(uuid) TO anon, authenticated;
