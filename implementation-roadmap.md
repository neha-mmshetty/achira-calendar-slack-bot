# Implementation Roadmap

## Phase 1 — External Setup (no code)

### 1a. Google Cloud
1. Create a Google Cloud project (or use an existing one).
2. Enable the **Google Calendar API**.
3. Create a **Service Account**. Download the JSON key.
4. Note the service account email (e.g. `bot@project-id.iam.gserviceaccount.com`).

### 1b. Google Workspace (Admin Console)
1. Go to Admin Console → Directory → Buildings & Resources.
2. For each conference room: open its calendar settings and share it with the
   service account email. Grant **"See all event details"** access.
3. Collect the calendar ID for each room
   (visible in Google Calendar → room calendar → Settings → Calendar ID).

### 1c. Slack
1. Go to your Slack workspace → Apps → Incoming Webhooks → Add new webhook.
2. Choose the target channel.
3. Copy the webhook URL.

---

## Phase 2 — Project Configuration

1. Enable **Vercel Blob** in the Vercel dashboard (Storage tab → Create Blob store).
   Vercel automatically adds `BLOB_READ_WRITE_TOKEN` to the environment.
2. Add the following to `.env.local` (development) and Vercel environment variables (production):
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   GOOGLE_CALENDAR_IDS=room1@resource.calendar.google.com,room2@resource.calendar.google.com
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   CRON_SECRET=<random secret>
   BLOB_READ_WRITE_TOKEN=<from Vercel dashboard>
   INITIAL_LOOKBACK_HOURS=1
   ```
3. Install dependencies:
   ```
   npm install googleapis @vercel/blob
   ```
4. Configure Vercel Cron in `vercel.json`:
   ```json
   {
     "crons": [{ "path": "/api/cron/poll", "schedule": "*/5 * * * *" }]
   }
   ```

---

## Phase 3 — Core Poll Handler

File: `app/api/cron/poll/route.ts`

Steps to implement:
1. Verify `Authorization: Bearer $CRON_SECRET` header; return 401 if missing.
2. Record `pollStartTime = new Date()` before doing any work.
3. Read `sync-state.json` from Vercel Blob.
   - If the file exists, parse `lastSuccessfulSyncTime` from it.
   - If the file is absent (first run), use `now − INITIAL_LOOKBACK_HOURS`.
4. Authenticate with Google using the service account JSON.
5. For each calendar ID in `GOOGLE_CALENDAR_IDS`:
   - Call `events.list` with `updatedMin = lastSuccessfulSyncTime`, `showDeleted = true`, `singleEvents = true`.
6. For each returned event, classify it:
   - `status === 'cancelled'` → cancelled
   - `event.created >= lastSuccessfulSyncTime` → created
   - Otherwise → updated
7. Call the Slack formatter and post (Phase 4).
8. On success, write `{ lastSuccessfulSyncTime: pollStartTime.toISOString() }` back
   to `sync-state.json` in Vercel Blob.
   - Use `pollStartTime` (not `now`) so events updated while the poll was running
     are not skipped on the next cycle.
   - Do not write if any calendar fetch or Slack post failed; let the next run
     re-cover the same window.
9. Return `Response.json({ ok: true })`.

---

## Phase 4 — Slack Formatter

File: `lib/slack.ts`

Implement a single function `postToSlack(event, type)` that:
1. Extracts title, start/end time, organiser, room name from the Calendar event object.
2. Builds the appropriate message string for created / updated / cancelled.
3. POSTs to `SLACK_WEBHOOK_URL` with `Content-Type: application/json`.

No Slack SDK needed — a plain `fetch` POST is sufficient.

---

## Phase 5 — Local Testing

1. Run `next dev`.
2. Expose localhost with `ngrok http 3000` (optional — only needed if testing Google push; not needed for polling).
3. Hit the poll route manually:
   ```
   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/poll
   ```
4. Create or update a test event on a room calendar; re-run the curl; confirm Slack message appears.
5. Run the curl a second time immediately — confirm no duplicate Slack message (the sync timestamp advanced).

---

## Phase 6 — Deploy to Vercel

1. Push to GitHub; connect repo to Vercel.
2. Add all environment variables in the Vercel dashboard.
3. Deploy. Vercel Cron starts automatically on the Pro plan or can be triggered manually.
4. Confirm the first scheduled poll fires and Slack messages arrive.

---

## Out of Scope

- Meetings without a room booked.
- Editing which rooms are monitored at runtime (change `GOOGLE_CALENDAR_IDS` and redeploy).
- Deduplication within a single poll window (an event updated twice between polls
  appears once in the next poll — Calendar API returns the latest state only).
