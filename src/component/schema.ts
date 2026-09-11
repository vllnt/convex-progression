import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Sandboxed tables — XP / level / streak per opaque `(scope, subjectRef, key)`.
 * Thresholds are host-supplied on each write so the component never stores a
 * domain-shaped definition table.
 */
export default defineSchema({
  progress: defineTable({
    subjectRef: v.string(),
    key: v.string(),
    scope: v.string(),
    xp: v.number(),
    level: v.number(),
    streak: v.number(),
    maxStreak: v.number(),
    lastPeriodKey: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_scope_subject_key", ["scope", "subjectRef", "key"]),
});
