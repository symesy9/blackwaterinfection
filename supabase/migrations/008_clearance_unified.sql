-- Unified WL + FCFS clearance admin RPCs

CREATE OR REPLACE FUNCTION admin_clearance_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wl_total BIGINT;
  v_wl_active BIGINT;
  v_fcfs_total BIGINT;
  v_fcfs_pending BIGINT;
  v_fcfs_approved BIGINT;
  v_fcfs_rejected BIGINT;
  v_fcfs_flagged BIGINT;
  v_crossover BIGINT;
  v_wl_only BIGINT;
  v_fcfs_only BIGINT;
  v_dup_fcfs_handle_groups BIGINT;
  v_identity_conflicts BIGINT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_wl_total FROM whitelist_wallets;
  SELECT count(*) INTO v_wl_active
  FROM whitelist_wallets
  WHERE is_active = true AND status <> 'removed';

  SELECT count(*) INTO v_fcfs_total FROM fcfs_applications;
  SELECT count(*) INTO v_fcfs_pending FROM fcfs_applications WHERE status = 'pending';
  SELECT count(*) INTO v_fcfs_approved FROM fcfs_applications WHERE status = 'approved';
  SELECT count(*) INTO v_fcfs_rejected FROM fcfs_applications WHERE status = 'rejected';
  SELECT count(*) INTO v_fcfs_flagged FROM fcfs_applications WHERE manual_review_flag = true;

  SELECT count(*) INTO v_crossover
  FROM fcfs_applications f
  WHERE fcfs_wallet_on_whitelist(f.wallet_address_normalised);

  SELECT count(*) INTO v_wl_only
  FROM whitelist_wallets w
  WHERE w.is_active = true
    AND w.status <> 'removed'
    AND NOT EXISTS (
      SELECT 1 FROM fcfs_applications f
      WHERE f.wallet_address_normalised = w.wallet_address_normalised
    );

  SELECT count(*) INTO v_fcfs_only
  FROM fcfs_applications f
  WHERE NOT fcfs_wallet_on_whitelist(f.wallet_address_normalised);

  SELECT count(*) INTO v_dup_fcfs_handle_groups
  FROM (
    SELECT x_handle_normalised
    FROM fcfs_applications
    GROUP BY x_handle_normalised
    HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_identity_conflicts
  FROM (
    SELECT x_handle_normalised
    FROM fcfs_applications
    GROUP BY x_handle_normalised
    HAVING count(DISTINCT wallet_address_normalised) > 1
  ) c;

  RETURN jsonb_build_object(
    'whitelist', jsonb_build_object(
      'total', v_wl_total,
      'active', v_wl_active
    ),
    'fcfs', jsonb_build_object(
      'total', v_fcfs_total,
      'pending', v_fcfs_pending,
      'approved', v_fcfs_approved,
      'rejected', v_fcfs_rejected,
      'flagged', v_fcfs_flagged
    ),
    'combined', jsonb_build_object(
      'wallet_crossover', v_crossover,
      'wl_only', v_wl_only,
      'fcfs_only', v_fcfs_only,
      'unique_wallets', (
        SELECT count(*) FROM (
          SELECT wallet_address_normalised FROM whitelist_wallets WHERE is_active AND status <> 'removed'
          UNION
          SELECT wallet_address_normalised FROM fcfs_applications
        ) u
      )
    ),
    'security', jsonb_build_object(
      'duplicate_fcfs_handle_groups', v_dup_fcfs_handle_groups,
      'identity_conflicts', v_identity_conflicts
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_wl_list(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_active_state TEXT DEFAULT 'all',
  p_sort TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_audit_filter TEXT DEFAULT 'all',
  p_source TEXT DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL
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
  v_sort_col TEXT;
  v_sort_asc BOOLEAN := lower(coalesce(p_sort_dir, 'desc')) = 'asc';
  v_search TEXT := lower(trim(coalesce(p_search, '')));
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_sort_col := CASE lower(coalesce(p_sort, 'created_at'))
    WHEN 'wallet' THEN 'wallet_address_normalised'
    WHEN 'status' THEN 'status'
    WHEN 'confirmed_at' THEN 'confirmed_at'
    ELSE 'created_at'
  END;

  WITH matching AS (
    SELECT w.*
    FROM whitelist_wallets w
    WHERE
      (coalesce(p_status, 'all') = 'all' OR w.status::text = p_status)
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
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM matching
  ),
  paged AS (
    SELECT *
    FROM matching
    ORDER BY
      CASE WHEN v_sort_col = 'created_at' AND v_sort_asc THEN created_at END ASC,
      CASE WHEN v_sort_col = 'created_at' AND NOT v_sort_asc THEN created_at END DESC,
      CASE WHEN v_sort_col = 'confirmed_at' AND v_sort_asc THEN confirmed_at END ASC NULLS LAST,
      CASE WHEN v_sort_col = 'confirmed_at' AND NOT v_sort_asc THEN confirmed_at END DESC NULLS LAST,
      CASE WHEN v_sort_col = 'wallet_address_normalised' AND v_sort_asc THEN wallet_address_normalised END ASC,
      CASE WHEN v_sort_col = 'wallet_address_normalised' AND NOT v_sort_asc THEN wallet_address_normalised END DESC,
      CASE WHEN v_sort_col = 'status' AND v_sort_asc THEN status END ASC,
      CASE WHEN v_sort_col = 'status' AND NOT v_sort_asc THEN status END DESC,
      id ASC
    OFFSET v_offset
    LIMIT v_page_size
  )
  SELECT counted.total,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'wallet', to_jsonb(p.*),
          'audit_flags', (
            SELECT coalesce(jsonb_agg(flag), '[]'::jsonb)
            FROM (
              SELECT 'duplicate_wl_wallet' AS flag
              WHERE EXISTS (
                SELECT 1 FROM whitelist_wallets b
                WHERE b.wallet_address_normalised = p.wallet_address_normalised AND b.id <> p.id
              )
              UNION ALL
              SELECT 'also_in_fcfs'
              WHERE fcfs_wallet_on_whitelist(p.wallet_address_normalised)
              UNION ALL
              SELECT 'manual_review'
              WHERE p.status = 'needs_review'
            ) flags(flag)
          ),
          'also_in_fcfs', fcfs_wallet_on_whitelist(p.wallet_address_normalised)
        )
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows
  FROM counted
  LEFT JOIN paged p ON true
  GROUP BY counted.total;

  RETURN jsonb_build_object(
    'wallets', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_cross_list_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT admin_clearance_overview()
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_cross_list_wallets(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_view TEXT DEFAULT 'crossover'
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

  WITH wallets AS (
    SELECT wallet_address_normalised FROM whitelist_wallets WHERE is_active AND status <> 'removed'
    UNION
    SELECT wallet_address_normalised FROM fcfs_applications
  ),
  base AS (
    SELECT
      w.wallet_address_normalised,
      (SELECT count(*)::int FROM whitelist_wallets wl
        WHERE wl.wallet_address_normalised = w.wallet_address_normalised
          AND wl.is_active AND wl.status <> 'removed') AS wl_records,
      (SELECT count(*)::int FROM fcfs_applications f
        WHERE f.wallet_address_normalised = w.wallet_address_normalised) AS fcfs_records,
      (SELECT wl.status::text FROM whitelist_wallets wl
        WHERE wl.wallet_address_normalised = w.wallet_address_normalised
          AND wl.is_active AND wl.status <> 'removed'
        LIMIT 1) AS wl_status,
      (SELECT f.status::text FROM fcfs_applications f
        WHERE f.wallet_address_normalised = w.wallet_address_normalised
        ORDER BY f.submitted_at DESC LIMIT 1) AS fcfs_status,
      (SELECT string_agg(DISTINCT f.x_handle, ', ' ORDER BY f.x_handle)
        FROM fcfs_applications f
        WHERE f.wallet_address_normalised = w.wallet_address_normalised) AS fcfs_handles
    FROM wallets w
  ),
  enriched AS (
    SELECT
      b.*,
      (b.wl_records > 0 AND b.fcfs_records > 0) AS is_crossover,
      (b.wl_records > 1 OR b.fcfs_records > 1) AS has_within_dataset_duplicate
    FROM base b
  ),
  filtered AS (
    SELECT *
    FROM enriched e
    WHERE
      coalesce(p_view, 'crossover') = 'all'
      OR (p_view = 'crossover' AND e.is_crossover)
      OR (p_view = 'wl_only' AND e.wl_records > 0 AND e.fcfs_records = 0)
      OR (p_view = 'fcfs_only' AND e.fcfs_records > 0 AND e.wl_records = 0)
      OR (p_view = 'duplicates' AND e.has_within_dataset_duplicate)
      OR (p_view = 'clean' AND NOT e.has_within_dataset_duplicate AND NOT e.is_crossover)
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY wallet_address_normalised ASC
    OFFSET v_offset
    LIMIT v_page_size
  )
  SELECT counted.total,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'wallet_address_normalised', p.wallet_address_normalised,
          'wl_records', p.wl_records,
          'fcfs_records', p.fcfs_records,
          'wl_status', p.wl_status,
          'fcfs_status', p.fcfs_status,
          'fcfs_handles', p.fcfs_handles,
          'is_crossover', p.is_crossover,
          'entitlement', CASE
            WHEN p.wl_records > 0 AND p.fcfs_records > 0 THEN 'WL + FCFS'
            WHEN p.wl_records > 0 THEN 'WL only'
            WHEN p.fcfs_records > 0 THEN 'FCFS only'
            ELSE 'None'
          END,
          'audit_flags', (
            SELECT coalesce(jsonb_agg(flag), '[]'::jsonb)
            FROM (
              SELECT 'cross_list_wallet' AS flag WHERE p.is_crossover
              UNION ALL
              SELECT 'duplicate_wl_wallet' WHERE p.wl_records > 1
              UNION ALL
              SELECT 'duplicate_fcfs_wallet' WHERE p.fcfs_records > 1
            ) flags(flag)
          )
        )
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows
  FROM counted
  LEFT JOIN paged p ON true
  GROUP BY counted.total;

  RETURN jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_handle_lookup(p_handle TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalised TEXT;
  v_fcfs JSONB;
  v_conflict BOOLEAN;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_normalised := lower(trim(replace(coalesce(p_handle, ''), '@', '')));

  IF v_normalised = '' OR v_normalised !~ '^[a-z0-9_]{1,15}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_handle');
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'application', to_jsonb(f.*),
      'on_whitelist', fcfs_wallet_on_whitelist(f.wallet_address_normalised)
    ) ORDER BY f.submitted_at DESC
  ), '[]'::jsonb)
  INTO v_fcfs
  FROM fcfs_applications f
  WHERE f.x_handle_normalised = v_normalised;

  SELECT count(DISTINCT wallet_address_normalised) > 1
  INTO v_conflict
  FROM fcfs_applications
  WHERE x_handle_normalised = v_normalised;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'x_handle_normalised', v_normalised,
    'fcfs_applications', v_fcfs,
    'identity_conflict', coalesce(v_conflict, false),
    'wl_records', '[]'::jsonb
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
    ),
    apps AS (
      SELECT
        f.*,
        bw.bucket_start,
        bw.bucket_end
      FROM fcfs_applications f
      JOIN burst_windows bw
        ON f.submitted_at >= bw.bucket_start
       AND f.submitted_at < bw.bucket_end
    )
    SELECT
      bw.bucket_start,
      bw.bucket_end,
      bw.application_count,
      count(DISTINCT a.wallet_address_normalised) AS unique_wallets,
      count(DISTINCT a.x_handle_normalised) AS unique_handles,
      count(*) FILTER (WHERE a.manual_review_flag) AS flagged_count
    FROM burst_windows bw
    LEFT JOIN apps a
      ON a.submitted_at >= bw.bucket_start
     AND a.submitted_at < bw.bucket_end
    GROUP BY bw.bucket_start, bw.bucket_end, bw.application_count
    ORDER BY bw.application_count DESC, bw.bucket_start DESC
  ) t;

  RETURN jsonb_build_object('windows', coalesce(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION admin_clearance_export(
  p_export_type TEXT DEFAULT 'combined_mint_ready'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
  v_total BIGINT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_export_type = 'whitelist_only' THEN
    SELECT count(*),
      coalesce(jsonb_agg(
        jsonb_build_object(
          'wallet_address', w.wallet_address,
          'wallet_address_normalised', w.wallet_address_normalised,
          'wl_status', w.status,
          'wl_spots', w.wl_spots,
          'on_whitelist', true,
          'on_fcfs', fcfs_wallet_on_whitelist(w.wallet_address_normalised)
        ) ORDER BY w.wallet_address_normalised
      ), '[]'::jsonb)
    INTO v_total, v_rows
    FROM whitelist_wallets w
    WHERE w.is_active = true AND w.status <> 'removed';

  ELSIF p_export_type = 'fcfs_approved_only' THEN
    SELECT count(*),
      coalesce(jsonb_agg(
        jsonb_build_object(
          'wallet_address', f.wallet_address,
          'wallet_address_normalised', f.wallet_address_normalised,
          'x_handle', f.x_handle,
          'fcfs_status', f.status,
          'on_whitelist', fcfs_wallet_on_whitelist(f.wallet_address_normalised)
        ) ORDER BY f.wallet_address_normalised
      ), '[]'::jsonb)
    INTO v_total, v_rows
    FROM fcfs_applications f
    WHERE f.status = 'approved';

  ELSIF p_export_type = 'combined_mint_ready' THEN
    WITH wallets AS (
      SELECT wallet_address_normalised FROM whitelist_wallets WHERE is_active AND status <> 'removed'
      UNION
      SELECT wallet_address_normalised FROM fcfs_applications WHERE status = 'approved'
    ),
    enriched AS (
      SELECT
        w.wallet_address_normalised,
        (SELECT wl.wallet_address FROM whitelist_wallets wl
          WHERE wl.wallet_address_normalised = w.wallet_address_normalised
            AND wl.is_active AND wl.status <> 'removed' LIMIT 1) AS wl_display,
        (SELECT wl.status::text FROM whitelist_wallets wl
          WHERE wl.wallet_address_normalised = w.wallet_address_normalised
            AND wl.is_active AND wl.status <> 'removed' LIMIT 1) AS wl_status,
        EXISTS (
          SELECT 1 FROM whitelist_wallets wl
          WHERE wl.wallet_address_normalised = w.wallet_address_normalised
            AND wl.is_active AND wl.status <> 'removed'
        ) AS on_whitelist,
        EXISTS (
          SELECT 1 FROM fcfs_applications f
          WHERE f.wallet_address_normalised = w.wallet_address_normalised
            AND f.status = 'approved'
        ) AS on_fcfs_approved,
        (SELECT f.x_handle FROM fcfs_applications f
          WHERE f.wallet_address_normalised = w.wallet_address_normalised
          ORDER BY f.submitted_at DESC LIMIT 1) AS x_handle,
        (SELECT f.status::text FROM fcfs_applications f
          WHERE f.wallet_address_normalised = w.wallet_address_normalised
          ORDER BY f.submitted_at DESC LIMIT 1) AS fcfs_status
      FROM wallets w
    )
    SELECT count(*),
      coalesce(jsonb_agg(
        jsonb_build_object(
          'wallet_address', coalesce(e.wl_display, e.wallet_address_normalised),
          'wallet_address_normalised', e.wallet_address_normalised,
          'on_whitelist', e.on_whitelist,
          'on_fcfs', e.on_fcfs_approved,
          'wl_mint_allowance', CASE WHEN e.on_whitelist THEN 1 ELSE 0 END,
          'fcfs_mint_allowance', CASE WHEN e.on_fcfs_approved THEN 2 ELSE 0 END,
          'mint_price_eth', 0.003,
          'x_handle', e.x_handle,
          'fcfs_status', e.fcfs_status,
          'wl_status', e.wl_status
        ) ORDER BY e.wallet_address_normalised
      ), '[]'::jsonb)
    INTO v_total, v_rows
    FROM enriched e;

  ELSE
    RETURN jsonb_build_object('outcome', 'invalid_export_type');
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'export_type', p_export_type,
    'total', v_total,
    'rows', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_bulk_delete(
  p_application_ids UUID[],
  p_expected_count INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_application_ids IS NULL OR array_length(p_application_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('outcome', 'error', 'reason', 'no_ids');
  END IF;

  IF coalesce(p_expected_count, 0) <> array_length(p_application_ids, 1) THEN
    RETURN jsonb_build_object('outcome', 'error', 'reason', 'count_mismatch');
  END IF;

  INSERT INTO audit_events (
    event_type,
    wallet_id,
    wallet_address_snapshot,
    admin_user_id,
    event_source,
    metadata
  ) VALUES (
    'fcfs_bulk_delete_requested',
    NULL,
    NULL,
    auth.uid(),
    'admin',
    jsonb_build_object(
      'requested_count', array_length(p_application_ids, 1),
      'application_ids', to_jsonb(p_application_ids)
    )
  );

  DELETE FROM fcfs_applications
  WHERE id = ANY(p_application_ids);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO audit_events (
    event_type,
    wallet_id,
    wallet_address_snapshot,
    admin_user_id,
    event_source,
    metadata
  ) VALUES (
    'fcfs_bulk_delete_completed',
    NULL,
    NULL,
    auth.uid(),
    'admin',
    jsonb_build_object('deleted_count', v_deleted)
  );

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'deleted', v_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_clearance_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wl_list(INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_cross_list_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_cross_list_wallets(INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_handle_lookup(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_burst_windows(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_clearance_export(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_bulk_delete(UUID[], INT) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_fcfs_applications_status_wallet
  ON fcfs_applications (status, wallet_address_normalised);

CREATE INDEX IF NOT EXISTS idx_whitelist_wallets_active_status
  ON whitelist_wallets (is_active, status);
