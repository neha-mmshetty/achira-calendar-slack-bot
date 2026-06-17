import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'

// Loads .env.local manually because the file contains a multi-line JSON value
// that standard dotenv parsers truncate at the first newline.
// Strategy: split on lines that begin a new KEY= assignment, treating everything
// between two such lines as one value (handles unquoted multi-line JSON blocks).
function loadEnvLocal(): void {
  const filepath = path.resolve(process.cwd(), '.env.local')
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

function printApiError(err: unknown): void {
  if (err instanceof Error) {
    console.error('Message:', err.message)
  }
  const e = err as Record<string, unknown>
  const response = e['response'] as Record<string, unknown> | undefined
  if (response) {
    console.error('HTTP status:', response['status'])
    console.error('Response body:', JSON.stringify(response['data'], null, 2))
  }
  console.error('\nFull error object:')
  console.error(err)
}

async function main() {
  loadEnvLocal()

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const rawIds = process.env.GOOGLE_CALENDAR_IDS
  if (!rawIds) throw new Error('GOOGLE_CALENDAR_IDS is not set')

  const calendarIds = rawIds.split(',').map((s) => s.trim())
  const calendarId = calendarIds[1]
  if (!calendarId) throw new Error('No second calendar ID found in GOOGLE_CALENDAR_IDS')

  const credentials = JSON.parse(serviceAccountJson)

  console.log('Service account:', credentials.client_email ?? '(not found in JSON)')
  console.log('Calendar ID:    ', calendarId)
  console.log()

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  const calendar = google.calendar({ version: 'v3', auth })

  console.log('--- calendar.calendars.get() ---')
  try {
    const calMeta = await calendar.calendars.get({ calendarId })
    console.log('Calendar ID: ', calMeta.data.id)
    console.log('Summary:     ', calMeta.data.summary ?? '(none)')
    console.log('Description: ', calMeta.data.description ?? '(none)')
  } catch (err: unknown) {
    console.error('calendars.get() failed')
    printApiError(err)
    process.exit(1)
  }
  console.log()

  console.log('--- calendar.events.list() ---')
  const response = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const events = response.data.items ?? []

  if (events.length === 0) {
    console.log('No upcoming events found.')
    return
  }

  console.log(`${events.length} upcoming event(s):\n`)

  for (const event of events) {
    const title = event.summary ?? '(No title)'
    const start = event.start?.dateTime ?? event.start?.date ?? 'unknown'
    const end = event.end?.dateTime ?? event.end?.date ?? 'unknown'
    console.log(`Title: ${title}`)
    console.log(`Start: ${start}`)
    console.log(`End:   ${end}`)
    console.log('---')
  }
}

main().catch((err: unknown) => {
  console.error('--- ERROR ---')
  printApiError(err)
  process.exit(1)
})
