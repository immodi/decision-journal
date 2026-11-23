# Decision Journal

A personal app for recording decisions at the moment they are made — with a
prediction and a confidence level — and reviewing them later. The point is to
judge the quality of the reasoning separately from how things turned out.

The full build specification lives in [`docs/Spec.md`](docs/Spec.md).

## Layout

- `firebase/` — Firestore rules, indexes, emulator tests, deploy config
- `web/` — React + TypeScript client (Vite, Tailwind CSS)
- `android/` — Kotlin app (built in Docker, installed from the host)

## Firebase

The project is `decision-journal-97da7` (Firestore multi-region `eur3`).
`firebase/.firebaserc` points at it.

Deploy rules and indexes after changing them:

```bash
cd firebase
firebase deploy --only firestore:rules,firestore:indexes
```

Run the security-rule tests in the emulator (needs Java; uses port 8081):

```bash
cd firebase
npm install        # first time
npm test
```

Config files:

- `android/app/google-services.json` is committed on purpose: it holds only
  per-project identifiers, and committing it lets CI build the app.
- `web/.env` is not committed; CI is not needed because the web bundle is built
  and deployed locally.
- `android/keystore/` and `android/keystore.properties` are never committed.

## Web client

```bash
cd web
npm install        # first time
npm run dev
```

Then open the printed URL, create an account, and start recording decisions.
`npm run build` produces a static bundle in `web/dist/`.

`web/.env` holds the Firebase web config as `VITE_FIREBASE_*` variables. Set
`VITE_GOOGLE_SIGN_IN=true` to show the Google button.

### Hosting

Deployed on Cloudflare Pages as **https://decision-journal-8wt.pages.dev**.

```bash
cd web
npm run build
npx wrangler pages deploy dist --project-name decision-journal --branch main
```

The bundle is built locally, so `web/.env` values are baked in at build time.
For Google sign-in from the hosted site, `decision-journal-8wt.pages.dev` must
be listed in Firebase console → Authentication → Settings → Authorised domains.
Email/password works without that.

## Android client

The app is built inside the Android SDK container and run on the host's
emulator or device.

```bash
cd android
docker run --rm \
  -v "$PWD:/project" \
  -v decisionjournal-gradle:/root/.gradle \
  -w /project \
  ghcr.io/cirruslabs/android-sdk:35 \
  ./gradlew --no-daemon assembleDebug

adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The named volume keeps Gradle and its dependencies cached between builds; the
first build downloads Gradle 8.9, AGP and the Firebase SDKs.

Toolchain: JDK 21, AGP 8.7.3, Gradle 8.9, Kotlin 2.0.21, min SDK 24,
compile/target SDK 35.

Screens: sign in / register, Home (due + recent, tag and status filters),
new decision, detail (edit, postpone, delete), review, insights, settings.

Reminders: one WorkManager check per day at the saved reminder time. On
Android 13+ the notification permission is requested at launch; the
notification is posted only when at least one open decision is due. WorkManager
timing is approximate.

Google sign-in uses Credential Manager with the project's web client ID
(`google_web_client_id` in `strings.xml`). The provider is enabled on the
project; what remains is registering the app's signing fingerprints under
Firebase console → Project settings → Your apps → Android
`com.modi.decisionjournal` → Add fingerprint:

- debug:   `E7:37:54:39:5A:1D:D6:C1:E5:0C:5E:61:4E:32:18:7B:2A:DF:23:F2`
- release: `42:11:E1:0A:A6:20:29:2D:5E:B1:E7:BB:1B:1B:AB:46:80:85:66:FC`

Keystores live in `android/keystore/` (gitignored). `scripts/create-keystores.sh`
recreates them, and does so only if missing: regenerating the release key
changes the app's signing identity.

## Releases

Local signed release build:

```bash
cd android
docker run --rm -v "$PWD:/project" -v decisionjournal-gradle:/root/.gradle \
  -w /project ghcr.io/cirruslabs/android-sdk:35 \
  ./gradlew --no-daemon assembleRelease -PversionName=0.1.0 -PversionCode=1
```

The APK lands in `android/app/build/outputs/apk/release/`.

CI publishes signed releases from `.github/workflows/android-release.yml`,
either on a `v*` tag or from the Actions tab (Run workflow, with a version).

One-time setup, with an authenticated GitHub CLI:

```bash
gh auth login
./scripts/ci-secrets.sh
```

Then publish:

```bash
./scripts/publish-release.sh 0.1.0
```

That uploads any missing secrets, pushes `main`, starts the workflow and
watches it. Without the script: Actions → Android release → Run workflow →
version `0.1.0`. The workflow creates or updates the matching `v*` tag and
attaches the APK to the GitHub Release. Without the four signing secrets it
fails on purpose rather than publishing an unsigned build.

## Behaviour worth remembering

- Rules, not the UI, enforce the important guarantees: a reviewed decision
  cannot be edited or deleted, and the review date can only move once.
- Server timestamps are required on `createdAt` / `updatedAt`; a device clock
  is rejected.
- The web client filters in memory from one real-time listener. That is fine
  for one person's journal and keeps it offline-capable.
- Both clients follow the system light/dark setting; the web client adds a
  manual toggle in the corner of every screen.
- Errors shown in the interface are plain language. Exception details are
  logged for debugging, never displayed.
