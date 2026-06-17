import { google, calendar_v3 } from 'googleapis'

function getCalendarClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const credentials = JSON.parse(json)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
  return google.calendar({ version: 'v3', auth })
}

export async function fetchCalendarEvents(
  calendarId: string,
  updatedMin: Date,
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = getCalendarClient()
  const response = await calendar.events.list({
    calendarId,
    updatedMin: updatedMin.toISOString(),
    showDeleted: false,,
    singleEvents: true,
    orderBy: 'updated',
  })
  const items = response.data.items ?? []
  if (items.length > 0) {
    console.log('[calendar] raw event[0]:', JSON.stringify(items[0], null, 2))
  }
  return items
}

export async function getCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<calendar_v3.Schema$Event | null> {
  try {
    const calendar = getCalendarClient()
    const response = await calendar.events.get({ calendarId, eventId })
    return response.data
  } catch {
    return null
  }
}
