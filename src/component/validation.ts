import { ConvexError } from "convex/values";

import {
  assertThresholds,
  clampEraseBatch,
  DEFAULT_ERASE_BATCH,
  MAX_REF_LENGTH,
} from "../shared.js";

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function requireRef(value: string, name: string): void {
  if (value.length === 0 || value.length > MAX_REF_LENGTH) {
    fail(
      "INVALID_REF",
      `${name} must be 1..${String(MAX_REF_LENGTH)} characters`,
    );
  }
}

/** Re-throw a shared `CODE: message` error as a coded ConvexError. */
function failFromShared(code: string, error: unknown): never {
  return fail(
    code,
    String(error)
      .replace(/^Error:\s*/, "")
      .replace(`${code}: `, ""),
  );
}

export function parseThresholds(thresholds: number[]): number[] {
  try {
    assertThresholds(thresholds);
  } catch (error) {
    failFromShared("INVALID_THRESHOLDS", error);
  }
  return thresholds;
}

export function parseBatch(batch: number | undefined): number {
  try {
    return clampEraseBatch(batch ?? DEFAULT_ERASE_BATCH);
  } catch (error) {
    return failFromShared("INVALID_BATCH", error);
  }
}
