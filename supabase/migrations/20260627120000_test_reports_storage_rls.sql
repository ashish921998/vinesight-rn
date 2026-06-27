-- Lab-test report parsing uploads the PDF/image to the private `test-reports`
-- bucket from the client, then passes the object path to the `dynamic-api`
-- edge function (which reads + deletes it via the service role). This avoids
-- sending the file as a base64 JSON body, which exceeds the edge-function
-- request body limit (~1-2MB) and causes the request to hang.
--
-- RLS is enabled on storage.objects with no policies, so authenticated clients
-- currently cannot write. These owner-scoped policies let a user manage only
-- files under their own `${auth.uid()}/...` prefix in `test-reports`.

create policy "test_reports_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'test-reports'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "test_reports_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'test-reports'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "test_reports_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'test-reports'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
