
## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

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
- Deploy trigger: `eas update --branch production --message "Release $(git describe --tags --abbrev=0 2>/dev/null || git log -1 --format=%s)"`
- Deploy platforms: `--platform all` (Android + iOS)
- Deploy status: check EAS dashboard at https://expo.dev/accounts/vinesight/projects/vinesight-rn/updates
- Health check: none (mobile app — no HTTP endpoint; verify via EAS dashboard)

### Notes
- `expo-updates` package must be installed and `runtimeVersion` set in app.config.js before OTA updates work
- For native code changes (new plugins, SDK upgrades): use `eas build --profile production --platform all` + `eas submit` instead
- Build locally: `npm run build:android:production:local` (AAB) or `npm run build:android:preview:local` (APK)
