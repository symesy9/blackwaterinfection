import { describe, expect, it } from "vitest";
import {
  formatXHandleDisplay,
  normaliseXHandle,
  validateXHandleInput,
  xProfileUrl,
} from "../lib/xHandle";

describe("xHandle", () => {
  it("normalises @ prefix and casing", () => {
    expect(normaliseXHandle("@User_Name")).toBe("user_name");
    expect(formatXHandleDisplay("User_Name")).toBe("@user_name");
  });

  it("accepts valid handles", () => {
    const result = validateXHandleInput("@blackwater_z26");
    expect(result.valid).toBe(true);
    expect(result.normalised).toBe("blackwater_z26");
  });

  it("builds X profile URLs from handles", () => {
    expect(xProfileUrl("@User_Name")).toBe("https://x.com/user_name");
    expect(xProfileUrl("blackwater_z26")).toBe("https://x.com/blackwater_z26");
    expect(xProfileUrl("")).toBeNull();
    expect(xProfileUrl("bad handle")).toBeNull();
  });

  it("rejects invalid handles", () => {
    expect(validateXHandleInput("").valid).toBe(false);
    expect(validateXHandleInput("bad handle").valid).toBe(false);
    expect(validateXHandleInput("x".repeat(16)).valid).toBe(false);
  });
});
