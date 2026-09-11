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
import { DEFAULT_SCOPE } from "../shared.js";

export interface ProgressionComponent {
  mutations: {
    accrue: FunctionReference<
      "mutation",
      "internal",
      {
        subjectRef: string;
        key: string;
        scope: string;
        delta: number;
        thresholds: number[];
      },
      AccrueResult
    >;
    recordActivity: FunctionReference<
      "mutation",
      "internal",
      {
        subjectRef: string;
        key: string;
        scope: string;
        periodKey: string;
        expectedPrevious?: string;
        thresholds: number[];
      },
      ActivityResult
    >;
    reset: FunctionReference<
      "mutation",
      "internal",
      { subjectRef: string; key: string; scope: string },
      null
    >;
    eraseSubject: FunctionReference<
      "mutation",
      "internal",
      { subjectRef: string; scope: string },
      number
    >;
  };
  queries: {
    get: FunctionReference<
      "query",
      "internal",
      { subjectRef: string; key: string; scope: string },
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
      subjectRef,
      key,
      scope: this.scopeOf(scope),
      delta,
      thresholds,
    });
  }

  recordActivity(
    ctx: RunMutationCtx,
    subjectRef: string,
    key: string,
    periodKey: string,
    thresholds: number[],
    opts: { scope?: string; expectedPrevious?: string } = {},
  ): Promise<ActivityResult> {
    return ctx.runMutation(this.component.mutations.recordActivity, {
      subjectRef,
      key,
      scope: this.scopeOf(opts.scope),
      periodKey,
      expectedPrevious: opts.expectedPrevious,
      thresholds,
    });
  }

  get(
    ctx: RunQueryCtx,
    subjectRef: string,
    key: string,
    scope?: string,
  ): Promise<ProgressState | null> {
    return ctx.runQuery(this.component.queries.get, {
      subjectRef,
      key,
      scope: this.scopeOf(scope),
    });
  }

  reset(
    ctx: RunMutationCtx,
    subjectRef: string,
    key: string,
    scope?: string,
  ): Promise<null> {
    return ctx.runMutation(this.component.mutations.reset, {
      subjectRef,
      key,
      scope: this.scopeOf(scope),
    });
  }

  eraseSubject(
    ctx: RunMutationCtx,
    subjectRef: string,
    scope?: string,
  ): Promise<number> {
    return ctx.runMutation(this.component.mutations.eraseSubject, {
      subjectRef,
      scope: this.scopeOf(scope),
    });
  }
}

export type { AccrueResult, ActivityResult, ProgressionOptions, ProgressState };
