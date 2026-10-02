BEGIN;
SET LOCAL statement_timeout = '15s';
DO $test$
DECLARE actor uuid; target_org uuid;
BEGIN
  SELECT o.id,p.id INTO STRICT target_org,actor
  FROM public.organizations o CROSS JOIN public.profiles p
  WHERE o.created_by IS DISTINCT FROM p.id
    AND NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id=o.id AND m.user_id=p.id)
  LIMIT 1;
  PERFORM set_config('test.target_org',target_org::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
END $test$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE new_org uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO public.organization_members(organization_id,user_id,role,is_owner)
    VALUES(current_setting('test.target_org')::uuid,auth.uid(),'admin',false);
    RAISE EXCEPTION 'Unrelated user could join another organization';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.organizations(id,name,slug,created_by)
    VALUES(new_org,'Advisor regression test','advisor-test-' || new_org,gen_random_uuid());
    RAISE EXCEPTION 'Creator impersonation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO public.organizations(id,name,slug,created_by)
  VALUES(new_org,'Advisor regression test','advisor-test-' || new_org,auth.uid());
  INSERT INTO public.organization_members(organization_id,user_id,role,is_owner)
  VALUES(new_org,auth.uid(),'admin',true);
  IF NOT public.is_org_admin(new_org) THEN
    RAISE EXCEPTION 'Creator bootstrap failed';
  END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: unrelated membership denied, creator impersonation denied, creator self-membership works; all test writes rolled back' AS result;
