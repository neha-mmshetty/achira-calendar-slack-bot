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
    showDeleted: true,
    singleEvents: true,
    orderBy: 'updated',
  })
  return response.data.items ?? []
}
