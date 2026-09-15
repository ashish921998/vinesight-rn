-- Remove only policies whose role, command, and predicates exactly match a retained policy.
SET lock_timeout = '5s';

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.calculation_history'::regclass
      AND a.polname = 'Users can access calculation history for their farms' AND b.polname = 'Users can view their farm calculation history'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can view their farm calculation history" ON public."calculation_history";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.expense_records'::regclass
      AND a.polname = 'Users can access expense records for their farms' AND b.polname = 'Users can view their farm expense records'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can view their farm expense records" ON public."expense_records";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.harvest_records'::regclass
      AND a.polname = 'Users can access harvest records for their farms' AND b.polname = 'Users can view their farm harvest records'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can view their farm harvest records" ON public."harvest_records";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.soil_test_records'::regclass
      AND a.polname = 'Users can access soil test records for their farms' AND b.polname = 'Users can view their farm soil test records'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can view their farm soil test records" ON public."soil_test_records";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.spray_records'::regclass
      AND a.polname = 'Users can access spray records for their farms' AND b.polname = 'Users can view their farm spray records'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can view their farm spray records" ON public."spray_records";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.task_reminders'::regclass
      AND a.polname = 'Users can access task reminders for their farms' AND b.polname = 'Users can view their farm task reminders'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can view their farm task reminders" ON public."task_reminders";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.task_reminders'::regclass
      AND a.polname = 'Users can delete farm tasks' AND b.polname = 'Users can delete task reminders for their farms'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can delete task reminders for their farms" ON public."task_reminders";

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy a JOIN pg_policy b ON a.polrelid = b.polrelid
    WHERE a.polrelid = 'public.task_reminders'::regclass
      AND a.polname = 'Users can insert farm tasks' AND b.polname = 'Users can insert task reminders for their farms'
      AND a.polcmd = b.polcmd AND a.polroles = b.polroles
      AND a.polpermissive = b.polpermissive
      AND pg_get_expr(a.polqual, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polqual, b.polrelid)
      AND pg_get_expr(a.polwithcheck, a.polrelid) IS NOT DISTINCT FROM pg_get_expr(b.polwithcheck, b.polrelid)
  ) THEN RAISE EXCEPTION 'Policy pair changed; inspect before deduplicating'; END IF;
END $check$;
DROP POLICY "Users can insert task reminders for their farms" ON public."task_reminders";
