-- Close pre-existing admin RPC guard gap from migration 004.
-- admin_fcfs_burst_buckets and admin_fcfs_duplicate_wallet_normalised were
-- granted to authenticated without is_whitelist_admin() enforcement.

CREATE OR REPLACE FUNCTION admin_fcfs_duplicate_wallet_normalised()
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
  SELECT wallet_address_normalised
  FROM fcfs_applications
  GROUP BY wallet_address_normalised
  HAVING count(*) > 1;
END;
$$;

CREATE OR REPLACE FUNCTION admin_fcfs_burst_buckets(
  p_window_minutes INT DEFAULT 2,
  p_min_count INT DEFAULT 5
)
RETURNS TABLE (
  bucket_start TIMESTAMPTZ,
  bucket_end TIMESTAMPTZ,
  application_count BIGINT
)
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
      b.bucket_start,
      b.bucket_start + (greatest(p_window_minutes, 1) || ' minutes')::interval AS bucket_end,
      count(*) AS application_count
    FROM bucketed b
    GROUP BY b.bucket_start
    HAVING count(*) >= greatest(p_min_count, 2)
  )
  SELECT g.bucket_start, g.bucket_end, g.application_count
  FROM grouped g
  ORDER BY g.application_count DESC, g.bucket_start DESC;
END;
$$;

REVOKE ALL ON FUNCTION admin_fcfs_duplicate_wallet_normalised() FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_fcfs_duplicate_wallet_normalised() FROM anon;

REVOKE ALL ON FUNCTION admin_fcfs_burst_buckets(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_fcfs_burst_buckets(INT, INT) FROM anon;

GRANT EXECUTE ON FUNCTION admin_fcfs_duplicate_wallet_normalised() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_fcfs_burst_buckets(INT, INT) TO authenticated;
