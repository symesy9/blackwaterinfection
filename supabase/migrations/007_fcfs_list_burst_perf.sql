-- Fix admin_fcfs_list timeout/500 when hide bursts is enabled on large datasets.
-- Computes burst windows once per request instead of per-row function calls.

CREATE OR REPLACE FUNCTION admin_fcfs_data_audit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_dup_wallet_groups BIGINT;
  v_dup_handle_groups BIGINT;
  v_dup_handle_apps BIGINT;
  v_on_wl BIGINT;
  v_invalid_wallet BIGINT;
  v_malformed_handle BIGINT;
  v_burst_apps BIGINT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total FROM fcfs_applications;

  SELECT count(*) INTO v_dup_wallet_groups
  FROM (
    SELECT wallet_address_normalised
    FROM fcfs_applications
    GROUP BY wallet_address_normalised
    HAVING count(*) > 1
  ) d;

  SELECT count(*), coalesce(sum(cnt), 0)
  INTO v_dup_handle_groups, v_dup_handle_apps
  FROM (
    SELECT count(*) AS cnt
    FROM fcfs_applications
    GROUP BY x_handle_normalised
    HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_on_wl
  FROM fcfs_applications f
  WHERE fcfs_wallet_on_whitelist(f.wallet_address_normalised);

  SELECT count(*) INTO v_invalid_wallet
  FROM fcfs_applications f
  WHERE fcfs_is_invalid_wallet(f.wallet_address_normalised);

  SELECT count(*) INTO v_malformed_handle
  FROM fcfs_applications f
  WHERE fcfs_is_malformed_x_handle(f.x_handle, f.x_handle_normalised);

  SELECT count(DISTINCT f.id) INTO v_burst_apps
  FROM fcfs_applications f
  JOIN admin_fcfs_burst_buckets(2, 5) burst
    ON f.submitted_at >= burst.bucket_start
   AND f.submitted_at < burst.bucket_end;

  RETURN jsonb_build_object(
    'total_fcfs_applications', v_total,
    'duplicate_wallet_groups', v_dup_wallet_groups,
    'duplicate_x_handle_groups', v_dup_handle_groups,
    'duplicate_x_handle_applications', v_dup_handle_apps,
    'fcfs_wallets_on_whitelist', v_on_wl,
    'invalid_wallet_format_count', v_invalid_wallet,
    'malformed_x_handle_count', v_malformed_handle,
    'submission_burst_application_count', v_burst_apps,
    'wallet_unique_constraint_present', EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'fcfs_applications'
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) ILIKE '%wallet_address_normalised%'
    ),
    'x_handle_unique_index_present', EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'fcfs_applications'
        AND indexname = 'idx_fcfs_applications_x_handle_unique'
    )
  );
END;
$$;

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
  p_hide_bursts BOOLEAN DEFAULT false
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
  v_burst_hidden BIGINT;
  v_rows JSONB;
  v_sort_col TEXT;
  v_sort_asc BOOLEAN := lower(coalesce(p_sort_dir, 'desc')) = 'asc';
  v_apply_hide BOOLEAN := coalesce(p_hide_bursts, false)
    AND p_burst_start IS NULL
    AND p_burst_end IS NULL
    AND coalesce(p_audit_filter, 'all') <> 'submission_burst';
  v_search TEXT := lower(trim(coalesce(p_search, '')));
  v_search_handle TEXT := lower(trim(replace(coalesce(p_search, ''), '@', '')));
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
  matching AS (
    SELECT
      a.*,
      EXISTS (
        SELECT 1
        FROM burst_windows bw
        WHERE a.submitted_at >= bw.bucket_start
          AND a.submitted_at < bw.bucket_end
      ) AS in_burst
    FROM fcfs_applications a
    WHERE
      (coalesce(p_status, 'all') = 'all' OR a.status::text = p_status)
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
        p_burst_start IS NULL
        OR p_burst_end IS NULL
        OR (a.submitted_at >= p_burst_start AND a.submitted_at < p_burst_end)
      )
      AND (
        coalesce(p_audit_filter, 'all') = 'all'
        OR (p_audit_filter = 'pending' AND a.status = 'pending')
        OR (p_audit_filter = 'approved' AND a.status = 'approved')
        OR (p_audit_filter = 'rejected' AND a.status = 'rejected')
        OR (p_audit_filter = 'manual_review' AND a.manual_review_flag = true)
        OR (
          p_audit_filter = 'already_on_whitelist'
          AND fcfs_wallet_on_whitelist(a.wallet_address_normalised)
        )
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
        OR (
          p_audit_filter = 'invalid_wallet'
          AND fcfs_is_invalid_wallet(a.wallet_address_normalised)
        )
        OR (
          p_audit_filter = 'malformed_x_handle'
          AND fcfs_is_malformed_x_handle(a.x_handle, a.x_handle_normalised)
        )
        OR (
          p_audit_filter = 'submission_burst'
          AND EXISTS (
            SELECT 1 FROM burst_windows bw
            WHERE a.submitted_at >= bw.bucket_start AND a.submitted_at < bw.bucket_end
          )
        )
      )
  ),
  burst_hidden AS (
    SELECT count(*) AS cnt
    FROM matching m
    WHERE v_apply_hide AND m.in_burst
  ),
  filtered AS (
    SELECT m.*
    FROM matching m
    WHERE NOT v_apply_hide OR NOT m.in_burst
  ),
  counted AS (
    SELECT count(*) AS total FROM filtered
  ),
  paged AS (
    SELECT *
    FROM filtered
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
    OFFSET v_offset
    LIMIT v_page_size
  )
  SELECT counted.total,
    (SELECT cnt FROM burst_hidden),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'application', to_jsonb(p) - 'in_burst',
          'audit_flags', (
            SELECT coalesce(jsonb_agg(flag), '[]'::jsonb)
            FROM (
              SELECT 'manual_review' AS flag WHERE p.manual_review_flag
              UNION ALL
              SELECT 'duplicate_x_handle'
              WHERE EXISTS (
                SELECT 1 FROM fcfs_applications b
                WHERE b.x_handle_normalised = p.x_handle_normalised AND b.id <> p.id
              )
              UNION ALL
              SELECT 'duplicate_wallet'
              WHERE EXISTS (
                SELECT 1 FROM fcfs_applications b
                WHERE b.wallet_address_normalised = p.wallet_address_normalised AND b.id <> p.id
              )
              UNION ALL
              SELECT 'already_on_whitelist'
              WHERE fcfs_wallet_on_whitelist(p.wallet_address_normalised)
              UNION ALL
              SELECT 'malformed_x_handle'
              WHERE fcfs_is_malformed_x_handle(p.x_handle, p.x_handle_normalised)
              UNION ALL
              SELECT 'invalid_wallet_format'
              WHERE fcfs_is_invalid_wallet(p.wallet_address_normalised)
              UNION ALL
              SELECT 'submission_burst'
              WHERE p.in_burst
            ) flags(flag)
          ),
          'duplicate_x_handle_count', (
            SELECT count(*)::int FROM fcfs_applications b
            WHERE b.x_handle_normalised = p.x_handle_normalised
          ),
          'same_burst_count', (
            SELECT coalesce(max(bw.application_count), 0)::int
            FROM burst_windows bw
            WHERE p.submitted_at >= bw.bucket_start AND p.submitted_at < bw.bucket_end
          ),
          'already_on_whitelist', fcfs_wallet_on_whitelist(p.wallet_address_normalised)
        )
      ),
      '[]'::jsonb
    )
  INTO v_total, v_burst_hidden, v_rows
  FROM counted
  LEFT JOIN paged p ON true
  GROUP BY counted.total;

  RETURN jsonb_build_object(
    'applications', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'burst_hidden_count', coalesce(v_burst_hidden, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_list(
  INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION admin_fcfs_data_audit() TO authenticated;
