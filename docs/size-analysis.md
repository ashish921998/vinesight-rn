# Size Analysis (Sentry)

Monitors the app's **download / install size** and posts a **size-diff status check on every code PR** (docs-only PRs are skipped), so size regressions get caught before they ship. Especially relevant for our users on constrained storage and slow connections.

Powered by [Sentry Size Analysis](https://docs.sentry.io/product/size-analysis/). Sentry is already wired into this app (`@sentry/react-native`, org `vinesight-6s`, project `react-native`).

## How it works

`.github/workflows/size-analysis.yml` runs on:

| Trigger | Build type | Purpose |
| --- | --- | --- |
| Push to `main` | **base** (no `base-sha`) | Establishes the baseline that PRs diff against |
| Pull request to `main` | **head** (`head-sha` = PR head, `base-sha` = merge-base, `pr-number`) | Produces the per-PR size diff + status check |

> The workflow checks out the **exact PR head commit** (not the merge ref) and uses the **merge-base** as `base-sha`, so the diff reflects only what the PR changed — not commits that landed on `main` after the branch was created.

Each run, per platform:

1. Builds the app with **`eas build --local`** on a free GitHub runner — Android on `ubuntu-latest`, iOS on `macos-latest`. Because the repo is public, GitHub Actions minutes (including macOS) are free, and `--local` means **no EAS cloud build quota is consumed**.
2. Uploads the artifact (Android AAB / iOS IPA) via **`sentry-cli build upload`** with the commit + PR metadata.
3. Sentry generates the comparison and posts the status check on the PR.

## One-time setup

These steps are **manual** — the workflow can't do them for you.

### 1. Add the `SENTRY_AUTH_TOKEN` secret

- Create an org auth token in Sentry: **Settings → Auth Tokens** (it needs build/release upload scope; the default org token works).
- Add it as a GitHub Actions secret:

  ```sh
  gh secret set SENTRY_AUTH_TOKEN -R ashish921998/vinesight-rn
  ```

  `EXPO_TOKEN` is already configured.

### 2. Install the Sentry GitHub App

Status checks are posted by the Sentry GitHub App, not by `GITHUB_TOKEN`. Install/authorize it for `ashish921998/vinesight-rn`:

- Sentry → **Settings → Integrations → GitHub** → add/configure the repo.
- Accept the latest permissions so Sentry can post **status checks**.

Without this, builds still upload and the size dashboard works, but no PR check appears.

### 3. (iOS only, if needed) `EXPO_APPLE_TEAM_ID`

The iOS build pulls signing credentials from EAS via `EXPO_TOKEN`. If a non-interactive iOS build can't resolve the Apple team, add:

```sh
gh secret set EXPO_APPLE_TEAM_ID -R ashish921998/vinesight-rn
```

## First run

- **Until `SENTRY_AUTH_TOKEN` is set, the workflow skips the build/upload entirely** (a `preflight` job gates it) — so PRs opened before setup is finished won't fail or burn build minutes. Note: adding the secret does **not** retroactively re-run already-skipped runs — push a new commit or re-run the workflow to pick it up.
- **Fork PRs are skipped by design.** GitHub doesn't expose repo secrets to `pull_request` runs from forks, so the preflight gate short-circuits them. (Don't switch to `pull_request_target` to "fix" this — it would leak secrets to untrusted code.)
- The **first PR check needs a base build to exist on `main`.** Merge this workflow to `main` first (or push once) so a base build is uploaded; the diff appears on PRs after that.
- The first native CI build may need a shakeout (NDK download, credentials). `fail-fast: false` means Android and iOS are independent — one can succeed while the other is sorted out.
- Builds are **size-only**: runtime config like the Google Maps key may be empty in CI. That doesn't affect measured size.

## Tuning

- **Drop iOS** (to halve CI time / keep Android-only): remove the `ios` entry from the `matrix.include` in the workflow.
- **Fewer builds:** narrow the `paths-ignore` list, or restrict triggers. Note size changes mostly come from **JS deps**, not just native dirs — so don't path-filter to `android/`/`ios/` only.
- **Alerts beyond PRs:** configure [Mobile Builds Monitors](https://docs.sentry.io/product/monitors-and-alerts/monitors/) in Sentry (e.g. Slack alert when a nightly grows > 2%).
- **Budget:** Sentry includes 100 builds/month of Size Analysis. Each push/PR build counts; tune triggers if you approach the cap.
