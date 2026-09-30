import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fcfsBulkOperationToStatus } from "../lib/fcfsBulkStatus";

describe("fcfs bulk status mapping", () => {
  it("maps approve to approved enum value", () => {
    expect(fcfsBulkOperationToStatus("approve")).toBe("approved");
  });

  it("maps reject to rejected enum value", () => {
    expect(fcfsBulkOperationToStatus("reject")).toBe("rejected");
  });

  it("maps pending unchanged", () => {
    expect(fcfsBulkOperationToStatus("pending")).toBe("pending");
  });

  it("does not treat approve as a valid enum literal", () => {
    expect(fcfsBulkOperationToStatus("approve")).not.toBe("approve");
  });
});

describe("013 fcfs bulk status migration", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/013_fcfs_bulk_status_fix.sql"),
    "utf8",
  );

  it("maps approve/reject to approved/rejected in SQL", () => {
    expect(migration).toMatch(/WHEN 'approve' THEN 'approved'::fcfs_application_status/);
    expect(migration).toMatch(/WHEN 'reject' THEN 'rejected'::fcfs_application_status/);
  });

  it("does not cast bulk verb directly to enum", () => {
    expect(migration).not.toMatch(/p_operation::fcfs_application_status/);
  });
});
