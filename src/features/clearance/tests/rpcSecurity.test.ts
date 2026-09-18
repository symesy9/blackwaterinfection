import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/011_clearance_rpc_security.sql",
);
const migration = readFileSync(migrationPath, "utf8");

function functionBlock(functionName: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION ${functionName}`);
  if (start < 0) {
    throw new Error(`Missing function block: ${functionName}`);
  }
  const nextCreate = migration.indexOf("CREATE OR REPLACE FUNCTION", start + 1);
  const revokeStart = migration.indexOf("REVOKE ALL", start);
  const endCandidates = [nextCreate, revokeStart].filter((index) => index >= 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : migration.length;
  return migration.slice(start, end);
}

describe("011 clearance rpc security migration", () => {
  it("defines both secured admin RPCs", () => {
    expect(migration).toContain("admin_fcfs_burst_buckets");
    expect(migration).toContain("admin_fcfs_duplicate_wallet_normalised");
  });

  it("requires is_whitelist_admin() in both RPC bodies", () => {
    for (const fn of [
      "admin_fcfs_burst_buckets",
      "admin_fcfs_duplicate_wallet_normalised",
    ]) {
      expect(functionBlock(fn)).toMatch(/IF NOT is_whitelist_admin\(\)/);
      expect(functionBlock(fn)).toMatch(/RAISE EXCEPTION 'Unauthorized'/);
    }
  });

  it("uses SECURITY DEFINER with explicit search_path on both RPCs", () => {
    for (const fn of [
      "admin_fcfs_burst_buckets",
      "admin_fcfs_duplicate_wallet_normalised",
    ]) {
      const block = functionBlock(fn);
      expect(block).toContain("SECURITY DEFINER");
      expect(block).toContain("SET search_path = public");
    }
  });

  it("does not grant execute to anon or public", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION admin_fcfs_duplicate_wallet_normalised\(\) FROM PUBLIC/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION admin_fcfs_duplicate_wallet_normalised\(\) FROM anon/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION admin_fcfs_burst_buckets\(INT, INT\) FROM PUBLIC/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION admin_fcfs_burst_buckets\(INT, INT\) FROM anon/,
    );
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]* TO anon/);
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]* TO PUBLIC/);
  });

  it("preserves authenticated admin execute grants", () => {
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION admin_fcfs_duplicate_wallet_normalised\(\) TO authenticated/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION admin_fcfs_burst_buckets\(INT, INT\) TO authenticated/,
    );
  });

  it("preserves burst bucket signature and return shape for admin callers", () => {
    const burstBlock = functionBlock("admin_fcfs_burst_buckets");
    expect(burstBlock).toMatch(
      /p_window_minutes INT DEFAULT 2,\s*\n\s*p_min_count INT DEFAULT 5/,
    );
    expect(burstBlock).toContain("bucket_start TIMESTAMPTZ");
    expect(burstBlock).toContain("bucket_end TIMESTAMPTZ");
    expect(burstBlock).toContain("application_count BIGINT");
    expect(burstBlock).toContain("ORDER BY g.application_count DESC, g.bucket_start DESC");
  });

  it("preserves duplicate wallet query semantics", () => {
    const duplicateBlock = functionBlock("admin_fcfs_duplicate_wallet_normalised");
    expect(duplicateBlock).toContain("RETURNS SETOF TEXT");
    expect(duplicateBlock).toContain("wallet_address_normalised");
    expect(duplicateBlock).toContain("HAVING count(*) > 1");
  });

  it("does not mutate application rows or public submit paths", () => {
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bINSERT\b/i);
    expect(migration).not.toMatch(/public_submit_fcfs_application/);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
  });
});
