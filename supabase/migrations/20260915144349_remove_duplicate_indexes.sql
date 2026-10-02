-- Preserve one identical index per group, including the canonical local unique constraint.
SET lock_timeout = '5s';
DROP INDEX public.farm_seasons_farm_end_idx;
DROP INDEX public.idx_organization_members_organization_id;
DROP INDEX public.idx_organization_members_user_id;
ALTER TABLE public.user_push_devices DROP CONSTRAINT user_push_devices_user_id_expo_push_token_key;
