import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type {
  AccrueResult,
  ActivityResult,
  ProgressionOptions,
  ProgressState,
} from "./types.js";
import { DEFAULT_ERASE_BATCH, DEFAULT_SCOPE } from "../shared.js";

export interface ProgressionComponent {
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
      ProgressState | null
    >;
  };
}

interface RunQueryCtx {
  runQuery<Q extends FunctionReference<"query", "internal">>(
    reference: Q,
    args: FunctionArgs<Q>,
  ): Promise<FunctionReturnType<Q>>;
}

interface RunMutationCtx {
  runMutation<M extends FunctionReference<"mutation", "internal">>(
    reference: M,
    args: FunctionArgs<M>,
  ): Promise<FunctionReturnType<M>>;
}

export class Progression {
  private readonly defaultScope: string;

  constructor(
    private readonly component: ProgressionComponent,
    options: ProgressionOptions = {},
  ) {
    this.defaultScope = options.defaultScope ?? DEFAULT_SCOPE;
  }

  private scopeOf(scope?: string): string {
    return scope ?? this.defaultScope;
  }

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

  recordActivity(
    ctx: RunMutationCtx,
    subjectRef: string,
    key: string,
    periodKey: string,
    thresholds: number[],
    opts: { expectedPrevious?: string; scope?: string } = {},
  ): Promise<ActivityResult> {
    return ctx.runMutation(this.component.mutations.recordActivity, {
      expectedPrevious: opts.expectedPrevious,
      key,
      periodKey,
      scope: this.scopeOf(opts.scope),
      subjectRef,
      thresholds,
    });
  }

  get(
    ctx: RunQueryCtx,
    subjectRef: string,
    key: string,
    scope?: string,
    thresholds?: number[],
  ): Promise<ProgressState | null> {
    return ctx.runQuery(this.component.queries.get, {
      key,
      scope: this.scopeOf(scope),
      subjectRef,
      thresholds,
    });
  }

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

export type { AccrueResult, ActivityResult, ProgressionOptions, ProgressState };
