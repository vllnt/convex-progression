import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

import { DEFAULT_SCOPE } from "../shared.js";

import type {
  AccrueResult,
  ActivityResult,
  ProgressionOptions,
  ProgressState,
} from "./types.js";

/**
 * Shape of the mounted component reference, `components.progression` in the
 * host's `convex/_generated/api`. Pass it to `new Progression(...)`.
 */
export type ProgressionComponent = {
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
      AccrueResult
    >;
    eraseSubject: FunctionReference<
      "mutation",
      "internal",
      { batch?: number; scope: string; subjectRef: string },
      number
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
      ActivityResult
    >;
    reset: FunctionReference<
      "mutation",
      "internal",
      { key: string; scope: string; subjectRef: string },
      null
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
        thresholds?: number[];
      },
      null | ProgressState
    >;
  };
};

type RunQueryCtx = {
  runQuery<TQuery extends FunctionReference<"query", "internal">>(
    reference: TQuery,
    arguments_: FunctionArgs<TQuery>,
  ): Promise<FunctionReturnType<TQuery>>;
};

type RunMutationCtx = {
  runMutation<TMutation extends FunctionReference<"mutation", "internal">>(
    reference: TMutation,
    arguments_: FunctionArgs<TMutation>,
  ): Promise<FunctionReturnType<TMutation>>;
};

/**
 * Host-side client for one mounted progression component. Call its methods
 * from host Convex mutations and queries after authorizing the caller; the
 * component never reads auth. Every method takes an optional `scope`, which
 * defaults to `defaultScope` (`"global"`).
 *
 * @see https://oss.vllnt.com/packages/convex-progression
 */
export class Progression {
  private readonly defaultScope: string;

  /**
   * @param component - The mounted component, e.g. `components.progression`.
   * @param options - `defaultScope`, the scope for calls that pass none.
   */
  constructor(
    private readonly component: ProgressionComponent,
    options: ProgressionOptions = {},
  ) {
    this.defaultScope = options.defaultScope ?? DEFAULT_SCOPE;
  }

  private scopeOf(scope?: string): string {
    return scope ?? this.defaultScope;
  }

  /**
   * Adds `delta` XP to the `(scope, subjectRef, key)` row, creating it when
   * missing, and sets `level` to the number of `thresholds` the new total has
   * reached. Not event-idempotent. Throws `ConvexError` `INVALID_REF`,
   * `INVALID_DELTA`, `INVALID_THRESHOLDS` or `XP_OVERFLOW`.
   */
  accrue(
    ctx: RunMutationCtx,
    subjectRef: string,
    key: string,
    delta: number,
    thresholds: number[],
    scope?: string,
  ): Promise<AccrueResult> {
    return ctx.runMutation(this.component.mutations.accrue, {
      delta,
      key,
      scope: this.scopeOf(scope),
      subjectRef,
      thresholds,
    });
  }

  /**
   * Records activity in the host period `periodKey`. The stored period again:
   * streak unchanged. The stored period equals `options.expectedPrevious`:
   * streak + 1. Otherwise the streak restarts at 1. Also recomputes `level`
   * from `thresholds`. Throws `ConvexError` `INVALID_REF`, `INVALID_THRESHOLDS`
   * or `STREAK_OVERFLOW`.
   */
  recordActivity(
    ctx: RunMutationCtx,
    subjectRef: string,
    key: string,
    periodKey: string,
    thresholds: number[],
    options: { expectedPrevious?: string; scope?: string } = {},
  ): Promise<ActivityResult> {
    return ctx.runMutation(this.component.mutations.recordActivity, {
      expectedPrevious: options.expectedPrevious,
      key,
      periodKey,
      scope: this.scopeOf(options.scope),
      subjectRef,
      thresholds,
    });
  }

  /**
   * Returns the progress row, or `null` when none exists (also for an empty or
   * over-long ref). With `thresholds`, the returned `level` counts those
   * thresholds against the stored XP; the stored row does not change. Throws
   * `ConvexError` `INVALID_THRESHOLDS`.
   */
  get(
    ctx: RunQueryCtx,
    subjectRef: string,
    key: string,
    scope?: string,
    thresholds?: number[],
  ): Promise<null | ProgressState> {
    return ctx.runQuery(this.component.queries.get, {
      key,
      scope: this.scopeOf(scope),
      subjectRef,
      thresholds,
    });
  }

  /**
   * Deletes the `(scope, subjectRef, key)` row and returns `null`, whether or
   * not the row existed. Throws `ConvexError` `INVALID_REF`.
   */
  reset(
    ctx: RunMutationCtx,
    subjectRef: string,
    key: string,
    scope?: string,
  ): Promise<null> {
    return ctx.runMutation(this.component.mutations.reset, {
      key,
      scope: this.scopeOf(scope),
      subjectRef,
    });
  }

  /**
   * Deletes up to `batch` of the subject's rows in the scope (default 200,
   * clamped to 500) and returns the number of rows this call deleted. A full
   * batch schedules another pass. Throws `ConvexError` `INVALID_REF` or
   * `INVALID_BATCH`.
   */
  eraseSubject(
    ctx: RunMutationCtx,
    subjectRef: string,
    scope?: string,
    batch?: number,
  ): Promise<number> {
    return ctx.runMutation(this.component.mutations.eraseSubject, {
      batch,
      scope: this.scopeOf(scope),
      subjectRef,
    });
  }
}

export {
  type AccrueResult,
  type ActivityResult,
  type ProgressionOptions,
  type ProgressState,
} from "./types.js";
