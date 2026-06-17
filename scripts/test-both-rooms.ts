import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'

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

const ROOM_IDS = [
  'c_1888shg4a1j10haei6kos4toid7f4@resource.calendar.google.com',
  'c_1887h92tkmta6in0gm5balhv57l3o@resource.calendar.google.com',
]

async function main() {
  loadEnvLocal()

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const credentials = JSON.parse(serviceAccountJson)
  console.log('Service account:', credentials.client_email ?? '(not found in JSON)')
  console.log()

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  const calendar = google.calendar({ version: 'v3', auth })

  for (const calendarId of ROOM_IDS) {
    console.log('='.repeat(60))
    console.log('Calendar ID:', calendarId)

    try {
      const response = await calendar.calendars.get({ calendarId })
      console.log('Status:      SUCCESS')
      console.log('HTTP status: 200')
      console.log('Response body:')
      console.log(JSON.stringify(response.data, null, 2))
    } catch (err: unknown) {
      console.log('Status:      FAILURE')
      const e = err as Record<string, unknown>
      const response = e['response'] as Record<string, unknown> | undefined
      if (response) {
        console.log('HTTP status:', response['status'])
        console.log('Response body:')
        console.log(JSON.stringify(response['data'], null, 2))
      } else if (err instanceof Error) {
        console.log('Error:', err.message)
      }
    }

    console.log()
  }
}

main().catch((err: unknown) => {
  console.error('--- UNEXPECTED ERROR ---')
  if (err instanceof Error) console.error('Message:', err.message)
  console.error(err)
  process.exit(1)
})
