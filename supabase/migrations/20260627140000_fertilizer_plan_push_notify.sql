-- Push notification when a consultant sends a fertilizer plan.
--
-- An AFTER INSERT trigger on `fertilizer_plans` calls the `fertilizer-plan-notify`
-- edge function via pg_net. The function resolves the farm owner's push devices
-- and sends the Expo push. pg_net.http_post is async (queued by a background
-- worker), so it never blocks or fails the inserting transaction.
--
-- Required secret (Supabase Vault) — the trigger no-ops until it is set, so plan
-- creation is never affected:
--   select vault.create_secret('<random-token>', 'FERTILIZER_PLAN_NOTIFY_AUTH');
-- The same '<random-token>' must also be set as the FERTILIZER_PLAN_NOTIFY_AUTH
-- env var on the edge function. (Mirrors the existing FEATURE_OVERVIEW_REMINDERS_AUTH
-- convention.) The project URL below is public, not a secret.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_fertilizer_plan_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_auth text;
  v_url text := 'https://ibczxoiaonssyzsybebu.supabase.co/functions/v1/fertilizer-plan-notify';
begin
  select decrypted_secret into v_auth
    from vault.decrypted_secrets where name = 'FERTILIZER_PLAN_NOTIFY_AUTH' limit 1;

  -- Secret not configured yet: skip silently so plan creation never fails.
  if v_auth is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_auth,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('plan_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_fertilizer_plan_created on public.fertilizer_plans;
create trigger trg_notify_fertilizer_plan_created
  after insert on public.fertilizer_plans
  for each row
  execute function public.notify_fertilizer_plan_created();
