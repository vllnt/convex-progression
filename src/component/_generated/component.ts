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

type ProgressState = {
  lastPeriodKey?: string;
  level: number;
  maxStreak: number;
  streak: number;
  updatedAt: number;
  xp: number;
};

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
          thresholds: number[];
        },
        ProgressState & { leveledUp: boolean; previousLevel: number },
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
          thresholds: number[];
        },
        ProgressState & { streakDelta: number },
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
        { key: string; scope: string; subjectRef: string; thresholds?: number[] },
        ProgressState | null,
        Name
      >;
    };
  };
