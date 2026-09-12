/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      accrue: FunctionReference<
        "mutation",
        "internal",
        {
          delta: number;
          key: string;
          scope: string;
          subjectRef: string;
          thresholds: Array<number>;
        },
        {
          lastPeriodKey?: string;
          level: number;
          leveledUp: boolean;
          maxStreak: number;
          previousLevel: number;
          streak: number;
          updatedAt: number;
          xp: number;
        },
        Name
      >;
      eraseSubject: FunctionReference<
        "mutation",
        "internal",
        { batch?: number; scope: string; subjectRef: string },
        number,
        Name
      >;
      recordActivity: FunctionReference<
        "mutation",
        "internal",
        {
          expectedPrevious?: string;
          key: string;
          periodKey: string;
          scope: string;
          subjectRef: string;
          thresholds: Array<number>;
        },
        {
          lastPeriodKey?: string;
          level: number;
          maxStreak: number;
          streak: number;
          streakDelta: number;
          updatedAt: number;
          xp: number;
        },
        Name
      >;
      reset: FunctionReference<
        "mutation",
        "internal",
        { key: string; scope: string; subjectRef: string },
        null,
        Name
      >;
    };
    queries: {
      get: FunctionReference<
        "query",
        "internal",
        {
          key: string;
          scope: string;
          subjectRef: string;
          thresholds?: Array<number>;
        },
        null | {
          lastPeriodKey?: string;
          level: number;
          maxStreak: number;
          streak: number;
          updatedAt: number;
          xp: number;
        },
        Name
      >;
    };
  };
