BEGIN;
SET LOCAL statement_timeout = '15s';
DO $test$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef
  LOOP
    IF has_function_privilege('anon', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous access remains: %', f.proname;
    END IF;
  END LOOP;
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('accept_organization_invite','remove_organization_member','assistant_purge_expired_data','claim_due_farm_setup_reminders','begin_farm_setup_reminder_dispatch','finish_farm_setup_reminder_claim')
  LOOP
    IF has_function_privilege('authenticated', f.oid, 'EXECUTE') OR NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Incorrect backend grants: %', f.proname;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('authenticated','public.start_farm_season(bigint,date,text,jsonb,text,text,integer)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.assistant_delete_user_data(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_professional_workspace()','EXECUTE') THEN
    RAISE EXCEPTION 'App RPC access lost';
  END IF;
END $test$;
DO $test$
DECLARE f record;
BEGIN
  SELECT id,user_id INTO STRICT f FROM public.farms WHERE user_id IS NOT NULL LIMIT 1;
  PERFORM set_config('test.farm_id',f.id::text,true);
  PERFORM set_config('test.owner_id',f.user_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text,true);
END $test$;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE farm_id bigint := current_setting('test.farm_id')::bigint;
BEGIN
  BEGIN
    PERFORM public.start_farm_season(farm_id,NULL);
    RAISE EXCEPTION 'Cross-user start was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.end_farm_season(farm_id,NULL);
    RAISE EXCEPTION 'Cross-user end was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.recompute_farm_season_assignments(farm_id);
    RAISE EXCEPTION 'Cross-user recompute was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('test.owner_id'))::text,true);
  BEGIN
    PERFORM public.start_farm_season(farm_id,NULL);
    RAISE EXCEPTION 'Expected date validation';
  EXCEPTION WHEN null_value_not_allowed THEN NULL;
  END;
  PERFORM public.get_professional_workspace();
  PERFORM public.is_org_member('00000000-0000-0000-0000-000000000000');
END $test$;
ROLLBACK;
SELECT 'PASS: anonymous/backend grants, authenticated app access, cross-user season denial, owner authorization and workspace query' AS result;
