# Push notifications — one-time setup (FCM for Android, APNs for iOS)

The consultant→farmer fertilizer-plan push pipeline (DB trigger → `fertilizer-plan-notify`
edge function → Expo Push API → device) is **deployed and working**. The only thing
gating real (non-Expo-Go) devices is **per-app push credentials**:

- **Android push *is* FCM** (Firebase Cloud Messaging) — Google's is the only delivery
  channel. A standalone Vinesight build cannot register for push without it. (Expo Go
  works because it bundles Expo's *own* FCM credentials.)
- **iOS** uses Apple APNs, which **EAS auto-provisions at build time** — no manual step.

## Part 1 — Firebase (get two files) — requires your Google account

1. <https://console.firebase.google.com> → **Add project** (or reuse the existing GCP
   "vinesight" project).
2. Inside the project → **Add app → Android** → Android package name **exactly**
   `com.vinesight.app` → Register.
3. **Download `google-services.json`.**
4. Gear → **Project settings → Cloud Messaging** → ensure **Firebase Cloud Messaging
   API (V1)** is **Enabled**.
5. **Project settings → Service accounts → Generate new private key** → downloads a
   **service-account JSON** (this is the FCM V1 key Expo uses to deliver).

## Part 2 — Hand the credentials to EAS

6. **`google-services.json` → the build** (do for BOTH `production` and `preview`):
   - Dashboard: EAS project → **Environment variables** → New → name
     `GOOGLE_SERVICES_JSON`, type **File**, upload the file, scope `production`
     (repeat for `preview`).
   - or CLI: `eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production`
7. **FCM V1 key → Expo:** `eas credentials` → **Android** → **Push Notifications
   (FCM V1)** → upload the service-account JSON from step 5.

## Part 3 — iOS

Nothing — EAS provisions APNs when it builds.

## Part 4 — Ship & verify (after Parts 1–2)

8. Merge **#176** (wires `google-services.json` into `app.config.js`). NOTE: do this only
   **after** step 6, or Android builds fail looking for a missing `google-services.json`.
9. `eas build --profile preview --platform all` → install both on real devices.
10. Send/insert a fertilizer plan for a test farm → push arrives, branded **Vinesight**,
    on iOS **and** Android.

## Notes

- `com.vinesight.app` (Android) and `com.vinesight.ios` (iOS) must match the Firebase /
  EAS app identifiers exactly.
- The backend secrets (`supabase_url`, `FERTILIZER_PLAN_NOTIFY_AUTH`) and the edge
  function are already deployed on prod (`ibczxoiaonssyzsybebu`).
