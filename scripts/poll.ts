import fs from 'fs'
import path from 'path'
import { fetchCalendarEvents } from '../src/lib/google-calendar'
import { formatSlackMessage, postToSlack, CalendarEventType } from '../src/lib/slack'

// Loads .env.local when running locally. In GitHub Actions, secrets are
// already present as environment variables so this is a no-op there.
function loadEnvLocal(): void {
  const filepath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(filepath)) return
  const content = fs.readFileSync(filepath, 'utf8')
  const chunks = content.split(/^(?=[A-Z_]+=)/m)
  for (const chunk of chunks) {
    const eq = chunk.indexOf('=')
    if (eq === -1) continue
    const key = chunk.slice(0, eq).trim()
    const value = chunk.slice(eq + 1).trim()
    if (key && !key.startsWith('#') && !(key in process.env)) {
      process.env[key] = value
    }
  }
}

async function main() {
  loadEnvLocal()

  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (calendarIds.length === 0) throw new Error('GOOGLE_CALENDAR_IDS is not set')

  const lookbackHours = Number(process.env.INITIAL_LOOKBACK_HOURS ?? 0.1)
  const updatedMin = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)

  console.log(`Polling ${calendarIds.length} calendar(s) since ${updatedMin.toISOString()}`)

  let posted = 0

  for (const calendarId of calendarIds) {
    const events = await fetchCalendarEvents(calendarId, updatedMin)

    for (const event of events) {
      let type: CalendarEventType
      if (event.status === 'cancelled') {
        type = 'cancelled'
      } else if (event.created && new Date(event.created) >= updatedMin) {
        type = 'created'
      } else {
        type = 'updated'
      }

      const message = formatSlackMessage(event, type)
      await postToSlack(message)
      posted++
      console.log(`Posted [${type}]: ${event.summary ?? '(No title)'}`)
    }
  }

  console.log(`Done. ${posted} message(s) posted.`)
}

main().catch((err: unknown) => {
  console.error('Poll failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
