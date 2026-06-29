-- Push notification when a consultant sends a fertilizer plan.
--
-- An AFTER INSERT trigger on `fertilizer_plans` calls the `fertilizer-plan-notify`
-- edge function via pg_net. The function resolves the farm owner's push devices
-- and sends the Expo push. pg_net.http_post is async (queued by a background
-- worker), so it never blocks or fails the inserting transaction.
--
-- Required secrets (Supabase Vault) — the trigger no-ops until BOTH are set, so
-- plan creation is never affected:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'supabase_url');
--   select vault.create_secret('<random-token>', 'FERTILIZER_PLAN_NOTIFY_AUTH');
-- The same '<random-token>' must also be set as the FERTILIZER_PLAN_NOTIFY_AUTH
-- env var on the edge function. Reading the project URL from Vault (instead of
-- hardcoding it) keeps each environment calling its own edge function.
-- (Mirrors the existing FEATURE_OVERVIEW_REMINDERS_AUTH convention.)

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_fertilizer_plan_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_auth text;
  v_base_url text;
  v_url text;
begin
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into v_auth
    from vault.decrypted_secrets where name = 'FERTILIZER_PLAN_NOTIFY_AUTH' limit 1;

  -- Secrets not configured yet: skip silently so plan creation never fails.
  if v_base_url is null or v_auth is null then
    return new;
  end if;

  v_url := rtrim(v_base_url, '/') || '/functions/v1/fertilizer-plan-notify';

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
