-- Move the farm-setup sender off the shared feature-overview credential.
-- The matching FARM_SETUP_REMINDERS_AUTH value must exist in both Supabase
-- Edge Function secrets and Vault before this migration is applied.
do $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'supabase_url'
  ) then
    raise exception 'supabase_url is missing from Vault';
  end if;

  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'FARM_SETUP_REMINDERS_AUTH'
  ) then
    raise exception 'FARM_SETUP_REMINDERS_AUTH is missing from Vault';
  end if;

  for v_job_id in
    select jobid from cron.job where jobname = 'guided-tour-reminders-hourly'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'guided-tour-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url' limit 1)
           || '/functions/v1/guided-tour-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'FARM_SETUP_REMINDERS_AUTH' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
