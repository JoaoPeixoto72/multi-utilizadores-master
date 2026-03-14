/// <reference types="@cloudflare/workers-types" />

import type {
  D1Database as _D1Database,
  R2Bucket as _R2Bucket,
  DurableObjectNamespace as _DurableObjectNamespace,
  ExecutionContext as _ExecutionContext,
  ScheduledEvent as _ScheduledEvent,
  DurableObjectState as _DurableObjectState,
} from "@cloudflare/workers-types";

declare global {
  type D1Database = _D1Database;
  type R2Bucket = _R2Bucket;
  type DurableObjectNamespace = _DurableObjectNamespace;
  type ExecutionContext = _ExecutionContext;
  type ScheduledEvent = _ScheduledEvent;
  type DurableObjectState = _DurableObjectState;

  interface Env {
    DB: D1Database;
    RATE_LIMITER: DurableObjectNamespace;
    R2_BUCKET: R2Bucket;

    CSRF_SECRET: string;
    SESSION_SECRET: string;
    ENCRYPTION_KEY: string;

    CF_ACCOUNT_ID?: string;
    CF_API_TOKEN?: string;

    APP_ENV: string;
    APP_URL: string;
    API_URL: string;
    SENTRY_DSN?: string;
  }
}

export {};


