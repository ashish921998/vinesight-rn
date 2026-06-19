-- Rollback for 20260608120000_log_irrigation_atomic_water.sql
-- Drops the atomic irrigation RPCs. After this, the client irrigation path must be
-- reverted to the prior insert-then-update behavior (this app version expects the RPCs).

drop function if exists public.log_irrigation(
  bigint, date, numeric, numeric, text, text, numeric, date, bigint
);
drop function if exists public.revert_irrigation(bigint, numeric);
