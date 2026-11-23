# Decision Journal: Build Specification

*A spec for building the Android app (Kotlin) and the web client (React) on Firebase. Draft, November 21, 2026.*

## 1. Purpose

A personal app for recording important decisions at the moment they are made, together with a prediction and a confidence level, and reviewing them later. The point is to judge the quality of your reasoning separately from how things turned out, and to notice patterns such as overconfidence or poor decisions made when tired.

Design principles:

- **Fast.** A normal entry takes under two minutes.
- **Honest.** Once a decision has been reviewed, the original entry can no longer be edited, so hindsight can’t rewrite it. The security rules enforce this, not just the UI.
- **Review-centred.** The review is where most of the value is, so the app actively prompts for it.
- **Private.** Only the owner can read or write their data.

## 2. Scope

**In scope for v1:** user accounts (email and password, plus optional Google sign-in), an Android app, a web client, sync between them through Firebase, one postponement per review, review reminders, and an insights screen.

**Out of scope for v1:** sharing or collaboration, AI features, attachments, an iOS app, push notifications on the web.

## 3. Tech stack

- **Backend:** Firebase Authentication and Cloud Firestore on the free (Spark) plan. No custom server and no Cloud Functions in v1.
- **Android:** Kotlin, minimum SDK 24, Material Components, ViewBinding, ViewModel with LiveData, coroutines for the Firebase calls, Firebase Android SDK (via the Firebase BoM and the Kotlin extensions), Credential Manager for the optional Google sign-in, WorkManager for reminders.
- **Web:** React with Vite and TypeScript, React Router, Firebase JS SDK (modular API), and any lightweight charting library (for example Recharts).

Both clients talk directly to Firebase. That means the Firestore security rules in section 5 are the only thing protecting the data, so they must be written and deployed before any real entries are stored.

## 4. Data model

This is the shared contract between both clients. Field names and types must be identical on Android and web.

### Decisions

Path: `users/{uid}/decisions/{decisionId}`

Fields written when the decision is made:

- `title`: string, one line
- `options`: array of strings, the options considered
- `reasoning`: string, two or three sentences on why this option was chosen
- `prediction`: string, one line on what the person expects to happen
- `confidence`: number, integer from 0 to 100
- `state`: string, one of `calm`, `tired`, `stressed`, `rushed`, `anxious`, `excited`, `other`
- `tags`: array of strings (suggested defaults: work, money, relationships, health)
- `reviewDate`: timestamp, when the decision should be reviewed
- `postponedAt`: timestamp, null until the review is postponed. Set once, and only once.
- `createdAt`: timestamp, set by the server
- `updatedAt`: timestamp, set by the server on every write
- `status`: string, either `open` or `reviewed`

Field written at review time, stored as a `review` map that is null until the decision is reviewed:

- `review.reviewedAt`: timestamp, written with `serverTimestamp()`
- `review.outcome`: string, what actually happened
- `review.predictionResult`: string, one of `yes`, `partly`, `no`. This is what makes calibration statistics possible.
- `review.reasoningRating`: string, one of `sound`, `flawed`, `unsure`. This rates the reasoning given what was known at the time, not the outcome.
- `review.lesson`: string, optional, one line

Rules:

- Use server timestamps, not device clocks. `createdAt` and `updatedAt` are written with `serverTimestamp()`, and the security rules reject anything else.
- Write `review` and `postponedAt` explicitly as null when creating a decision, since the rules require both to be null at that point.
- The review date is set once when the decision is created. The single postponement in section 6.5 is the only way to move it afterwards; the edit form does not offer a review date.
- A review may be postponed once. Postponing writes the new `reviewDate` and sets `postponedAt` to the current server timestamp. A decision whose `postponedAt` is already set cannot be postponed again, and its `reviewDate` cannot change until it is reviewed.
- After `status` becomes `reviewed`, the whole document is immutable. The security rules reject any write to it, so no client can rewrite an original entry after review.
- Deletion is allowed only while the decision is open, after a confirmation dialog. A reviewed decision cannot be deleted, so a completed record can never be erased.
- Postponement is reported in Insights, so avoiding reviews stays visible.

### Settings

Path: `users/{uid}/settings/preferences`

- `reminderTime`: string in `HH:mm` form, default `09:00`
- `defaultReviewDays`: number, default 30

## 5. Security rules

Firebase web configuration values are not secrets. The rules below are what protect the data. Each user may only read and write documents under their own user ID, a decision may be postponed once, a reviewed decision cannot be changed and cannot be deleted.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // A reviewed decision may only differ from the open one by these keys:
    // the status flip, the review map being added, and updatedAt.
    function reviewTransitionOnly() {
      return request.resource.data.diff(resource.data)
               .affectedKeys()
               .hasOnly(['status', 'review', 'updatedAt']);
    }

    match /users/{userId}/decisions/{decisionId} {
      allow read: if isOwner(userId);
      // Deleting is only for mistakes made while the decision is still open.
      // A reviewed decision is a permanent record.
      allow delete: if isOwner(userId) && resource.data.status == 'open';

      allow create: if isOwner(userId)
                    && request.resource.data.keys().hasAll(['title', 'prediction', 'confidence', 'reviewDate'])
                    && request.resource.data.status == 'open'
                    && request.resource.data.review == null
                    && request.resource.data.postponedAt == null
                    && request.resource.data.createdAt == request.time
                    && request.resource.data.updatedAt == request.time
                    && request.resource.data.confidence is int
                    && request.resource.data.confidence >= 0
                    && request.resource.data.confidence <= 100;

      // Only open decisions can be edited. The review date can move only as
      // part of the one postponement, and a set postponedAt cannot be cleared.
      allow update: if isOwner(userId)
                    && resource.data.status == 'open'
                    && request.resource.data.createdAt == resource.data.createdAt
                    && request.resource.data.updatedAt == request.time
                    && (
                         (request.resource.data.status == 'open'
                          && request.resource.data.review == null
                          && (resource.data.postponedAt == null
                              || request.resource.data.postponedAt == resource.data.postponedAt)
                          && (request.resource.data.reviewDate == resource.data.reviewDate
                              || (resource.data.postponedAt == null
                                  && request.resource.data.postponedAt != null)))
                         ||
                         (request.resource.data.status == 'reviewed'
                          && request.resource.data.review != null
                          && request.resource.data.review.predictionResult in ['yes', 'partly', 'no']
                          && request.resource.data.review.reasoningRating in ['sound', 'flawed', 'unsure']
                          && reviewTransitionOnly())
                       );
    }

    match /users/{userId}/settings/{documentId} {
      allow read, write: if isOwner(userId);
    }
  }
}
```

The agent should test these with the Firebase emulator, confirming that a signed-in user cannot read another user’s decisions, that a signed-out client cannot read anything, that a reviewed decision rejects an edit to any original field, that a reviewed decision cannot be deleted, and that a second postponement is rejected.

## 6. Screens and behaviour

Both clients implement the same screens.

### 6.1 Sign in

Email and password sign-in and registration. Google sign-in is offered as an option: it is enabled by registering the Android app’s SHA-1 fingerprint and turning on the Google provider, and the Google button is hidden when it has not been configured. Sign-out lives in Settings.

### 6.2 Home

Two sections:

- **Due for review:** open decisions whose `reviewDate` is now or earlier, oldest first.
- **Recent:** the latest decisions, newest first.

A prominent “New decision” button. A filter by tag and by status (open or reviewed). Each item in “Due for review” carries a “Review” action and a “Postpone” action, the latter only until it has been used once (section 6.5).

### 6.3 New decision

Fields in this order: title, options (add and remove rows), reasoning, prediction, confidence, state, tags, review date.

- Confidence is a slider in steps of 5.
- State is a row of selectable chips.
- Review date has quick choices of one week, one month and three months, plus a custom date. The default comes from `defaultReviewDays`.
- Required: title, prediction, confidence, review date.
- The form should be completable in under two minutes.

### 6.4 Decision detail

Shows every field. While the decision is open, it can be edited, except for the review date, which the edit form does not offer, and it can be deleted after a confirmation dialog. If it is due, a “Review now” button is shown, alongside a “Postpone” action that disappears once the postponement has been used. After review, the original entry and the review are shown together, read-only, with no edit or delete action.

### 6.5 Postpone a review

A review may be postponed once, so that a bad day does not force a bad review, but postponing cannot become a way to avoid reviews.

- Offered only while the decision is open, due, and `postponedAt` is null. After use, the action is replaced by a line such as “Postponed once on 3 May”.
- Offers the same quick choices as the new-decision form (one week, one month, three months) plus a custom date, defaulting to `defaultReviewDays` from the current date.
- Saving writes the chosen `reviewDate` and sets `postponedAt` to the server timestamp. It does not touch any other field.
- The security rules reject a second postponement, and reject any change to `reviewDate` that is not part of the one postponement.
- Postponing does not change how the decision is scored: it still counts in calibration and reasoning statistics once it is reviewed. The postponement itself is counted in Insights (section 6.7).

### 6.6 Review

At the top, show the original prediction and confidence, read-only, so the person sees what they believed at the time. Then ask for:

1. What actually happened
2. Did the prediction come true: yes, partly, or no
3. Was the reasoning sound, given what was known then: sound, flawed, or unsure
4. A lesson, optional, one line

Saving sets `status` to `reviewed` and writes `review.reviewedAt` from the server. After that the document is immutable: the review is a snapshot, and later thoughts belong in a new decision rather than an edit.

### 6.7 Insights

Two counts are always shown, because they don’t depend on reviews:

- **Totals:** open, reviewed, and overdue counts.
- **Postponed:** the number of decisions that have used their single postponement, reviewed or not, and the share of all decisions that this represents. This is a light avoidance signal: a rising share means reviews are being pushed back rather than done.

Show “not enough data yet” in place of everything below until at least 5 decisions have been reviewed. After that:

- **Calibration:** group reviewed decisions into confidence buckets (0–49, 50–59, 60–69, 70–79, 80–89, 90–100). For each bucket show the actual hit rate, counting `yes` as 1, `partly` as 0.5 and `no` as 0, next to the bucket’s midpoint. Hide buckets with fewer than 3 decisions.
- **Reasoning by state:** for each `state` value, the share of reviewed decisions rated `sound`.
- **By tag:** number of decisions and share rated `sound` for each tag.

### 6.8 Settings

Reminder time, default review period, export all data as JSON (required on web, optional on Android), and sign out.

## 7. Reminders

**Android.** One daily check at the user’s `reminderTime`, run with WorkManager periodic work. It queries for open decisions whose `reviewDate` has passed and, if there are any, posts a single notification such as “3 decisions are ready for review”. Tapping it opens the Home screen. Details:

- Request the notification permission on Android 13 and later.
- Reschedule the work when the reminder time changes and after sign-in.
- WorkManager timing is approximate, which is acceptable here.

**Web.** No push notifications in v1. Instead, show a count badge for decisions due in the header and in the browser tab title, for example “(2) Decision Journal”.

## 8. Offline and sync

- Android: keep Firestore’s default offline persistence on.
- Web: enable persistent local cache when initialising Firestore.
- Use real-time snapshot listeners so a change on one device appears on the other.
- Writes made offline sync when the connection returns. Last write wins, which is fine for a single user.

## 9. Project structure

Use one repository with three top-level folders:

- `/firebase`: `firestore.rules`, `firestore.indexes.json`, `firebase.json`
- `/android`: the Kotlin app
- `/web`: the React app

**Android layout.** Packages for `ui` (activities and fragments), `data` (the `Decision` model and a repository wrapping Firestore and exposing LiveData), and `reminders` (the WorkManager worker). The `Decision` model is a plain Kotlin data class with a public no-argument constructor and writable properties so Firestore can map it, with `@ServerTimestamp` on the server-set fields.

**Web layout.** `src/firebase.ts` for initialisation, `src/hooks/useDecisions.tsx` for the data hook and its provider, `src/types.ts` for the shared `Decision` and `Review` types, `src/pages/` for screens, and `src/components/` for shared pieces. Run `npm run typecheck` before deploying.

**Indexes.** Queries that filter by `status` and order by `reviewDate` need a composite index. Define it in `firestore.indexes.json` rather than creating it by hand.

## 10. Setup steps for the owner

These are done by you in the Firebase console and on your machine, not by the coding agent:

1. Create a Firebase project on the free plan.
2. Enable Authentication with the email and password provider, and Google if you want the optional Google button.
3. Create a Firestore database in production mode. Choose a region close to you, because it can’t be changed afterwards.
4. Register the Android app with its package name (add the SHA-1 fingerprint if using Google sign-in) and download `google-services.json` into `android/app/`. The web Google button needs the domain added under the provider’s authorised domains.
5. Register a web app and copy its configuration values into `web/.env` as `VITE_` variables.
6. Install the Firebase CLI and deploy the rules and indexes from `/firebase`.

## 11. Suggested build order

Building the web client first makes the data model easy to test before the Android work begins.

1. **Foundations:** repository skeleton, Firebase configuration, security rules, indexes.
2. **Web core:** sign in (email and password, Google), create decision, list, detail, edit, postpone, review.
3. **Web extras:** insights, settings, JSON export, due-count badge.
4. **Android core:** sign in (email and password, Google), create decision, list, detail, edit, postpone, review.
5. **Android extras:** insights, settings, daily reminder.
6. **Verification:** walk through the acceptance criteria below on both clients.

## 12. Acceptance criteria

- A new user can register, sign in, and sign out on both clients.
- When the Google provider is enabled, a user can sign in with Google on both clients; when it is not, the Google button is absent.
- A decision created on one client appears on the other within a few seconds while online.
- A decision created offline appears on the other client after the connection returns.
- A new entry can be saved with only the required fields.
- A due decision shows in “Due for review” and opens the review form.
- A due decision can be postponed once. The action is then unavailable, the new review date is honoured, and a second postponement is rejected by the security rules.
- The review date cannot be changed through the edit form.
- The review form shows the original prediction and confidence, read-only.
- After review, the whole decision is read-only, and the security rules reject any attempt to change an original field.
- A reviewed decision cannot be deleted; an attempt is rejected by the security rules. An open decision can be deleted after confirmation.
- Insights show a “not enough data” message in place of the statistics below 5 reviewed decisions, and correct calibration figures after that.
- Insights show the open, reviewed, overdue and postponed counts from the start, and the postponed count agrees with the decisions that used their postponement.
- On Android, a notification appears at the chosen time when at least one decision is due.
- Security rules block one user from reading another user’s data, verified in the emulator.
- Exported JSON contains every decision with all fields, including `postponedAt`.

## 13. Notes and risks

- **Free tier limits can change.** Check the current Firestore quotas on Firebase’s pricing page. One person’s journal should stay far inside them.
- **The data is sensitive.** Do not send entry contents to analytics or crash reporting.
- **Backups.** Export to JSON now and then, since the free plan offers no managed backups of its own.
- **The rules carry the honesty guarantee.** Because both clients write directly to Firestore, a mistake in the rules silently weakens it. Keep the emulator tests in section 5 as part of the build, not a one-off check.
- **Reviewed records are permanent.** A reviewed decision cannot be edited or deleted, so a mistaken review stays in the data and in the statistics. That is the point of the rule, but the review form should make the consequence clear before saving.
- **Keep the habit light.** If a feature adds friction to creating an entry, leave it out of v1.
