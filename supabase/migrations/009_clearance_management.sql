-- Phase 2: server-side selection, bulk actions, import, export matrix

CREATE OR REPLACE FUNCTION admin_fcfs_filter_ids(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_audit_filter TEXT DEFAULT 'all',
  p_burst_start TIMESTAMPTZ DEFAULT NULL,
  p_burst_end TIMESTAMPTZ DEFAULT NULL,
  p_burst_windows JSONB DEFAULT NULL,
  p_x_handle_normalised TEXT DEFAULT NULL,
  p_hide_bursts BOOLEAN DEFAULT false,
  p_include_ids UUID[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := lower(trim(coalesce(p_search, '')));
  v_search_handle TEXT := lower(trim(replace(coalesce(p_search, ''), '@', '')));
  v_apply_hide BOOLEAN := coalesce(p_hide_bursts, false)
    AND p_burst_start IS NULL
    AND p_burst_end IS NULL
    AND (p_burst_windows IS NULL OR jsonb_array_length(p_burst_windows) = 0)
    AND coalesce(p_audit_filter, 'all') <> 'submission_burst';
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH burst_windows AS MATERIALIZED (
    SELECT bucket_start, bucket_end, application_count
    FROM admin_fcfs_burst_buckets(2, 5)
  ),
  explicit_windows AS (
    SELECT
      (w->>'start')::timestamptz AS bucket_start,
      (w->>'end')::timestamptz AS bucket_end
    FROM jsonb_array_elements(coalesce(p_burst_windows, '[]'::jsonb)) w
    WHERE (w->>'start') IS NOT NULL AND (w->>'end') IS NOT NULL
  ),
  matching AS (
    SELECT
      a.id,
      EXISTS (
        SELECT 1 FROM burst_windows bw
        WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
      ) AS in_burst
    FROM fcfs_applications a
    WHERE
      (p_include_ids IS NULL OR a.id = ANY(p_include_ids))
      AND (p_exclude_ids IS NULL OR NOT (a.id = ANY(p_exclude_ids)))
      AND (coalesce(p_status, 'all') = 'all' OR a.status::text = p_status)
      AND (
        v_search = ''
        OR a.wallet_address_normalised = v_search
        OR a.wallet_address_normalised ILIKE '%' || v_search || '%'
        OR a.x_handle_normalised = v_search_handle
        OR a.x_handle_normalised ILIKE '%' || v_search_handle || '%'
      )
      AND (
        coalesce(p_x_handle_normalised, '') = ''
        OR a.x_handle_normalised = lower(trim(replace(p_x_handle_normalised, '@', '')))
      )
      AND (
        (
          p_burst_windows IS NOT NULL
          AND jsonb_array_length(p_burst_windows) > 0
          AND EXISTS (
            SELECT 1 FROM explicit_windows ew
            WHERE a.submitted_at >= ew.bucket_start AND a.submitted_at < ew.bucket_end
          )
        )
        OR (
          (p_burst_windows IS NULL OR jsonb_array_length(p_burst_windows) = 0)
          AND (
            p_burst_start IS NULL
            OR p_burst_end IS NULL
            OR (a.submitted_at >= p_burst_start AND a.submitted_at < p_burst_end)
          )
        )
      )
      AND (
        coalesce(p_audit_filter, 'all') = 'all'
        OR (p_audit_filter = 'pending' AND a.status = 'pending')
        OR (p_audit_filter = 'approved' AND a.status = 'approved')
        OR (p_audit_filter = 'rejected' AND a.status = 'rejected')
        OR (p_audit_filter = 'manual_review' AND a.manual_review_flag = true)
        OR (p_audit_filter = 'already_on_whitelist' AND fcfs_wallet_on_whitelist(a.wallet_address_normalised))
        OR (
          p_audit_filter = 'no_flags'
          AND a.manual_review_flag = false
          AND NOT fcfs_is_invalid_wallet(a.wallet_address_normalised)
          AND NOT fcfs_is_malformed_x_handle(a.x_handle, a.x_handle_normalised)
          AND NOT EXISTS (
            SELECT 1 FROM fcfs_applications b
            WHERE b.x_handle_normalised = a.x_handle_normalised AND b.id <> a.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM burst_windows bw
            WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
          )
        )
        OR (
          p_audit_filter = 'flagged'
          AND (
            a.manual_review_flag = true
            OR fcfs_is_invalid_wallet(a.wallet_address_normalised)
            OR fcfs_is_malformed_x_handle(a.x_handle, a.x_handle_normalised)
            OR EXISTS (
              SELECT 1 FROM fcfs_applications b
              WHERE b.x_handle_normalised = a.x_handle_normalised AND b.id <> a.id
            )
            OR EXISTS (
              SELECT 1 FROM burst_windows bw
              WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
            )
          )
        )
        OR (
          p_audit_filter = 'duplicate_x_handle'
          AND EXISTS (
            SELECT 1 FROM fcfs_applications b
            WHERE b.x_handle_normalised = a.x_handle_normalised AND b.id <> a.id
          )
        )
        OR (
          p_audit_filter = 'duplicate_wallet'
          AND EXISTS (
            SELECT 1 FROM fcfs_applications b
            WHERE b.wallet_address_normalised = a.wallet_address_normalised AND b.id <> a.id
          )
        )
        OR (p_audit_filter = 'invalid_wallet' AND fcfs_is_invalid_wallet(a.wallet_address_normalised))
        OR (p_audit_filter = 'malformed_x_handle' AND fcfs_is_malformed_x_handle(a.x_handle, a.x_handle_normalised))
        OR (
          p_audit_filter = 'submission_burst'
          AND EXISTS (
            SELECT 1 FROM burst_windows bw
            WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
          )
        )
      )
  )
  SELECT m.id
  FROM matching m
  WHERE NOT v_apply_hide OR NOT m.in_burst;
END;
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_selection_count(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_audit_filter TEXT DEFAULT 'all',
  p_burst_start TIMESTAMPTZ DEFAULT NULL,
  p_burst_end TIMESTAMPTZ DEFAULT NULL,
  p_burst_windows JSONB DEFAULT NULL,
  p_x_handle_normalised TEXT DEFAULT NULL,
  p_hide_bursts BOOLEAN DEFAULT false,
  p_include_ids UUID[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count
  FROM admin_fcfs_filter_ids(
    p_search, p_status, p_audit_filter,
    p_burst_start, p_burst_end, p_burst_windows,
    p_x_handle_normalised, p_hide_bursts,
    p_include_ids, p_exclude_ids
  );

  RETURN jsonb_build_object('outcome', 'ok', 'count', coalesce(v_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_bulk_action(
  p_operation TEXT,
  p_selection_mode TEXT,
  p_expected_count INT DEFAULT NULL,
  p_ids UUID[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_audit_filter TEXT DEFAULT 'all',
  p_burst_start TIMESTAMPTZ DEFAULT NULL,
  p_burst_end TIMESTAMPTZ DEFAULT NULL,
  p_burst_windows JSONB DEFAULT NULL,
  p_x_handle_normalised TEXT DEFAULT NULL,
  p_hide_bursts BOOLEAN DEFAULT false,
  p_manual_review_reason TEXT DEFAULT NULL,
  p_selection_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count BIGINT;
  v_affected INT;
  v_admin UUID := auth.uid();
  v_selection_meta JSONB;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_selection_meta := jsonb_build_object(
    'selection_mode', p_selection_mode,
    'operation', p_operation,
    'selection_label', p_selection_label,
    'filter', jsonb_build_object(
      'search', p_search,
      'status', p_status,
      'audit_filter', p_audit_filter,
      'burst_start', p_burst_start,
      'burst_end', p_burst_end,
      'burst_windows', coalesce(p_burst_windows, '[]'::jsonb),
      'hide_bursts', coalesce(p_hide_bursts, false)
    ),
    'exclude_count', coalesce(array_length(p_exclude_ids, 1), 0)
  );

  IF p_selection_mode = 'ids' THEN
    IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
      RETURN jsonb_build_object('outcome', 'error', 'reason', 'no_ids');
    END IF;
    v_current_count := array_length(p_ids, 1);
  ELSE
    SELECT count(*) INTO v_current_count
    FROM admin_fcfs_filter_ids(
      p_search, p_status, p_audit_filter,
      p_burst_start, p_burst_end, p_burst_windows,
      p_x_handle_normalised, p_hide_bursts,
      NULL, p_exclude_ids
    );
  END IF;

  IF p_operation = 'delete' AND coalesce(p_expected_count, -1) <> v_current_count THEN
    RETURN jsonb_build_object(
      'outcome', 'count_changed',
      'expected', p_expected_count,
      'current', v_current_count
    );
  END IF;

  INSERT INTO audit_events (
    event_type, wallet_id, wallet_address_snapshot, admin_user_id, event_source, metadata
  ) VALUES (
    'fcfs_bulk_action_requested', NULL, NULL, v_admin, 'admin',
    v_selection_meta || jsonb_build_object('expected_count', v_current_count)
  );

  IF p_operation = 'delete' THEN
    IF p_selection_mode = 'ids' THEN
      DELETE FROM fcfs_applications WHERE id = ANY(p_ids);
    ELSE
      DELETE FROM fcfs_applications f
      WHERE f.id IN (
        SELECT id FROM admin_fcfs_filter_ids(
          p_search, p_status, p_audit_filter,
          p_burst_start, p_burst_end, p_burst_windows,
          p_x_handle_normalised, p_hide_bursts,
          NULL, p_exclude_ids
        )
      );
    END IF;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation = 'flag_review' THEN
    IF p_selection_mode = 'ids' THEN
      UPDATE fcfs_applications
      SET manual_review_flag = true,
          manual_review_reason = coalesce(p_manual_review_reason, 'OTHER')
      WHERE id = ANY(p_ids);
    ELSE
      UPDATE fcfs_applications f
      SET manual_review_flag = true,
          manual_review_reason = coalesce(p_manual_review_reason, 'OTHER')
      WHERE f.id IN (
        SELECT id FROM admin_fcfs_filter_ids(
          p_search, p_status, p_audit_filter,
          p_burst_start, p_burst_end, p_burst_windows,
          p_x_handle_normalised, p_hide_bursts,
          NULL, p_exclude_ids
        )
      );
    END IF;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation = 'clear_review' THEN
    IF p_selection_mode = 'ids' THEN
      UPDATE fcfs_applications
      SET manual_review_flag = false, manual_review_reason = NULL
      WHERE id = ANY(p_ids);
    ELSE
      UPDATE fcfs_applications f
      SET manual_review_flag = false, manual_review_reason = NULL
      WHERE f.id IN (
        SELECT id FROM admin_fcfs_filter_ids(
          p_search, p_status, p_audit_filter,
          p_burst_start, p_burst_end, p_burst_windows,
          p_x_handle_normalised, p_hide_bursts,
          NULL, p_exclude_ids
        )
      );
    END IF;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation IN ('approve', 'reject', 'pending') THEN
    IF p_selection_mode = 'ids' THEN
      UPDATE fcfs_applications
      SET status = p_operation::fcfs_application_status,
          reviewed_at = CASE WHEN p_operation = 'pending' THEN NULL ELSE v_now END,
          reviewed_by = CASE WHEN p_operation = 'pending' THEN NULL ELSE v_admin END
      WHERE id = ANY(p_ids);
    ELSE
      UPDATE fcfs_applications f
      SET status = p_operation::fcfs_application_status,
          reviewed_at = CASE WHEN p_operation = 'pending' THEN NULL ELSE v_now END,
          reviewed_by = CASE WHEN p_operation = 'pending' THEN NULL ELSE v_admin END
      WHERE f.id IN (
        SELECT id FROM admin_fcfs_filter_ids(
          p_search, p_status, p_audit_filter,
          p_burst_start, p_burst_end, p_burst_windows,
          p_x_handle_normalised, p_hide_bursts,
          NULL, p_exclude_ids
        )
      );
    END IF;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('outcome', 'error', 'reason', 'invalid_operation');
  END IF;

  INSERT INTO audit_events (
    event_type, wallet_id, wallet_address_snapshot, admin_user_id, event_source, metadata
  ) VALUES (
    'fcfs_bulk_action_completed', NULL, NULL, v_admin, 'admin',
    v_selection_meta || jsonb_build_object(
      'expected_count', v_current_count,
      'affected_count', v_affected
    )
  );

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'affected', v_affected,
    'expected', v_current_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_wl_filter_ids(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_active_state TEXT DEFAULT 'all',
  p_audit_filter TEXT DEFAULT 'all',
  p_source TEXT DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_include_ids UUID[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := lower(trim(coalesce(p_search, '')));
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT w.id
  FROM whitelist_wallets w
  WHERE
    (p_include_ids IS NULL OR w.id = ANY(p_include_ids))
    AND (p_exclude_ids IS NULL OR NOT (w.id = ANY(p_exclude_ids)))
    AND (coalesce(p_status, 'all') = 'all' OR w.status::text = p_status)
    AND (
      coalesce(p_active_state, 'all') = 'all'
      OR (p_active_state = 'active' AND w.is_active = true AND w.status <> 'removed')
      OR (p_active_state = 'inactive' AND (w.is_active = false OR w.status = 'removed'))
    )
    AND (
      v_search = ''
      OR w.wallet_address_normalised = v_search
      OR w.wallet_address_normalised ILIKE '%' || v_search || '%'
    )
    AND (p_source IS NULL OR w.source = p_source)
    AND (p_batch_id IS NULL OR w.import_batch_id = p_batch_id)
    AND (
      coalesce(p_audit_filter, 'all') = 'all'
      OR (p_audit_filter = 'also_in_fcfs' AND fcfs_wallet_on_whitelist(w.wallet_address_normalised))
      OR (
        p_audit_filter = 'duplicate_wallet'
        AND EXISTS (
          SELECT 1 FROM whitelist_wallets b
          WHERE b.wallet_address_normalised = w.wallet_address_normalised AND b.id <> w.id
        )
      )
      OR (p_audit_filter = 'manual_review' AND w.status = 'needs_review')
      OR (
        p_audit_filter = 'clean'
        AND w.status <> 'needs_review'
        AND NOT fcfs_wallet_on_whitelist(w.wallet_address_normalised)
        AND NOT EXISTS (
          SELECT 1 FROM whitelist_wallets b
          WHERE b.wallet_address_normalised = w.wallet_address_normalised AND b.id <> w.id
        )
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_wl_selection_count(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_active_state TEXT DEFAULT 'all',
  p_audit_filter TEXT DEFAULT 'all',
  p_source TEXT DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_include_ids UUID[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count
  FROM admin_wl_filter_ids(
    p_search, p_status, p_active_state, p_audit_filter,
    p_source, p_batch_id, p_include_ids, p_exclude_ids
  );
  RETURN jsonb_build_object('outcome', 'ok', 'count', coalesce(v_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION admin_wl_bulk_action(
  p_operation TEXT,
  p_selection_mode TEXT,
  p_expected_count INT DEFAULT NULL,
  p_ids UUID[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_active_state TEXT DEFAULT 'all',
  p_audit_filter TEXT DEFAULT 'all',
  p_source TEXT DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_selection_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count BIGINT;
  v_affected INT;
  v_admin UUID := auth.uid();
  v_meta JSONB;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_meta := jsonb_build_object(
    'selection_mode', p_selection_mode,
    'operation', p_operation,
    'selection_label', p_selection_label,
    'filter', jsonb_build_object(
      'search', p_search,
      'status', p_status,
      'active_state', p_active_state,
      'audit_filter', p_audit_filter
    )
  );

  IF p_selection_mode = 'ids' THEN
    v_current_count := coalesce(array_length(p_ids, 1), 0);
  ELSE
    SELECT count(*) INTO v_current_count
    FROM admin_wl_filter_ids(
      p_search, p_status, p_active_state, p_audit_filter,
      p_source, p_batch_id, NULL, p_exclude_ids
    );
  END IF;

  IF p_operation = 'delete' AND coalesce(p_expected_count, -1) <> v_current_count THEN
    RETURN jsonb_build_object(
      'outcome', 'count_changed',
      'expected', p_expected_count,
      'current', v_current_count
    );
  END IF;

  INSERT INTO audit_events (
    event_type, wallet_id, wallet_address_snapshot, admin_user_id, event_source, metadata
  ) VALUES (
    'wl_bulk_action_requested', NULL, NULL, v_admin, 'admin',
    v_meta || jsonb_build_object('expected_count', v_current_count)
  );

  IF p_operation = 'flag_review' THEN
    UPDATE whitelist_wallets w
    SET status = 'needs_review', updated_at = now(), updated_by = v_admin
    WHERE w.id IN (
      SELECT id FROM admin_wl_filter_ids(
        p_search, p_status, p_active_state, p_audit_filter,
        p_source, p_batch_id,
        CASE WHEN p_selection_mode = 'ids' THEN p_ids ELSE NULL END,
        p_exclude_ids
      )
    );
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation = 'clear_review' THEN
    UPDATE whitelist_wallets w
    SET status = CASE WHEN w.confirmed_at IS NOT NULL THEN 'confirmed'::wallet_status ELSE 'unconfirmed'::wallet_status END,
        updated_at = now(), updated_by = v_admin
    WHERE w.id IN (
      SELECT id FROM admin_wl_filter_ids(
        p_search, p_status, p_active_state, p_audit_filter,
        p_source, p_batch_id,
        CASE WHEN p_selection_mode = 'ids' THEN p_ids ELSE NULL END,
        p_exclude_ids
      )
    ) AND w.status = 'needs_review';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation = 'activate' THEN
    UPDATE whitelist_wallets w
    SET is_active = true, status = CASE WHEN w.status = 'removed' THEN 'unconfirmed'::wallet_status ELSE w.status END,
        updated_at = now(), updated_by = v_admin
    WHERE w.id IN (
      SELECT id FROM admin_wl_filter_ids(
        p_search, p_status, p_active_state, p_audit_filter,
        p_source, p_batch_id,
        CASE WHEN p_selection_mode = 'ids' THEN p_ids ELSE NULL END,
        p_exclude_ids
      )
    );
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation = 'deactivate' THEN
    UPDATE whitelist_wallets w
    SET is_active = false, status = 'removed', updated_at = now(), updated_by = v_admin
    WHERE w.id IN (
      SELECT id FROM admin_wl_filter_ids(
        p_search, p_status, p_active_state, p_audit_filter,
        p_source, p_batch_id,
        CASE WHEN p_selection_mode = 'ids' THEN p_ids ELSE NULL END,
        p_exclude_ids
      )
    );
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSIF p_operation = 'delete' THEN
    UPDATE whitelist_wallets w
    SET is_active = false, status = 'removed', updated_at = now(), updated_by = v_admin
    WHERE w.id IN (
      SELECT id FROM admin_wl_filter_ids(
        p_search, p_status, p_active_state, p_audit_filter,
        p_source, p_batch_id,
        CASE WHEN p_selection_mode = 'ids' THEN p_ids ELSE NULL END,
        p_exclude_ids
      )
    );
    GET DIAGNOSTICS v_affected = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('outcome', 'error', 'reason', 'invalid_operation');
  END IF;

  INSERT INTO audit_events (
    event_type, wallet_id, wallet_address_snapshot, admin_user_id, event_source, metadata
  ) VALUES (
    'wl_bulk_action_completed', NULL, NULL, v_admin, 'admin',
    v_meta || jsonb_build_object('affected_count', v_affected)
  );

  RETURN jsonb_build_object('outcome', 'ok', 'affected', v_affected);
END;
$$;

CREATE OR REPLACE FUNCTION admin_wl_pre_insert_audit(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm TEXT := lower(trim(coalesce(p_wallet, '')));
  v_wl whitelist_wallets%ROWTYPE;
  v_fcfs fcfs_applications%ROWTYPE;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_norm = '' OR v_norm !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_wallet');
  END IF;

  SELECT * INTO v_wl FROM whitelist_wallets WHERE wallet_address_normalised = v_norm LIMIT 1;
  SELECT * INTO v_fcfs FROM fcfs_applications WHERE wallet_address_normalised = v_norm LIMIT 1;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'wallet_address_normalised', v_norm,
    'whitelist', jsonb_build_object(
      'exists', v_wl.id IS NOT NULL,
      'status', v_wl.status,
      'is_active', coalesce(v_wl.is_active, false)
    ),
    'fcfs', jsonb_build_object(
      'exists', v_fcfs.id IS NOT NULL,
      'status', v_fcfs.status,
      'x_handle', v_fcfs.x_handle
    ),
    'crossover', jsonb_build_object(
      'valid_crossover', v_wl.id IS NULL AND v_fcfs.id IS NOT NULL,
      'blocked_duplicate_wl', v_wl.id IS NOT NULL
    ),
    'can_insert', v_wl.id IS NULL
  );
END;
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
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_wallet = '' OR v_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_wallet');
  END IF;

  IF v_handle = '' OR v_handle !~ '^[a-z0-9_]{1,15}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_handle');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM whitelist_wallets
    WHERE wallet_address_normalised = v_wallet AND is_active AND status <> 'removed'
  ) INTO v_wl_exists;

  SELECT * INTO v_fcfs_wallet FROM fcfs_applications WHERE wallet_address_normalised = v_wallet LIMIT 1;
  SELECT * INTO v_fcfs_handle FROM fcfs_applications WHERE x_handle_normalised = v_handle LIMIT 1;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'wallet_address_normalised', v_wallet,
    'x_handle_normalised', v_handle,
    'whitelist', jsonb_build_object('exists', v_wl_exists),
    'fcfs_wallet', jsonb_build_object(
      'exists', v_fcfs_wallet.id IS NOT NULL,
      'status', v_fcfs_wallet.status
    ),
    'fcfs_handle', jsonb_build_object(
      'exists', v_fcfs_handle.id IS NOT NULL,
      'wallet', v_fcfs_handle.wallet_address_normalised
    ),
    'crossover', jsonb_build_object(
      'valid_crossover', v_wl_exists AND v_fcfs_wallet.id IS NULL
    ),
    'can_insert', v_fcfs_wallet.id IS NULL AND v_fcfs_handle.id IS NULL
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
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_audit := admin_fcfs_pre_insert_audit(p_wallet, p_x_handle);
  IF (v_audit->>'outcome') <> 'ok' OR NOT (v_audit->>'can_insert')::boolean THEN
    RETURN jsonb_build_object('outcome', 'blocked', 'audit', v_audit);
  END IF;

  INSERT INTO fcfs_applications (
    wallet_address, wallet_address_normalised,
    x_handle, x_handle_normalised,
    submitted_at, follow_opened_at, follow_confirmed_at,
    share_opened_at, share_confirmed_at,
    status, internal_notes, reviewed_at, reviewed_by
  ) VALUES (
    p_wallet, lower(trim(p_wallet)),
    '@' || (v_audit->>'x_handle_normalised'),
    v_audit->>'x_handle_normalised',
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
    jsonb_build_object('application_id', v_row.id, 'status', v_row.status, 'x_handle', v_row.x_handle)
  );

  RETURN jsonb_build_object('outcome', 'ok', 'application', to_jsonb(v_row));
END;
$$;

-- Extend admin_fcfs_list with multi-burst windows
CREATE OR REPLACE FUNCTION admin_fcfs_list(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_sort TEXT DEFAULT 'submitted_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_audit_filter TEXT DEFAULT 'all',
  p_burst_start TIMESTAMPTZ DEFAULT NULL,
  p_burst_end TIMESTAMPTZ DEFAULT NULL,
  p_x_handle_normalised TEXT DEFAULT NULL,
  p_hide_bursts BOOLEAN DEFAULT false,
  p_burst_windows JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := greatest(coalesce(p_page, 1), 1);
  v_page_size INT := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total BIGINT;
  v_burst_hidden BIGINT := 0;
  v_rows JSONB;
  v_sort_col TEXT;
  v_sort_asc BOOLEAN := lower(coalesce(p_sort_dir, 'desc')) = 'asc';
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_sort_col := CASE lower(coalesce(p_sort, 'submitted_at'))
    WHEN 'x_handle' THEN 'x_handle_normalised'
    WHEN 'wallet' THEN 'wallet_address_normalised'
    WHEN 'status' THEN 'status'
    WHEN 'updated_at' THEN 'updated_at'
    ELSE 'submitted_at'
  END;

  WITH burst_windows AS MATERIALIZED (
    SELECT bucket_start, bucket_end, application_count
    FROM admin_fcfs_burst_buckets(2, 5)
  ),
  filtered AS (
    SELECT a.*,
      EXISTS (
        SELECT 1 FROM burst_windows bw
        WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
      ) AS in_burst
    FROM fcfs_applications a
    WHERE a.id IN (
      SELECT id FROM admin_fcfs_filter_ids(
        p_search, p_status, p_audit_filter,
        p_burst_start, p_burst_end, p_burst_windows,
        p_x_handle_normalised, false, NULL, NULL
      )
    )
    AND (
      NOT coalesce(p_hide_bursts, false)
      OR p_burst_start IS NOT NULL
      OR p_burst_end IS NOT NULL
      OR (p_burst_windows IS NOT NULL AND jsonb_array_length(p_burst_windows) > 0)
      OR coalesce(p_audit_filter, 'all') = 'submission_burst'
      OR NOT EXISTS (
        SELECT 1 FROM burst_windows bw
        WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
      )
    )
  ),
  counted AS (SELECT count(*) AS total FROM filtered),
  paged AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN v_sort_col = 'submitted_at' AND v_sort_asc THEN submitted_at END ASC,
      CASE WHEN v_sort_col = 'submitted_at' AND NOT v_sort_asc THEN submitted_at END DESC,
      CASE WHEN v_sort_col = 'updated_at' AND v_sort_asc THEN updated_at END ASC,
      CASE WHEN v_sort_col = 'updated_at' AND NOT v_sort_asc THEN updated_at END DESC,
      CASE WHEN v_sort_col = 'x_handle_normalised' AND v_sort_asc THEN x_handle_normalised END ASC,
      CASE WHEN v_sort_col = 'x_handle_normalised' AND NOT v_sort_asc THEN x_handle_normalised END DESC,
      CASE WHEN v_sort_col = 'wallet_address_normalised' AND v_sort_asc THEN wallet_address_normalised END ASC,
      CASE WHEN v_sort_col = 'wallet_address_normalised' AND NOT v_sort_asc THEN wallet_address_normalised END DESC,
      CASE WHEN v_sort_col = 'status' AND v_sort_asc THEN status END ASC,
      CASE WHEN v_sort_col = 'status' AND NOT v_sort_asc THEN status END DESC,
      id ASC
    OFFSET v_offset LIMIT v_page_size
  )
  SELECT counted.total,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'application', to_jsonb(p) - 'in_burst',
        'audit_flags', (
          SELECT coalesce(jsonb_agg(flag), '[]'::jsonb)
          FROM (
            SELECT 'manual_review' AS flag WHERE p.manual_review_flag
            UNION ALL
            SELECT 'duplicate_x_handle' WHERE EXISTS (
              SELECT 1 FROM fcfs_applications b
              WHERE b.x_handle_normalised = p.x_handle_normalised AND b.id <> p.id
            )
            UNION ALL
            SELECT 'already_on_whitelist' WHERE fcfs_wallet_on_whitelist(p.wallet_address_normalised)
            UNION ALL
            SELECT 'submission_burst' WHERE p.in_burst
          ) flags(flag)
        ),
        'duplicate_x_handle_count', (
          SELECT count(*)::int FROM fcfs_applications b
          WHERE b.x_handle_normalised = p.x_handle_normalised
        ),
        'same_burst_count', 0,
        'already_on_whitelist', fcfs_wallet_on_whitelist(p.wallet_address_normalised)
      )
    ), '[]'::jsonb)
  INTO v_total, v_rows
  FROM counted LEFT JOIN paged p ON true GROUP BY counted.total;

  RETURN jsonb_build_object(
    'applications', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'burst_hidden_count', v_burst_hidden,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_burst_windows(
  p_window_minutes INT DEFAULT 5,
  p_min_count INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_rows
  FROM (
    WITH burst_windows AS MATERIALIZED (
      SELECT bucket_start, bucket_end, application_count
      FROM admin_fcfs_burst_buckets(
        greatest(coalesce(p_window_minutes, 5), 1),
        greatest(coalesce(p_min_count, 5), 2)
      )
    )
    SELECT
      bw.bucket_start,
      bw.bucket_end,
      bw.application_count,
      count(DISTINCT a.wallet_address_normalised) AS unique_wallets,
      count(DISTINCT a.x_handle_normalised) AS unique_handles,
      count(*) FILTER (WHERE a.manual_review_flag) AS flagged_count,
      count(*) FILTER (WHERE a.status = 'pending') AS pending_count,
      count(*) FILTER (WHERE a.status = 'approved') AS approved_count,
      count(*) FILTER (WHERE a.status = 'rejected') AS rejected_count
    FROM burst_windows bw
    LEFT JOIN fcfs_applications a
      ON a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
    GROUP BY bw.bucket_start, bw.bucket_end, bw.application_count
    ORDER BY bw.application_count DESC, bw.bucket_start DESC
  ) t;

  RETURN jsonb_build_object('windows', coalesce(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_cross_list_fcfs_handles(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_view TEXT DEFAULT 'duplicates'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := greatest(coalesce(p_page, 1), 1);
  v_page_size INT := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total BIGINT;
  v_rows JSONB;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH grouped AS (
    SELECT
      x_handle_normalised,
      count(*) AS record_count,
      count(DISTINCT wallet_address_normalised) AS wallet_count,
      string_agg(DISTINCT wallet_address_normalised, ', ' ORDER BY wallet_address_normalised) AS wallets,
      string_agg(DISTINCT x_handle, ', ' ORDER BY x_handle) AS handles
    FROM fcfs_applications
    GROUP BY x_handle_normalised
    HAVING
      p_view = 'all'
      OR (p_view = 'duplicates' AND count(*) > 1)
      OR (p_view = 'conflicts' AND count(DISTINCT wallet_address_normalised) > 1)
      OR (p_view = 'clean' AND count(*) = 1)
  ),
  counted AS (SELECT count(*) AS total FROM grouped),
  paged AS (
    SELECT * FROM grouped ORDER BY record_count DESC, x_handle_normalised ASC
    OFFSET v_offset LIMIT v_page_size
  )
  SELECT counted.total,
    coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM counted LEFT JOIN paged p ON true GROUP BY counted.total;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'wl_handles_available', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_filter_ids(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_selection_count(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_bulk_action(TEXT, TEXT, INT, UUID[], UUID[], TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wl_filter_ids(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wl_selection_count(TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wl_bulk_action(TEXT, TEXT, INT, UUID[], UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wl_pre_insert_audit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_pre_insert_audit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_create_manual(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_list(INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_cross_list_fcfs_handles(INT, INT, TEXT) TO authenticated;

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
      ELSIF v_handle = '' OR v_handle !~ '^[a-z0-9_]{1,15}$' THEN
        v_category := 'invalid_handle';
      ELSIF EXISTS (SELECT 1 FROM fcfs_applications WHERE wallet_address_normalised = v_wallet) THEN
        v_category := 'already_in_fcfs';
      ELSIF EXISTS (SELECT 1 FROM fcfs_applications WHERE x_handle_normalised = v_handle) THEN
        v_category := 'handle_conflict';
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
        WHERE (
          lower(trim(r.value->>'wallet')) = v_wallet
          OR lower(trim(replace(r.value->>'x_handle', '@', ''))) = v_handle
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
      INSERT INTO fcfs_applications (
        wallet_address, wallet_address_normalised,
        x_handle, x_handle_normalised,
        submitted_at, follow_opened_at, follow_confirmed_at,
        share_opened_at, share_confirmed_at,
        status, internal_notes
      ) VALUES (
        v_row->>'wallet', lower(trim(v_row->>'wallet')),
        '@' || lower(trim(replace(v_row->>'x_handle', '@', ''))),
        lower(trim(replace(v_row->>'x_handle', '@', ''))),
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

CREATE OR REPLACE FUNCTION admin_clearance_export_v2(
  p_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_export_type TEXT := coalesce(p_config->>'export_type', 'combined_mint_ready');
  v_rows JSONB;
  v_total BIGINT;
  v_unique BIGINT;
  v_dupes BIGINT;
  v_mint_ready BOOLEAN := v_export_type LIKE '%mint_ready%';
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_export_type IN ('current_filter_fcfs', 'flagged_fcfs') THEN
    SELECT count(*),
      coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.submitted_at DESC), '[]'::jsonb)
    INTO v_total, v_rows
    FROM fcfs_applications f
    WHERE f.id IN (
      SELECT id FROM admin_fcfs_filter_ids(
        p_config->>'search', coalesce(p_config->>'status', 'all'),
        CASE WHEN v_export_type = 'flagged_fcfs' THEN 'flagged' ELSE coalesce(p_config->>'audit_filter', 'all') END,
        (p_config->>'burst_start')::timestamptz,
        (p_config->>'burst_end')::timestamptz,
        p_config->'burst_windows',
        p_config->>'x_handle_normalised',
        coalesce((p_config->>'hide_bursts')::boolean, false),
        NULL, NULL
      )
    );
  ELSIF v_export_type = 'wl_mint_ready' THEN
    SELECT count(*),
      coalesce(jsonb_agg(jsonb_build_object(
        'wallet_address', w.wallet_address,
        'wallet_address_normalised', w.wallet_address_normalised,
        'wl_mint_allowance', 1,
        'mint_price_eth', 0.003
      ) ORDER BY w.wallet_address_normalised), '[]'::jsonb)
    INTO v_total, v_rows
    FROM whitelist_wallets w
    WHERE w.is_active AND w.status <> 'removed';
  ELSIF v_export_type = 'wl_admin_full' THEN
    SELECT count(*), coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
    INTO v_total, v_rows
    FROM whitelist_wallets w;
  ELSIF v_export_type = 'fcfs_approved_mint_ready' THEN
    SELECT count(*),
      coalesce(jsonb_agg(jsonb_build_object(
        'wallet_address', f.wallet_address,
        'wallet_address_normalised', f.wallet_address_normalised,
        'x_handle', f.x_handle,
        'fcfs_mint_allowance', 2,
        'mint_price_eth', 0.003
      ) ORDER BY f.wallet_address_normalised), '[]'::jsonb)
    INTO v_total, v_rows
    FROM fcfs_applications f WHERE f.status = 'approved';
  ELSIF v_export_type = 'fcfs_admin_all' THEN
    SELECT count(*), coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
    INTO v_total, v_rows FROM fcfs_applications f;
  ELSE
    RETURN (SELECT admin_clearance_export(
      CASE v_export_type
        WHEN 'combined_mint_ready' THEN 'combined_mint_ready'
        WHEN 'whitelist_only' THEN 'whitelist_only'
        ELSE 'fcfs_approved_only'
      END
    ));
  END IF;

  IF v_mint_ready AND v_rows IS NOT NULL THEN
    SELECT count(*) - count(DISTINCT r.value->>'wallet_address_normalised')
    INTO v_dupes
    FROM jsonb_array_elements(v_rows) r;
    IF v_dupes > 0 THEN
      RETURN jsonb_build_object(
        'outcome', 'integrity_error',
        'reason', 'duplicate_wallet_detected',
        'duplicate_count', v_dupes
      );
    END IF;
  END IF;

  SELECT count(DISTINCT r.value->>'wallet_address_normalised')
  INTO v_unique
  FROM jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) r;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'export_type', v_export_type,
    'total', coalesce(v_total, 0),
    'unique_wallets', coalesce(v_unique, 0),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_clearance_import_preview(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_import_commit(TEXT, JSONB, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_export_v2(JSONB) TO authenticated;
