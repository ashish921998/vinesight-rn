# Subscription & Entitlement System

This document describes the Subscription + Capability implementation for VineSight.

## Overview
- RevenueCat handles purchases on iOS/Android.
- Supabase Edge Functions provide capabilities and gated APIs.
- Supabase Postgres enforces limits and retention (farm/worker limits + retention views).

## Environment Variables
### Mobile (Expo)
Set these in `.env` or EAS secrets:
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` (default: `Vinesight Pro`)
- `EXPO_PUBLIC_REVENUECAT_OFFERING_ID` (default: `ofrng814b5361c2`)
- `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID` (default: `vinesight_pro_monthly`)
- `EXPO_PUBLIC_REVENUECAT_YEARLY_PRODUCT_ID` (default: `vinesight_pro_yearly`)

### Supabase Edge Functions
Set these in Supabase project settings:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `REVENUECAT_WEBHOOK_AUTH` (optional; used to validate webhook Authorization header)
- `REVENUECAT_ENTITLEMENT_ID` (default: `Vinesight Pro`)
- `REVENUECAT_ENTITLEMENT_MAP` (optional JSON mapping entitlement → plan id)

## Database
Run the migration in `supabase/migrations/20260202_subscription.sql`.
This creates:
- `subscriptions`
- `profiles.subscription` (optional override)
- `profiles.trial_started_at` / `profiles.trial_ends_at` / `profiles.trial_used_at` (account-level trial)

## Edge Functions
Deploy these functions:
- `capabilities` – returns effective capabilities for authenticated user
- `lab-trends` – returns trends data, 403 if disabled
- `ai-chat` – backend AI chat, 403 if disabled
- `revenuecat-webhook` – updates `subscriptions` on RevenueCat events

## RevenueCat Webhook
Configure RevenueCat to call the `revenuecat-webhook` function URL.
Set the **Authorization** header in RevenueCat to match `REVENUECAT_WEBHOOK_AUTH`.

If you have multiple paid plans, set `REVENUECAT_ENTITLEMENT_MAP` (example):
```json
{ "Vinesight Pro": "pro", "Vinesight Plus": "plus" }
```

## Notes
- Client uses `capabilities` as source of truth and caches last known capabilities.
- If `profiles.subscription` is set (and no active subscription record exists), it will be used as the plan.
- Account-level trial is started on first capabilities request (no active subscription + no manual plan).
