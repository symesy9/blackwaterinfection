-- Fix admin_fcfs_bulk_action: map approve/reject to approved/rejected enum values

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
  v_target_status fcfs_application_status;
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
    v_target_status := CASE p_operation
      WHEN 'approve' THEN 'approved'::fcfs_application_status
      WHEN 'reject' THEN 'rejected'::fcfs_application_status
      ELSE 'pending'::fcfs_application_status
    END;

    IF p_selection_mode = 'ids' THEN
      UPDATE fcfs_applications
      SET status = v_target_status,
          reviewed_at = CASE WHEN p_operation = 'pending' THEN NULL ELSE v_now END,
          reviewed_by = CASE WHEN p_operation = 'pending' THEN NULL ELSE v_admin END
      WHERE id = ANY(p_ids);
    ELSE
      UPDATE fcfs_applications f
      SET status = v_target_status,
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

GRANT EXECUTE ON FUNCTION admin_fcfs_bulk_action(TEXT, TEXT, INT, UUID[], UUID[], TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;
