import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Sandboxed tables — XP / level / streak per opaque `(scope, subjectRef, key)`.
 * Thresholds are host-supplied on each write so the component never stores a
 * domain-shaped definition table.
 */
export default defineSchema({
  progress: defineTable({
    key: v.string(),
    lastPeriodKey: v.optional(v.string()),
    level: v.number(),
    maxStreak: v.number(),
    scope: v.string(),
    streak: v.number(),
    subjectRef: v.string(),
    updatedAt: v.number(),
    xp: v.number(),
  }).index("by_scope_subject_key", ["scope", "subjectRef", "key"]),
});
