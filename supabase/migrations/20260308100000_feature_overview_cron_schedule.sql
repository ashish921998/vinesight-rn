-- Enable pg_net for HTTP calls from pg_cron
create extension if not exists pg_net with schema extensions;

-- Store the edge function auth token in Supabase Vault.
-- After running this migration, insert the actual secret via Supabase Dashboard:
--   Vault → Secrets → find "feature_overview_reminders_auth" → set the value
-- Or run manually:
--   select vault.create_secret('<your-auth-token>', 'feature_overview_reminders_auth');

-- Schedule the feature overview reminders edge function to run every hour.
-- The function itself checks each user's local timezone for hour === 10.
select cron.schedule(
  'feature-overview-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url   := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url' limit 1)
             || '/functions/v1/feature-overview-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'feature_overview_reminders_auth' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
