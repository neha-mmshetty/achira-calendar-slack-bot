import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'
import { formatSlackMessage, postToSlack } from '../src/lib/slack'

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

async function main() {
  loadEnvLocal()

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const rawIds = process.env.GOOGLE_CALENDAR_IDS
  if (!rawIds) throw new Error('GOOGLE_CALENDAR_IDS is not set')

  const calendarIds = rawIds.split(',').map((s) => s.trim()).filter(Boolean)

  const credentials = JSON.parse(serviceAccountJson)
  console.log('Service account:', credentials.client_email ?? '(not found in JSON)')
  console.log('Calendars:      ', calendarIds.join(', '))
  console.log()

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  const calendar = google.calendar({ version: 'v3', auth })

  let totalPosted = 0

  for (const calendarId of calendarIds) {
    console.log('='.repeat(60))
    console.log('Calendar:', calendarId)
    console.log()

    const response = await calendar.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      maxResults: 3,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items ?? []

    if (events.length === 0) {
      console.log('No upcoming events found — nothing to post.')
      console.log()
      continue
    }

    for (const event of events) {
      const message = formatSlackMessage(event, 'created')

      console.log('Formatted message:')
      console.log(message)
      console.log()

      await postToSlack(message)
      console.log('Posted to Slack ✓')
      console.log()
      totalPosted++
    }
  }

  console.log('='.repeat(60))
  console.log(`Done. ${totalPosted} message(s) posted to Slack.`)
}

main().catch((err: unknown) => {
  console.error('--- ERROR ---')
  if (err instanceof Error) console.error('Message:', err.message)
  const e = err as Record<string, unknown>
  const response = e['response'] as Record<string, unknown> | undefined
  if (response) {
    console.error('HTTP status:', response['status'])
    console.error('Response body:', JSON.stringify(response['data'], null, 2))
  }
  console.error('\nFull error object:')
  console.error(err)
  process.exit(1)
})
