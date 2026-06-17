# Architecture: Google Calendar → Slack Bot

## Approach

Vercel Cron polls conference room resource calendars every 5 minutes and posts
Slack messages when events are created, updated, or cancelled.

No database. No watch channels. No real-time webhook from Google.

`lastSuccessfulSyncTime` is persisted in Vercel Blob (object storage, not a
database) so missed or failed cron runs never cause lost notifications.

---

## Data Flow

```
Vercel Cron (every 5 min)
        │
        ▼
GET /api/cron/poll   ←── Authorization: Bearer $CRON_SECRET
        │
        ├── read sync-state.json from Vercel Blob
        │     → lastSuccessfulSyncTime  (fallback: now − INITIAL_LOOKBACK_HOURS)
        │
        ├── events.list on each room calendar  (updatedMin = lastSuccessfulSyncTime)
        │         Google Calendar API
        │
        ├── classify each changed event
        │     created   → event.created >= lastSuccessfulSyncTime
        │     cancelled → event.status === 'cancelled'
        │     updated   → everything else
        │
        ├── POST formatted message
        │         Slack Incoming Webhook
        │
        └── write sync-state.json to Vercel Blob  { lastSuccessfulSyncTime: <now> }
              (only written after all calendars processed and all Slack posts succeed)
```

---

## Calendar Access

Conference room resource calendars have their own calendar IDs
(e.g. `company.com_abc123@resource.calendar.google.com`).

When an employee books a room, the meeting appears on that room's calendar.
Watching room calendars captures all meetings that use a physical space.

**Admin setup required (one-time):**
A Google Workspace Super Admin shares each room calendar with the service
account email (`bot@project-id.iam.gserviceaccount.com`) and grants
"See all event details" access. No domain-wide delegation is needed.

Room calendar IDs are stored as a comma-separated environment variable.

---

## Components

### `GET /api/cron/poll`
- Vercel calls this on schedule; verifies `Authorization: Bearer $CRON_SECRET`.
- Reads `lastSuccessfulSyncTime` from Vercel Blob; falls back to
  `now − INITIAL_LOOKBACK_HOURS` on first run (file absent).
- Loops over each calendar ID in `GOOGLE_CALENDAR_IDS`.
- Calls `events.list` with `updatedMin = lastSuccessfulSyncTime` and `showDeleted = true`.
- Classifies and posts each changed event to Slack.
- Writes updated `lastSuccessfulSyncTime` (= start of this run) to Vercel Blob only
  after all processing succeeds. A partial or failed run leaves the timestamp
  unchanged so the next run re-covers the same window.
- Returns 200 when done.

### Vercel Blob (`sync-state.json`)
- Stores a single JSON object: `{ "lastSuccessfulSyncTime": "2026-06-16T10:00:00.000Z" }`.
- Read at the top of every poll; written at the bottom on success only.
- Not a database — plain object storage, included in Vercel's free tier.

### Google Calendar API
- Auth: service account JSON key (`GOOGLE_SERVICE_ACCOUNT_JSON`).
- Scope: `https://www.googleapis.com/auth/calendar.readonly`.
- One `events.list` call per room calendar per poll cycle.

### Slack Incoming Webhook
- A single webhook URL receives all notifications.
- No Slack app OAuth. No token management.

---

## Environment Variables

```
GOOGLE_SERVICE_ACCOUNT_JSON   # Full JSON key for the service account (single line)
GOOGLE_CALENDAR_IDS           # Comma-separated room calendar IDs
SLACK_WEBHOOK_URL             # Slack Incoming Webhook URL
CRON_SECRET                   # Vercel auto-injects this; also used to secure the route
BLOB_READ_WRITE_TOKEN         # Vercel Blob token (auto-set by Vercel when Blob is enabled)
INITIAL_LOOKBACK_HOURS        # How far back to look on first run (default: 1)
```

---

## Slack Message Format

**Created**
> :calendar: *Team Standup* — Mon 16 Jun, 10:00–10:30
> Organiser: Jane Smith · Room: Boardroom A

**Updated**
> :pencil2: *Team Standup* (updated) — Mon 16 Jun, 11:00–11:30
> Organiser: Jane Smith · Room: Boardroom A

**Cancelled**
> :x: *Team Standup* cancelled — was Mon 16 Jun, 10:00–10:30
> Organiser: Jane Smith

---

## What This Does Not Cover

- Meetings without a room (employee-only or video-only calls).
- Per-user calendar access (would require domain-wide delegation).
- Event deduplication across polling windows (rare edge case; acceptable for internal tool).
