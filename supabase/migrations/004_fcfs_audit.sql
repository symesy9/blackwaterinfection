-- FCFS admin audit: manual review flags + server-side list/aggregation RPCs

ALTER TABLE fcfs_applications
  ADD COLUMN IF NOT EXISTS manual_review_flag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_fcfs_applications_manual_review
  ON fcfs_applications (manual_review_flag)
  WHERE manual_review_flag = true;

CREATE OR REPLACE FUNCTION fcfs_is_invalid_wallet(p_wallet TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_wallet, '') !~ '^0x[a-f0-9]{40}$';
$$;

CREATE OR REPLACE FUNCTION fcfs_is_malformed_x_handle(
  p_handle TEXT,
  p_normalised TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_normalised, '') = ''
    OR COALESCE(p_normalised, '') !~ '^[a-z0-9_]{1,15}$'
    OR COALESCE(p_handle, '') <> ('@' || COALESCE(p_normalised, ''));
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_duplicate_wallet_normalised()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wallet_address_normalised
  FROM fcfs_applications
  GROUP BY wallet_address_normalised
  HAVING count(*) > 1;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_duplicate_wallet_normalised() TO authenticated;

CREATE OR REPLACE FUNCTION admin_fcfs_burst_buckets(
  p_window_minutes INT DEFAULT 2,
  p_min_count INT DEFAULT 5
)
RETURNS TABLE (
  bucket_start TIMESTAMPTZ,
  bucket_end TIMESTAMPTZ,
  application_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bucketed AS (
    SELECT
      date_trunc('hour', submitted_at)
        + floor(
          extract(minute FROM submitted_at)::numeric / greatest(p_window_minutes, 1)
        ) * (greatest(p_window_minutes, 1) || ' minutes')::interval AS bucket_start,
      submitted_at
    FROM fcfs_applications
  ),
  grouped AS (
    SELECT
      bucket_start,
      bucket_start + (greatest(p_window_minutes, 1) || ' minutes')::interval AS bucket_end,
      count(*) AS application_count
    FROM bucketed
    GROUP BY bucket_start
    HAVING count(*) >= greatest(p_min_count, 2)
  )
  SELECT bucket_start, bucket_end, application_count
  FROM grouped
  ORDER BY application_count DESC, bucket_start DESC;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_burst_buckets(INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION admin_fcfs_audit_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_pending BIGINT;
  v_approved BIGINT;
  v_rejected BIGINT;
  v_manual_flagged BIGINT;
  v_duplicate_handles BIGINT;
  v_duplicate_wallets BIGINT;
  v_invalid_wallet BIGINT;
  v_malformed_handle BIGINT;
  v_burst_periods BIGINT;
  v_flagged BIGINT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total FROM fcfs_applications;
  SELECT count(*) INTO v_pending FROM fcfs_applications WHERE status = 'pending';
  SELECT count(*) INTO v_approved FROM fcfs_applications WHERE status = 'approved';
  SELECT count(*) INTO v_rejected FROM fcfs_applications WHERE status = 'rejected';
  SELECT count(*) INTO v_manual_flagged FROM fcfs_applications WHERE manual_review_flag = true;

  SELECT count(*) INTO v_duplicate_handles
  FROM (
    SELECT x_handle_normalised
    FROM fcfs_applications
    GROUP BY x_handle_normalised
    HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_duplicate_wallets
  FROM (
    SELECT wallet_address_normalised
    FROM fcfs_applications
    GROUP BY wallet_address_normalised
    HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_invalid_wallet
  FROM fcfs_applications
  WHERE fcfs_is_invalid_wallet(wallet_address_normalised);

  SELECT count(*) INTO v_malformed_handle
  FROM fcfs_applications
  WHERE fcfs_is_malformed_x_handle(x_handle, x_handle_normalised);

  SELECT count(*) INTO v_burst_periods FROM admin_fcfs_burst_buckets(2, 5);

  SELECT count(DISTINCT a.id) INTO v_flagged
  FROM fcfs_applications a
  WHERE a.manual_review_flag = true
    OR fcfs_is_invalid_wallet(a.wallet_address_normalised)
    OR fcfs_is_malformed_x_handle(a.x_handle, a.x_handle_normalised)
    OR EXISTS (
      SELECT 1
      FROM fcfs_applications b
      WHERE b.x_handle_normalised = a.x_handle_normalised
        AND b.id <> a.id
    )
    OR EXISTS (
      SELECT 1
      FROM admin_fcfs_burst_buckets(2, 5) burst
      WHERE a.submitted_at >= burst.bucket_start
        AND a.submitted_at < burst.bucket_end
    );

  RETURN jsonb_build_object(
    'total', v_total,
    'pending', v_pending,
    'approved', v_approved,
    'rejected', v_rejected,
    'manual_review_flagged', v_manual_flagged,
    'flagged_for_review', v_flagged,
    'duplicate_x_handles', v_duplicate_handles,
    'duplicate_wallets', v_duplicate_wallets,
    'invalid_wallet_format', v_invalid_wallet,
    'malformed_x_handle', v_malformed_handle,
    'submission_burst_periods', v_burst_periods
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_audit_summary() TO authenticated;

CREATE OR REPLACE FUNCTION admin_fcfs_submission_timeline(p_granularity TEXT DEFAULT 'hour')
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

  IF p_granularity = 'day' THEN
    SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.period_start DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        date_trunc('day', submitted_at) AS period_start,
        count(*)::bigint AS application_count
      FROM fcfs_applications
      GROUP BY 1
      ORDER BY 1 DESC
    ) t;
  ELSIF p_granularity = 'minute' THEN
    SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.period_start DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        date_trunc('minute', submitted_at) AS period_start,
        count(*)::bigint AS application_count
      FROM fcfs_applications
      GROUP BY 1
      ORDER BY application_count DESC, 1 DESC
      LIMIT 500
    ) t;
  ELSE
    SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.period_start DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        date_trunc('hour', submitted_at) AS period_start,
        count(*)::bigint AS application_count
      FROM fcfs_applications
      GROUP BY 1
      ORDER BY 1 DESC
    ) t;
  END IF;

  RETURN jsonb_build_object('granularity', p_granularity, 'periods', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_submission_timeline(TEXT) TO authenticated;

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
  p_x_handle_normalised TEXT DEFAULT NULL
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

  WITH base AS (
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
          AND NOT EXISTS (
            SELECT 1 FROM admin_fcfs_burst_buckets(2, 5) burst
            WHERE a.submitted_at >= burst.bucket_start AND a.submitted_at < burst.bucket_end
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
              SELECT 1 FROM admin_fcfs_burst_buckets(2, 5) burst
              WHERE a.submitted_at >= burst.bucket_start AND a.submitted_at < burst.bucket_end
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
            SELECT 1 FROM admin_fcfs_burst_buckets(2, 5) burst
            WHERE a.submitted_at >= burst.bucket_start AND a.submitted_at < burst.bucket_end
          )
        )
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM base
  ),
  paged AS (
    SELECT *
    FROM base
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
              WHERE EXISTS (
                SELECT 1 FROM admin_fcfs_burst_buckets(2, 5) burst
                WHERE p.submitted_at >= burst.bucket_start AND p.submitted_at < burst.bucket_end
              )
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
  INTO v_total, v_rows
  FROM counted
  LEFT JOIN paged p ON true
  GROUP BY counted.total;

  RETURN jsonb_build_object(
    'applications', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_list(
  INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION admin_fcfs_related_counts(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row fcfs_applications%ROWTYPE;
  v_same_handle INT;
  v_same_burst INT;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_row FROM fcfs_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT count(*)::int INTO v_same_handle
  FROM fcfs_applications
  WHERE x_handle_normalised = v_row.x_handle_normalised;

  SELECT coalesce(max(burst.application_count), 0)::int INTO v_same_burst
  FROM admin_fcfs_burst_buckets(2, 5) burst
  WHERE v_row.submitted_at >= burst.bucket_start
    AND v_row.submitted_at < burst.bucket_end;

  RETURN jsonb_build_object(
    'same_x_handle_count', v_same_handle,
    'same_burst_count', v_same_burst,
    'x_handle_normalised', v_row.x_handle_normalised
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_fcfs_related_counts(UUID) TO authenticated;
