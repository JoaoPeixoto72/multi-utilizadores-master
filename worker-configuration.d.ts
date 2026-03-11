/// <reference types="@cloudflare/workers-types" />

import type {
  D1Database as _D1Database,
  R2Bucket as _R2Bucket,
  Queue as _Queue,
  DurableObjectNamespace as _DurableObjectNamespace,
  Fetcher as _Fetcher,
  ExecutionContext as _ExecutionContext,
  ScheduledEvent as _ScheduledEvent,
  ExportedHandlerFetchHandler as _ExportedHandlerFetchHandler,
  DurableObjectState as _DurableObjectState
} from "@cloudflare/workers-types";

declare global {
  type D1Database = _D1Database;
  type R2Bucket = _R2Bucket;
  type Queue = _Queue;
  type DurableObjectNamespace = _DurableObjectNamespace;
  type Fetcher = _Fetcher;
  type ExecutionContext = _ExecutionContext;
  type ScheduledEvent = _ScheduledEvent;
  type ExportedHandlerFetchHandler<E = unknown, I extends Request = Request> = _ExportedHandlerFetchHandler<E, I>;
  type DurableObjectState = _DurableObjectState;

  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    RATE_LIMITER: DurableObjectNamespace;
    R2_BUCKET: R2Bucket;
    BACKUP_QUEUE: Queue;
    CSRF_SECRET: string;
    SESSION_SECRET: string;
    ENCRYPTION_KEY: string;
    CF_ACCOUNT_ID: string;
    CF_API_TOKEN: string;
    APP_ENV: string;
    APP_URL?: string;
    SENTRY_DSN?: string;
  }
}
