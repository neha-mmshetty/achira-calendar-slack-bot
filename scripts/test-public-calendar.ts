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

async function main() {
  loadEnvLocal()

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const credentials = JSON.parse(serviceAccountJson)
  console.log('Service account:', credentials.client_email ?? '(not found in JSON)')
  console.log('Calendar ID:     primary')
  console.log()

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  const calendar = google.calendar({ version: 'v3', auth })

  const response = await calendar.calendars.get({ calendarId: 'primary' })
  console.log('Full response:')
  console.log(JSON.stringify(response.data, null, 2))
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
