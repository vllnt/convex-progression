import { ConvexError } from "convex/values";
import { assertThresholds, MAX_REF_LENGTH } from "../shared";

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function requireRef(value: string, name: string): void {
  if (value.length === 0 || value.length > MAX_REF_LENGTH) {
    fail("INVALID_REF", `${name} must be 1..${MAX_REF_LENGTH} characters`);
  }
}

export function parseThresholds(thresholds: number[]): number[] {
  try {
    assertThresholds(thresholds);
  } catch (error) {
    fail(
      "INVALID_THRESHOLDS",
      String(error).replace(/^Error:\s*/, "").replace(/^INVALID_THRESHOLDS:\s*/, ""),
    );
  }
  return thresholds;
}
