# Supabase advisor remediation — 2026-09-15

Project: `supabase-lime-dog` (`ibczxoiaonssyzsybebu`).

## Applied and verified

Seven migrations were applied to the live database and saved locally with matching remote migration versions.

| Advisor finding | Before | After |
| --- | ---: | ---: |
| Anonymous SECURITY DEFINER execution | 41 | 0 |
| Authenticated SECURITY DEFINER execution | 44 | 25 |
| Mutable function search path | 27 | 0 |
| Extensions in public | 2 | 0 |
| Email OTP expiry above one hour | 1 | 0 |
| Repeated auth evaluation in RLS | 160 | 0 |
| Duplicate index groups | 4 | 0 |
| Multiple permissive policy findings | 104 | 68 |

- Revoked PUBLIC and explicit anon grants on privileged functions. Backend operations and trigger functions also lost authenticated EXECUTE; service_role access remains.
- Postgres-owned new functions no longer automatically grant EXECUTE to PUBLIC, anon, or authenticated. Future app RPC migrations must grant authenticated access explicitly after implementing authorization.
- Set trusted search paths with pg_catalog first and pg_temp last; empty search paths were retained where already used.
- Added ownership checks to start_farm_season, end_farm_season, and recompute_farm_season_assignments. Trusted maintenance sessions and service-role jobs remain supported.
- Restricted organization insertion to the actual creator, and membership insertion to existing admins or the creator's self-membership. Service-only invite acceptance remains available.
- Cached request-constant auth values in 160 policies without changing their access predicates or roles.
- Removed eight exactly identical RLS policies, checking equivalence before deletion.
- Removed three standalone duplicate indexes and the duplicate user_push_devices_user_id_expo_push_token_key constraint. The canonical user_push_devices_user_token_key uniqueness constraint remains.
- Relocated vector and btree_gist to extensions. Function search paths support the relocated operators.
- Changed mailer_otp_exp from 86400 to 1800 seconds using the Management API; a fresh GET confirmed the value.

## Validation

- supabase/tests/advisor_security_regression.sql passed against the live database: no privileged anonymous execution, backend service grants retained, app RPC grants retained, cross-user season operations denied, owner authorization accepted, workspace query and organization helper worked.
- supabase/tests/organization_membership_security.sql passed: unrelated membership insertion and creator impersonation denied; creator organization/bootstrap membership succeeded. All test writes were rolled back.
- Both vector search functions executed after extension relocation.
- Re-ran security and performance advisors after all migrations.
- Validation covers database authorization and SQL execution, not a full mobile or web UI regression.

## Remaining items

1. **Postgres upgrade completed:** GA supabase-postgres-17.6.1.166 is live and the project is ACTIVE_HEALTHY. Tracking ID `ba3a1b9d-ec88-4743-88c4-1bdf129b20e9` reports successful completion (status 1, 10_completed_post_physical_backup). Started 2026-09-15 15:10:53 UTC; completed 15:17:59 UTC. Both database regression suites passed again after the upgrade, and the vulnerable_postgres_version advisor warning is cleared.
2. **Leaked-password protection:** enabling password_hibp_enabled returned HTTP 402: available on Pro plans and above. It remains disabled; no billing change was made.
3. **25 authenticated SECURITY DEFINER findings:** retained deliberately for app RPCs and RLS authorization helpers. These functions check the current user, check farm/client permissions, or filter results by the current user. Do not blindly revoke or switch to invoker; that can break authorized app access or recursive RLS helpers.
4. **RLS enabled without policies on farm_setup_reminder_state:** intentional backend-only storage. Client access remains blocked.
5. **68 multiple-permissive-policy findings:** include distinct owner, organization, and assignee access routes, plus some overlapping legacy policies. Only exact duplicates were removed. Further consolidation requires explicit access-equivalence tests across those user types.
6. **21 unindexed foreign keys / 198 unused indexes after upgrade (90 before):** informational, retained for workload-based review. A new database instance has a fresh statistics observation window, so the post-upgrade unused-index count must not be treated as evidence to delete indexes. Largest public table at inspection was approximately 3,332 rows; no blanket index creation/deletion was performed.

References: [Function privileges](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RLS optimization](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select), [Postgres upgrades](https://supabase.com/docs/guides/platform/upgrading).
