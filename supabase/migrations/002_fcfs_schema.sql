-- Blackwater Labs FCFS applications schema
-- Run via Supabase CLI: supabase db push

CREATE TYPE fcfs_application_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE fcfs_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  wallet_address_normalised TEXT NOT NULL UNIQUE,
  x_handle TEXT NOT NULL,
  x_handle_normalised TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  follow_opened_at TIMESTAMPTZ,
  follow_confirmed_at TIMESTAMPTZ,
  share_opened_at TIMESTAMPTZ,
  share_confirmed_at TIMESTAMPTZ,
  status fcfs_application_status NOT NULL DEFAULT 'pending',
  internal_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fcfs_applications_status ON fcfs_applications(status);
CREATE INDEX idx_fcfs_applications_submitted_at ON fcfs_applications(submitted_at DESC);
CREATE INDEX idx_fcfs_applications_x_handle_normalised ON fcfs_applications(x_handle_normalised);
CREATE INDEX idx_fcfs_applications_wallet_normalised ON fcfs_applications(wallet_address_normalised);

CREATE TRIGGER fcfs_applications_updated_at
  BEFORE UPDATE ON fcfs_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_whitelist_updated_at();

ALTER TABLE fcfs_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY fcfs_applications_admin_all
  ON fcfs_applications FOR ALL
  TO authenticated
  USING (is_whitelist_admin())
  WITH CHECK (is_whitelist_admin());

CREATE OR REPLACE FUNCTION normalise_fcfs_x_handle(p_handle TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_handle TEXT;
BEGIN
  v_handle := lower(regexp_replace(trim(COALESCE(p_handle, '')), '^@+', ''));
  RETURN v_handle;
END;
$$;

CREATE OR REPLACE FUNCTION public_submit_fcfs_application(
  p_wallet_address TEXT,
  p_x_handle TEXT,
  p_follow_opened_at TIMESTAMPTZ,
  p_follow_confirmed_at TIMESTAMPTZ,
  p_share_opened_at TIMESTAMPTZ,
  p_share_confirmed_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_normalised TEXT;
  v_x_normalised TEXT;
  v_x_display TEXT;
  v_wallet_display TEXT;
  v_row fcfs_applications%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_wallet_normalised := lower(trim(COALESCE(p_wallet_address, '')));

  IF v_wallet_normalised = '' OR v_wallet_normalised !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_wallet');
  END IF;

  v_x_normalised := normalise_fcfs_x_handle(p_x_handle);

  IF v_x_normalised = '' OR v_x_normalised !~ '^[a-z0-9_]{1,15}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_x_handle');
  END IF;

  IF p_follow_opened_at IS NULL
    OR p_follow_confirmed_at IS NULL
    OR p_share_opened_at IS NULL
    OR p_share_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('outcome', 'incomplete_verification');
  END IF;

  IF p_follow_opened_at > v_now
    OR p_follow_confirmed_at > v_now
    OR p_share_opened_at > v_now
    OR p_share_confirmed_at > v_now THEN
    RETURN jsonb_build_object('outcome', 'invalid_timestamps');
  END IF;

  IF p_follow_opened_at > p_follow_confirmed_at
    OR p_share_opened_at > p_share_confirmed_at THEN
    RETURN jsonb_build_object('outcome', 'invalid_timestamps');
  END IF;

  IF p_follow_confirmed_at < v_now - interval '3 hours'
    OR p_share_confirmed_at < v_now - interval '3 hours' THEN
    RETURN jsonb_build_object('outcome', 'session_expired');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM fcfs_applications
    WHERE wallet_address_normalised = v_wallet_normalised
  ) THEN
    RETURN jsonb_build_object('outcome', 'already_registered');
  END IF;

  v_wallet_display := '0x' || substr(v_wallet_normalised, 3);
  v_x_display := '@' || v_x_normalised;

  INSERT INTO fcfs_applications (
    wallet_address,
    wallet_address_normalised,
    x_handle,
    x_handle_normalised,
    submitted_at,
    follow_opened_at,
    follow_confirmed_at,
    share_opened_at,
    share_confirmed_at,
    status
  ) VALUES (
    v_wallet_display,
    v_wallet_normalised,
    v_x_display,
    v_x_normalised,
    v_now,
    p_follow_opened_at,
    p_follow_confirmed_at,
    p_share_opened_at,
    p_share_confirmed_at,
    'pending'
  )
  RETURNING * INTO v_row;

  INSERT INTO audit_events (
    event_type,
    wallet_id,
    wallet_address_snapshot,
    event_source,
    metadata
  ) VALUES (
    'fcfs_application_submitted',
    NULL,
    v_row.wallet_address,
    'public',
    jsonb_build_object(
      'fcfs_application_id', v_row.id,
      'x_handle', v_row.x_handle,
      'status', v_row.status
    )
  );

  RETURN jsonb_build_object(
    'outcome', 'submitted',
    'application_id', v_row.id,
    'submitted_at', v_row.submitted_at
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('outcome', 'already_registered');
END;
$$;

REVOKE ALL ON FUNCTION public_submit_fcfs_application(
  TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_submit_fcfs_application(
  TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION admin_fcfs_duplicate_x_handles()
RETURNS SETOF TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT x_handle_normalised
  FROM fcfs_applications
  GROUP BY x_handle_normalised
  HAVING count(*) > 1;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_duplicate_x_handles() TO authenticated;

CREATE OR REPLACE FUNCTION admin_fcfs_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending INT;
  v_approved INT;
  v_rejected INT;
  v_total INT;
  v_recent INT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total FROM fcfs_applications;
  SELECT count(*) INTO v_pending FROM fcfs_applications WHERE status = 'pending';
  SELECT count(*) INTO v_approved FROM fcfs_applications WHERE status = 'approved';
  SELECT count(*) INTO v_rejected FROM fcfs_applications WHERE status = 'rejected';
  SELECT count(*) INTO v_recent
  FROM fcfs_applications
  WHERE submitted_at >= now() - interval '7 days';

  RETURN jsonb_build_object(
    'total', v_total,
    'pending', v_pending,
    'approved', v_approved,
    'rejected', v_rejected,
    'recent_submissions', v_recent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_stats() TO authenticated;

CREATE OR REPLACE FUNCTION log_fcfs_admin_audit(
  p_event_type TEXT,
  p_fcfs_application_id UUID,
  p_wallet_address TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO audit_events (
    event_type,
    wallet_id,
    wallet_address_snapshot,
    admin_user_id,
    event_source,
    metadata
  ) VALUES (
    p_event_type,
    NULL,
    p_wallet_address,
    auth.uid(),
    'admin',
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'fcfs_application_id', p_fcfs_application_id
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_fcfs_admin_audit(TEXT, UUID, TEXT, JSONB) TO authenticated;
