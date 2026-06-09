-- Rollback for 20260609120000_settle_worker_atomic_balance.sql
-- Drops the atomic settlement RPC. The client falls back to the prior multi-step
-- createWorkerSettlement path only if also reverted in code; deploy/rollback together.

drop function if exists public.settle_worker(
  bigint, date, date, numeric, numeric, numeric, numeric, bigint, text, text
);
