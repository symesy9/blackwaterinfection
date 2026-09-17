-- FCFS admin: server-side hide submission burst filter for manual review list

CREATE OR REPLACE FUNCTION fcfs_in_submission_burst(p_submitted_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_fcfs_burst_buckets(2, 5) burst
    WHERE p_submitted_at >= burst.bucket_start
      AND p_submitted_at < burst.bucket_end
  );
$$;

DROP FUNCTION IF EXISTS admin_fcfs_list(
  INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
);

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

  WITH matching AS (
    SELECT a.*
    FROM fcfs_applications a
    WHERE
      (coalesce(p_status, 'all') = 'all' OR a.status::text = p_status)
      AND (
        coalesce(trim(p_search), '') = ''
        OR a.wallet_address_normalised ILIKE '%' || lower(trim(p_search)) || '%'
        OR a.x_handle_normalised ILIKE '%' || lower(trim(replace(p_search, '@', ''))) || '%'
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
          p_audit_filter = 'no_flags'
          AND a.manual_review_flag = false
          AND NOT fcfs_is_invalid_wallet(a.wallet_address_normalised)
          AND NOT fcfs_is_malformed_x_handle(a.x_handle, a.x_handle_normalised)
          AND NOT EXISTS (
            SELECT 1 FROM fcfs_applications b
            WHERE b.x_handle_normalised = a.x_handle_normalised AND b.id <> a.id
          )
          AND NOT fcfs_in_submission_burst(a.submitted_at)
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
            OR fcfs_in_submission_burst(a.submitted_at)
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
          AND fcfs_in_submission_burst(a.submitted_at)
        )
      )
  ),
  burst_hidden AS (
    SELECT count(*) AS cnt
    FROM matching m
    WHERE v_apply_hide AND fcfs_in_submission_burst(m.submitted_at)
  ),
  filtered AS (
    SELECT m.*
    FROM matching m
    WHERE NOT v_apply_hide OR NOT fcfs_in_submission_burst(m.submitted_at)
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
          'application', to_jsonb(p.*),
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
              SELECT 'malformed_x_handle'
              WHERE fcfs_is_malformed_x_handle(p.x_handle, p.x_handle_normalised)
              UNION ALL
              SELECT 'invalid_wallet_format'
              WHERE fcfs_is_invalid_wallet(p.wallet_address_normalised)
              UNION ALL
              SELECT 'submission_burst'
              WHERE fcfs_in_submission_burst(p.submitted_at)
            ) flags(flag)
          ),
          'duplicate_x_handle_count', (
            SELECT count(*)::int FROM fcfs_applications b
            WHERE b.x_handle_normalised = p.x_handle_normalised
          ),
          'same_burst_count', (
            SELECT coalesce(max(burst.application_count), 0)::int
            FROM admin_fcfs_burst_buckets(2, 5) burst
            WHERE p.submitted_at >= burst.bucket_start AND p.submitted_at < burst.bucket_end
          )
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
