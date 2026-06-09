-- Atomic worker settlement + advance-balance ledger.
--
-- Problem (see docs/multi-device-write-safety.html): confirming a settlement used a
-- client-side read-modify-write of workers.advance_balance — insert the settlement,
-- insert an advance/payment transaction, then read advance_balance, subtract, and write
-- the absolute result back, across several round trips. Two devices settling the same
-- worker concurrently each overwrite the other's balance, silently losing an advance
-- deduction; and a mid-sequence failure left orphaned rows that a best-effort client
-- DELETE tried (and could itself fail) to undo.
--
-- Fix: do the settlement insert, the advance/payment transactions, and the balance
-- decrement in ONE transaction, server-side, computing the new balance from the row's
-- OWN current value under a row lock. All-or-nothing — no client compensating delete.

create or replace function public.settle_worker(
  p_worker_id bigint,
  p_period_start date,
  p_period_end date,
  p_days_worked numeric,
  p_gross_amount numeric,
  p_advance_deducted numeric,
  p_net_payment numeric,
  p_farm_id bigint default null,
  p_status text default 'confirmed',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.workers;
  v_settlement public.worker_settlements;
  v_status text := coalesce(p_status, 'confirmed');
  -- UTC date, matching the client's new Date().toISOString().split('T')[0].
  v_today date := (now() at time zone 'utc')::date;
begin
  -- Ownership: only the worker's owner may settle. Lock the row so the advance-balance
  -- decrement below is serialized against concurrent settlements.
  select * into v_worker
  from public.workers
  where id = p_worker_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Worker % not found or not owned by current user', p_worker_id
      using errcode = '42501';
  end if;

  -- Guard the advance deduction against the worker's *current* balance — closes the
  -- read-then-write race the client-side pre-check alone could not, and prevents
  -- recording a deduction larger than the balance it actually reduces.
  if v_status = 'confirmed'
     and p_advance_deducted > 0
     and p_advance_deducted > v_worker.advance_balance then
    raise exception 'Advance deduction % exceeds current balance % for worker %',
      p_advance_deducted, v_worker.advance_balance, p_worker_id
      using errcode = '23514';
  end if;

  insert into public.worker_settlements (
    worker_id, farm_id, period_start, period_end, days_worked,
    gross_amount, advance_deducted, net_payment, status, notes, confirmed_at
  ) values (
    p_worker_id, p_farm_id, p_period_start, p_period_end, p_days_worked,
    p_gross_amount, p_advance_deducted, p_net_payment, v_status, p_notes,
    case when v_status = 'confirmed' then now() else null end
  )
  returning * into v_settlement;

  if v_status = 'confirmed' then
    -- Advance-deduction transaction + atomic balance decrement (from the row's own value).
    if p_advance_deducted > 0 then
      insert into public.worker_transactions (
        worker_id, farm_id, date, type, amount, settlement_id, notes
      ) values (
        p_worker_id, p_farm_id, v_today, 'advance_deducted', p_advance_deducted, v_settlement.id, null
      );

      update public.workers
      set advance_balance = greatest(0, advance_balance - p_advance_deducted)
      where id = p_worker_id;
    end if;

    -- Payment transaction.
    if p_net_payment > 0 then
      insert into public.worker_transactions (
        worker_id, farm_id, date, type, amount, settlement_id, notes
      ) values (
        p_worker_id, p_farm_id, v_today, 'payment', p_net_payment, v_settlement.id, null
      );
    end if;
  end if;

  return to_jsonb(v_settlement);
end;
$$;

grant execute on function public.settle_worker(
  bigint, date, date, numeric, numeric, numeric, numeric, bigint, text, text
) to authenticated;
