-- FCFS duplicate protection, WL cross-check, and admin audit extensions

CREATE OR REPLACE FUNCTION fcfs_wallet_on_whitelist(p_wallet_normalised TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM whitelist_wallets w
    WHERE w.wallet_address_normalised = lower(trim(coalesce(p_wallet_normalised, '')))
  );
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

  IF EXISTS (
    SELECT 1
    FROM fcfs_applications
    WHERE x_handle_normalised = v_x_normalised
  ) THEN
    RETURN jsonb_build_object('outcome', 'x_handle_already_used');
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
      'status', v_row.status,
      'on_whitelist', fcfs_wallet_on_whitelist(v_row.wallet_address_normalised)
    )
  );

  RETURN jsonb_build_object(
    'outcome', 'submitted',
    'application_id', v_row.id,
    'submitted_at', v_row.submitted_at
  );
EXCEPTION
  WHEN unique_violation THEN
    IF EXISTS (
      SELECT 1
      FROM fcfs_applications
      WHERE wallet_address_normalised = v_wallet_normalised
    ) THEN
      RETURN jsonb_build_object('outcome', 'already_registered');
    END IF;
    RETURN jsonb_build_object('outcome', 'x_handle_already_used');
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM fcfs_applications
    GROUP BY x_handle_normalised
    HAVING count(*) > 1
    LIMIT 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fcfs_applications_x_handle_unique
      ON fcfs_applications (x_handle_normalised);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION admin_fcfs_related_counts(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row fcfs_applications%ROWTYPE;
  v_same_handle INT;
  v_same_wallet INT;
  v_same_burst INT;
  v_wl_status TEXT;
  v_on_whitelist BOOLEAN;
  v_related_ids JSONB;
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

  SELECT count(*)::int INTO v_same_wallet
  FROM fcfs_applications
  WHERE wallet_address_normalised = v_row.wallet_address_normalised;

  SELECT coalesce(max(burst.application_count), 0)::int INTO v_same_burst
  FROM admin_fcfs_burst_buckets(2, 5) burst
  WHERE v_row.submitted_at >= burst.bucket_start
    AND v_row.submitted_at < burst.bucket_end;

  SELECT w.status::text, true
  INTO v_wl_status, v_on_whitelist
  FROM whitelist_wallets w
  WHERE w.wallet_address_normalised = v_row.wallet_address_normalised
  LIMIT 1;

  IF NOT FOUND THEN
    v_on_whitelist := false;
    v_wl_status := NULL;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'wallet_address', a.wallet_address,
    'status', a.status,
    'submitted_at', a.submitted_at
  ) ORDER BY a.submitted_at), '[]'::jsonb)
  INTO v_related_ids
  FROM fcfs_applications a
  WHERE a.x_handle_normalised = v_row.x_handle_normalised
    AND a.id <> v_row.id;

  RETURN jsonb_build_object(
    'same_x_handle_count', v_same_handle,
    'same_wallet_count', v_same_wallet,
    'same_burst_count', v_same_burst,
    'x_handle_normalised', v_row.x_handle_normalised,
    'on_whitelist', coalesce(v_on_whitelist, false),
    'whitelist_status', v_wl_status,
    'related_x_handle_applications', v_related_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_wallet_audit(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_normalised TEXT;
  v_fcfs JSONB;
  v_wl JSONB;
  v_fcfs_flags JSONB;
BEGIN
  IF NOT is_whitelist_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_wallet_normalised := lower(trim(coalesce(p_wallet, '')));

  IF v_wallet_normalised = '' OR v_wallet_normalised !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_wallet');
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'application', to_jsonb(f.*),
      'audit_flags', (
        SELECT coalesce(jsonb_agg(flag), '[]'::jsonb)
        FROM (
          SELECT 'manual_review' AS flag WHERE f.manual_review_flag
          UNION ALL
          SELECT 'duplicate_x_handle'
          WHERE EXISTS (
            SELECT 1 FROM fcfs_applications b
            WHERE b.x_handle_normalised = f.x_handle_normalised AND b.id <> f.id
          )
          UNION ALL
          SELECT 'duplicate_wallet'
          WHERE EXISTS (
            SELECT 1 FROM fcfs_applications b
            WHERE b.wallet_address_normalised = f.wallet_address_normalised AND b.id <> f.id
          )
          UNION ALL
          SELECT 'already_on_whitelist'
          WHERE fcfs_wallet_on_whitelist(f.wallet_address_normalised)
          UNION ALL
          SELECT 'malformed_x_handle'
          WHERE fcfs_is_malformed_x_handle(f.x_handle, f.x_handle_normalised)
          UNION ALL
          SELECT 'invalid_wallet_format'
          WHERE fcfs_is_invalid_wallet(f.wallet_address_normalised)
          UNION ALL
          SELECT 'submission_burst'
          WHERE fcfs_in_submission_burst(f.submitted_at)
        ) flags(flag)
      ),
      'duplicate_x_handle_count', (
        SELECT count(*)::int FROM fcfs_applications b
        WHERE b.x_handle_normalised = f.x_handle_normalised
      )
    )
  ), '[]'::jsonb)
  INTO v_fcfs
  FROM fcfs_applications f
  WHERE f.wallet_address_normalised = v_wallet_normalised;

  SELECT to_jsonb(w.*)
  INTO v_wl
  FROM whitelist_wallets w
  WHERE w.wallet_address_normalised = v_wallet_normalised
  LIMIT 1;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'wallet_address_normalised', v_wallet_normalised,
    'fcfs_applications', v_fcfs,
    'whitelist_record', coalesce(v_wl, 'null'::jsonb),
    'on_whitelist', v_wl IS NOT NULL
  );
END;
$$;

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

  SELECT count(*) INTO v_burst_apps
  FROM fcfs_applications f
  WHERE fcfs_in_submission_burst(f.submitted_at);

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

GRANT EXECUTE ON FUNCTION admin_fcfs_wallet_audit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_data_audit() TO authenticated;

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

  WITH matching AS (
    SELECT a.*
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
