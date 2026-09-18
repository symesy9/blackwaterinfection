-- Final pre-deploy hardening: unique burst selection count, WL delete revalidation

CREATE OR REPLACE FUNCTION admin_fcfs_burst_selection_count(
  p_burst_windows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_burst_windows IS NULL OR jsonb_array_length(p_burst_windows) = 0 THEN
    RETURN jsonb_build_object('outcome', 'error', 'reason', 'no_burst_windows');
  END IF;

  SELECT count(*) INTO v_count
  FROM admin_fcfs_filter_ids(
    NULL,
    'all',
    'all',
    NULL,
    NULL,
    p_burst_windows,
    NULL,
    false,
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'count', coalesce(v_count, 0),
    'unique_applications', coalesce(v_count, 0)
  );
END;
$$;

-- Ensure WL bulk delete revalidates count (explicit guard)
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
    'dataset', 'whitelist',
    'filter', jsonb_build_object(
      'search', p_search,
      'status', p_status,
      'active_state', p_active_state,
      'audit_filter', p_audit_filter
    ),
    'exclude_count', coalesce(array_length(p_exclude_ids, 1), 0)
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
  ELSIF p_operation IN ('deactivate', 'delete') THEN
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
    v_meta || jsonb_build_object(
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

GRANT EXECUTE ON FUNCTION admin_fcfs_burst_selection_count(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wl_bulk_action(TEXT, TEXT, INT, UUID[], UUID[], TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
