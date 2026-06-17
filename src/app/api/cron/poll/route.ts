import { fetchCalendarEvents, getCalendarEvent } from '@/lib/google-calendar'
import { formatSlackMessage, postToSlack, CalendarEventType } from '@/lib/slack'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lookbackHours = Number(process.env.INITIAL_LOOKBACK_HOURS ?? 0.1)
  const updatedMin = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)

  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

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

      let eventToFormat = event
      if (type === 'cancelled' && !event.summary && event.id) {
        const full = await getCalendarEvent(calendarId, event.id)
        if (full?.summary) {
          eventToFormat = { ...full, status: 'cancelled' }
        }
      }
      const message = formatSlackMessage(eventToFormat, type)
      await postToSlack(message)
      posted++
    }
  }

  return Response.json({ ok: true, posted })
}
