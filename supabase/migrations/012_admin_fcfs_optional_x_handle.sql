-- Admin FCFS manual add / import: optional X handle (public submit unchanged)

ALTER TABLE fcfs_applications
  ALTER COLUMN x_handle DROP NOT NULL,
  ALTER COLUMN x_handle_normalised DROP NOT NULL;

-- Partial unique index only when no duplicate non-empty handles exist (production
-- may already have duplicate X handles — same guard as migration 006).
DROP INDEX IF EXISTS idx_fcfs_applications_x_handle_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM fcfs_applications
    WHERE coalesce(x_handle_normalised, '') <> ''
    GROUP BY x_handle_normalised
    HAVING count(*) > 1
    LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX idx_fcfs_applications_x_handle_unique
      ON fcfs_applications (x_handle_normalised)
      WHERE x_handle_normalised IS NOT NULL AND x_handle_normalised <> '';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fcfs_is_malformed_x_handle(
  p_handle TEXT,
  p_normalised TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(p_normalised, '') <> ''
    AND (
      coalesce(p_normalised, '') !~ '^[a-z0-9_]{1,15}$'
      OR coalesce(p_handle, '') <> ('@' || coalesce(p_normalised, ''))
    );
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_pre_insert_audit(p_wallet TEXT, p_x_handle TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet TEXT := lower(trim(coalesce(p_wallet, '')));
  v_handle TEXT := lower(trim(replace(coalesce(p_x_handle, ''), '@', '')));
  v_wl_exists BOOLEAN;
  v_fcfs_wallet fcfs_applications%ROWTYPE;
  v_fcfs_handle fcfs_applications%ROWTYPE;
  v_handle_provided BOOLEAN := v_handle <> '';
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_wallet = '' OR v_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_wallet');
  END IF;

  IF v_handle_provided AND v_handle !~ '^[a-z0-9_]{1,15}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_handle');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM whitelist_wallets
    WHERE wallet_address_normalised = v_wallet AND is_active AND status <> 'removed'
  ) INTO v_wl_exists;

  SELECT * INTO v_fcfs_wallet FROM fcfs_applications WHERE wallet_address_normalised = v_wallet LIMIT 1;

  IF v_handle_provided THEN
    SELECT * INTO v_fcfs_handle FROM fcfs_applications WHERE x_handle_normalised = v_handle LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'wallet_address_normalised', v_wallet,
    'x_handle_normalised', CASE WHEN v_handle_provided THEN v_handle ELSE NULL END,
    'x_handle_provided', v_handle_provided,
    'whitelist', jsonb_build_object('exists', v_wl_exists),
    'fcfs_wallet', jsonb_build_object(
      'exists', v_fcfs_wallet.id IS NOT NULL,
      'status', v_fcfs_wallet.status
    ),
    'fcfs_handle', jsonb_build_object(
      'exists', v_handle_provided AND v_fcfs_handle.id IS NOT NULL,
      'wallet', v_fcfs_handle.wallet_address_normalised
    ),
    'crossover', jsonb_build_object(
      'valid_crossover', v_wl_exists AND v_fcfs_wallet.id IS NULL
    ),
    'can_insert', v_fcfs_wallet.id IS NULL
      AND (NOT v_handle_provided OR v_fcfs_handle.id IS NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_create_manual(
  p_wallet TEXT,
  p_x_handle TEXT,
  p_status TEXT DEFAULT 'pending',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit JSONB;
  v_row fcfs_applications%ROWTYPE;
  v_admin UUID := auth.uid();
  v_now TIMESTAMPTZ := now();
  v_handle_norm TEXT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_audit := admin_fcfs_pre_insert_audit(p_wallet, p_x_handle);
  IF (v_audit->>'outcome') <> 'ok' OR NOT (v_audit->>'can_insert')::boolean THEN
    RETURN jsonb_build_object('outcome', 'blocked', 'audit', v_audit);
  END IF;

  v_handle_norm := v_audit->>'x_handle_normalised';

  INSERT INTO fcfs_applications (
    wallet_address, wallet_address_normalised,
    x_handle, x_handle_normalised,
    submitted_at, follow_opened_at, follow_confirmed_at,
    share_opened_at, share_confirmed_at,
    status, internal_notes, reviewed_at, reviewed_by
  ) VALUES (
    p_wallet, lower(trim(p_wallet)),
    CASE WHEN v_handle_norm IS NOT NULL AND v_handle_norm <> '' THEN '@' || v_handle_norm ELSE NULL END,
    NULLIF(v_handle_norm, ''),
    v_now, v_now, v_now, v_now, v_now,
    coalesce(p_status, 'pending')::fcfs_application_status,
    p_notes,
    CASE WHEN coalesce(p_status, 'pending') = 'pending' THEN NULL ELSE v_now END,
    CASE WHEN coalesce(p_status, 'pending') = 'pending' THEN NULL ELSE v_admin END
  )
  RETURNING * INTO v_row;

  INSERT INTO audit_events (
    event_type, wallet_id, wallet_address_snapshot, admin_user_id, event_source, metadata
  ) VALUES (
    'fcfs_application_created_manual', NULL, v_row.wallet_address, v_admin, 'admin',
    jsonb_build_object(
      'application_id', v_row.id,
      'status', v_row.status,
      'x_handle', v_row.x_handle,
      'x_handle_provided', v_row.x_handle_normalised IS NOT NULL
    )
  );

  RETURN jsonb_build_object('outcome', 'ok', 'application', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_import_preview(
  p_dataset TEXT,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_classified JSONB := '[]'::jsonb;
  v_row JSONB;
  v_wallet TEXT;
  v_handle TEXT;
  v_handle_provided BOOLEAN;
  v_category TEXT;
  v_counts JSONB;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  LOOP
    v_wallet := lower(trim(coalesce(v_row->>'wallet', '')));
    v_handle := lower(trim(replace(coalesce(v_row->>'x_handle', ''), '@', '')));
    v_handle_provided := v_handle <> '';
    v_category := 'ready';

    IF p_dataset = 'whitelist' THEN
      IF v_wallet = '' OR v_wallet !~ '^0x[a-f0-9]{40}$' THEN
        v_category := 'invalid_wallet';
      ELSIF EXISTS (SELECT 1 FROM whitelist_wallets WHERE wallet_address_normalised = v_wallet) THEN
        v_category := 'already_in_wl';
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
        WHERE lower(trim(r.value->>'wallet')) = v_wallet AND r.value <> v_row
      ) THEN
        v_category := 'duplicate_in_file';
      ELSIF EXISTS (SELECT 1 FROM fcfs_applications WHERE wallet_address_normalised = v_wallet) THEN
        v_category := 'crossover';
      END IF;
    ELSE
      IF v_wallet = '' OR v_wallet !~ '^0x[a-f0-9]{40}$' THEN
        v_category := 'invalid_wallet';
      ELSIF v_handle_provided AND v_handle !~ '^[a-z0-9_]{1,15}$' THEN
        v_category := 'invalid_handle';
      ELSIF EXISTS (SELECT 1 FROM fcfs_applications WHERE wallet_address_normalised = v_wallet) THEN
        v_category := 'already_in_fcfs';
      ELSIF v_handle_provided AND EXISTS (
        SELECT 1 FROM fcfs_applications WHERE x_handle_normalised = v_handle
      ) THEN
        v_category := 'handle_conflict';
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
        WHERE (
          lower(trim(r.value->>'wallet')) = v_wallet
          OR (
            v_handle_provided
            AND lower(trim(replace(r.value->>'x_handle', '@', ''))) = v_handle
          )
        ) AND r.value <> v_row
      ) THEN
        v_category := 'duplicate_in_file';
      ELSIF EXISTS (
        SELECT 1 FROM whitelist_wallets
        WHERE wallet_address_normalised = v_wallet AND is_active AND status <> 'removed'
      ) THEN
        v_category := 'crossover';
      END IF;
    END IF;

    v_classified := v_classified || jsonb_build_array(
      v_row || jsonb_build_object('category', v_category)
    );
  END LOOP;

  SELECT jsonb_build_object(
    'total', jsonb_array_length(v_classified),
    'ready', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'ready'),
    'invalid_wallet', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'invalid_wallet'),
    'invalid_handle', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'invalid_handle'),
    'duplicate_in_file', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'duplicate_in_file'),
    'already_in_wl', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'already_in_wl'),
    'already_in_fcfs', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'already_in_fcfs'),
    'crossover', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'crossover'),
    'handle_conflict', (SELECT count(*) FROM jsonb_array_elements(v_classified) e WHERE e.value->>'category' = 'handle_conflict')
  ) INTO v_counts;

  RETURN jsonb_build_object('outcome', 'ok', 'summary', v_counts, 'rows', v_classified);
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_import_commit(
  p_dataset TEXT,
  p_rows JSONB,
  p_expected_count INT,
  p_batch_name TEXT DEFAULT 'Admin import'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview JSONB;
  v_ready INT;
  v_imported INT := 0;
  v_row JSONB;
  v_admin UUID := auth.uid();
  v_handle TEXT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_preview := admin_clearance_import_preview(p_dataset, p_rows);
  v_ready := (v_preview->'summary'->>'ready')::int;

  IF v_ready <> coalesce(p_expected_count, -1) THEN
    RETURN jsonb_build_object('outcome', 'count_mismatch', 'ready', v_ready);
  END IF;

  FOR v_row IN
    SELECT value FROM jsonb_array_elements(v_preview->'rows')
    WHERE value->>'category' = 'ready'
  LOOP
    IF p_dataset = 'whitelist' THEN
      INSERT INTO whitelist_wallets (
        wallet_address, wallet_address_normalised, status, is_active,
        wl_spots, source, internal_notes, created_by, updated_by
      ) VALUES (
        v_row->>'wallet', lower(trim(v_row->>'wallet')),
        coalesce(v_row->>'status', 'unconfirmed')::wallet_status,
        true, 1, p_batch_name, v_row->>'notes', v_admin, v_admin
      ) ON CONFLICT (wallet_address_normalised) DO NOTHING;
      IF EXISTS (
        SELECT 1 FROM whitelist_wallets
        WHERE wallet_address_normalised = lower(trim(v_row->>'wallet'))
          AND created_at >= now() - interval '5 seconds'
      ) THEN
        v_imported := v_imported + 1;
      END IF;
    ELSE
      v_handle := lower(trim(replace(coalesce(v_row->>'x_handle', ''), '@', '')));
      INSERT INTO fcfs_applications (
        wallet_address, wallet_address_normalised,
        x_handle, x_handle_normalised,
        submitted_at, follow_opened_at, follow_confirmed_at,
        share_opened_at, share_confirmed_at,
        status, internal_notes
      ) VALUES (
        v_row->>'wallet', lower(trim(v_row->>'wallet')),
        CASE WHEN v_handle <> '' THEN '@' || v_handle ELSE NULL END,
        NULLIF(v_handle, ''),
        now(), now(), now(), now(), now(),
        coalesce(v_row->>'status', 'pending')::fcfs_application_status,
        v_row->>'notes'
      ) ON CONFLICT (wallet_address_normalised) DO NOTHING;
      IF EXISTS (
        SELECT 1 FROM fcfs_applications
        WHERE wallet_address_normalised = lower(trim(v_row->>'wallet'))
          AND created_at >= now() - interval '5 seconds'
      ) THEN
        v_imported := v_imported + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO audit_events (
    event_type, wallet_id, wallet_address_snapshot, admin_user_id, event_source, metadata
  ) VALUES (
    'clearance_import_completed', NULL, NULL, v_admin, 'admin',
    jsonb_build_object(
      'dataset', p_dataset,
      'expected', p_expected_count,
      'imported', v_imported,
      'batch_name', p_batch_name
    )
  );

  RETURN jsonb_build_object('outcome', 'ok', 'imported', v_imported);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_pre_insert_audit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_create_manual(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_import_preview(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_import_commit(TEXT, JSONB, INT, TEXT) TO authenticated;
