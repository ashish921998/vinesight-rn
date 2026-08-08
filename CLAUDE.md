## Deploy Configuration (configured by /setup-deploy)
- Platform: Expo / EAS (Expo Application Services)
- Project type: React Native mobile app (iOS + Android)
- EAS Project ID: ede2bb37-3ad0-4503-9522-02bd1539e79b
- Android package: com.vinesight.app (Google Play — internal track)
- iOS bundle: com.vinesight.ios (App Store / TestFlight)
- Deploy workflow: EAS Update (OTA hot-update) on merge to main
- Merge method: squash

### Custom deploy hooks
- Pre-merge: `npm run lint && npm run typecheck && npm run test -- --ci`
- Dead-code scan (advisory, not gating): `npm run knip` — see `knip.json`. Reports unused files, exports, dependencies. Triaged list of known-but-acceptable findings tracked separately.
- Deploy trigger: `eas update --branch production --platform all --message "Release $(git describe --tags --abbrev=0 2>/dev/null || git log -1 --format=%s)"`
- Deploy status: check EAS dashboard at https://expo.dev/accounts/vinesight/projects/vinesight-rn/updates
- Health check: none (mobile app — no HTTP endpoint; verify via EAS dashboard)

### Notes
- **OTA is active** — `expo-updates` installed, `runtimeVersion` uses fingerprint policy. A new store build (both platforms) is required before OTA updates will be delivered, since existing binaries lack the native expo-updates module. Use `npm run update:staging` / `npm run update:production` to publish.
- For native code changes (new plugins, SDK upgrades): use `eas build --profile production --platform all` + `eas submit` instead
- Build locally: `npm run build:android:production:local` (AAB) or `npm run build:android:preview:local` (APK)
