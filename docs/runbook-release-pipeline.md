# Runbook: Release pipeline

The `release` GitHub Actions workflow handles production builds for
iOS and Android via EAS Build. App Store / Play Store submission is
optional and gated behind a manual workflow_dispatch.

## One-time setup

You'll do this once before the first tag-driven release.

### GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | What it is | How to get it |
|---|---|---|
| `EXPO_TOKEN` | EAS access token | https://expo.dev → Account Settings → Access Tokens |
| `SLACK_ALERT_WEBHOOK` | Optional, for build status pings | Slack: Add an incoming webhook to the channel of your choice |

### EAS submit credentials

These live on Expo's servers, not in this repo. Run once each from a
machine logged in to EAS (`eas login`):

```bash
# iOS — App Store Connect API key (.p8 file)
eas credentials -p ios
# Pick: production → App Store Connect API Key → upload your .p8

# Android — Play service account JSON
eas credentials -p android
# Pick: production → Google Service Account Key → upload your service-account.json
```

After this, EAS knows the credentials by reference; `eas.json` only
needs the placeholder paths (which currently say `PUT_ASC_APP_ID_HERE`
— replace with the real ASC app ID).

### eas.json fill-ins

Edit `eas.json` `submit.production`:

- `ios.appleTeamId` is already set to `Y953XF3N6C`
- `ios.ascAppId` — replace `PUT_ASC_APP_ID_HERE` with the numeric
  App Store Connect app ID (find at https://appstoreconnect.apple.com
  → My Apps → Lyfe → App Information → Apple ID)
- `android.serviceAccountKeyPath` — `./google-play-service-account.json`
  is the convention; the file itself is .gitignored. EAS pulls
  from EAS credentials at submit time, so this path is mostly cosmetic.

## Cutting a release

```bash
# 1. Make sure main is green and migrations are applied.
git checkout main && git pull
npx tsc --noEmit && npm test

# 2. Bump version in package.json + app.config.js (these stay in sync
#    even though EAS owns build numbers — `version` is the user-visible
#    "1.4.0", build number is auto-incremented by EAS).
#    Edit both files manually OR use:
npm version minor --no-git-tag-version
# (also update app.config.js by hand to match)

# 3. Commit + tag.
git commit -am "release: v1.4.0"
git tag v1.4.0
git push origin main v1.4.0

# 4. The `release-build` job kicks off automatically. Watch it in
#    https://github.com/<owner>/<repo>/actions
```

The build job takes 15-25 minutes. EAS sends an email when iOS
and Android binaries are ready.

## Submitting to the stores

The workflow does NOT auto-submit. To submit:

```bash
# Via GitHub UI:
# Actions → Release → Run workflow → submit: yes
# (or via CLI:)
gh workflow run release.yml -f submit=yes
```

The submit job:
- iOS → uploaded to App Store Connect → moves into TestFlight processing.
  The first internal/external build needs review, future ones auto-process.
- Android → uploaded to Play Console → goes to the **internal** track
  (configured in `eas.json android.track`). Promote manually from the
  Play Console UI to closed/open testing or production.

## Rollback

Once a build is in the App Store / Play Store, you cannot recall it
silently. Rollback options:

- **TestFlight**: in App Store Connect, expire the build (TestFlight tab → Build → Expire).
- **App Store production**: submit a new build with the bug reverted; Apple review is 24-48h.
- **Play Internal**: deactivate the bad release in Play Console; Internal updates land in <1h.
- **Play production**: same as iOS — submit a new build.

There's no OTA (over-the-air) updates configured (`expo-updates` is not in
the dependency list). Add it post-launch if you want a faster rollback path.

## Notes on version drift

`package.json` version stays in sync with `app.config.js` `version`. EAS
auto-increments the platform build number (CFBundleVersion / versionCode)
which is what users actually see in TestFlight/Play. The Sentry release
tag combines the static version + the EAS-managed build number via
`Constants.nativeBuildVersion` so each build has a distinct release+dist
identifier (see `lib/sentry.ts`).

## Related
- `eas.json` — build profiles + submit configuration
- `app.config.js` — bundle ID, version, native config
- `docs/runbook-incident-supabase-down.md` — what to expect during a deploy if Supabase is also having issues
