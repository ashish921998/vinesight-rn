-- Lab-test report parsing uploads the PDF/image to the private `test-reports`
-- bucket from the client, then passes the object path to the `dynamic-api`
-- edge function (which reads + deletes it via the service role). This avoids
-- sending the file as a base64 JSON body, which exceeds the edge-function
-- request body limit (~1-2MB) and causes the request to hang.
--
-- RLS is enabled on storage.objects with no policies, so authenticated clients
-- currently cannot write. These owner-scoped policies let a user manage only
-- files under their own `${auth.uid()}/...` prefix in `test-reports`.

-- Create the private bucket the policies below reference. The size + MIME limits
-- are enforced by Storage at upload time, so oversized or unsupported files are
-- rejected before they ever reach the edge function. On conflict we converge an
-- existing bucket to these limits (e.g. one created earlier with a 32MB cap), so
-- the config is the same regardless of prior state. The client converts camera
-- formats to JPEG before upload, so the narrow MIME allowlist is sufficient.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'test-reports',
  'test-reports',
  false,
  10485760, -- 10MB, matches MAX_FILE_SIZE in the dynamic-api edge function
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Defense-in-depth: ensure RLS is on for storage.objects. Supabase ships it
-- enabled by default, but if it were ever disabled in an environment these
-- owner-scoped policies would silently become no-ops and the bucket would be
-- wide open. Idempotent.
alter table storage.objects enable row level security;

-- Drop-then-create keeps the migration idempotent: these policies already exist
-- in environments where they were created out-of-band (e.g. via the dashboard),
-- and a bare `create policy` would fail there with a duplicate-policy error.
drop policy if exists "test_reports_insert_own" on storage.objects;
create policy "test_reports_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'test-reports'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "test_reports_select_own" on storage.objects;
create policy "test_reports_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'test-reports'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "test_reports_delete_own" on storage.objects;
create policy "test_reports_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'test-reports'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
