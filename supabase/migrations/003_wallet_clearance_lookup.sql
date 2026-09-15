-- Public combined WL + FCFS wallet clearance lookup (read-only, minimal fields)

CREATE OR REPLACE FUNCTION public_lookup_wallet_clearance(p_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalised TEXT;
  v_wl_row whitelist_wallets%ROWTYPE;
  v_fcfs_row fcfs_applications%ROWTYPE;
  v_wl JSONB;
  v_fcfs JSONB;
  v_wl_found BOOLEAN := false;
  v_fcfs_found BOOLEAN := false;
BEGIN
  v_normalised := lower(trim(COALESCE(p_address, '')));

  IF v_normalised = '' OR v_normalised !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_address');
  END IF;

  SELECT *
  INTO v_wl_row
  FROM whitelist_wallets
  WHERE wallet_address_normalised = v_normalised
  LIMIT 1;

  v_wl_found := FOUND;

  IF v_wl_found AND v_wl_row.is_active AND v_wl_row.status <> 'removed' THEN
    v_wl := jsonb_build_object(
      'found', true,
      'status', v_wl_row.status::text
    );
  ELSE
    v_wl := jsonb_build_object('found', false);
  END IF;

  SELECT *
  INTO v_fcfs_row
  FROM fcfs_applications
  WHERE wallet_address_normalised = v_normalised
  LIMIT 1;

  v_fcfs_found := FOUND;

  IF v_fcfs_found THEN
    v_fcfs := jsonb_build_object(
      'found', true,
      'status', v_fcfs_row.status::text
    );
  ELSE
    v_fcfs := jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'ok',
    'wallet_address', v_normalised,
    'whitelist', v_wl,
    'fcfs', v_fcfs
  );
END;
$$;

REVOKE ALL ON FUNCTION public_lookup_wallet_clearance(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_lookup_wallet_clearance(TEXT) TO service_role;
