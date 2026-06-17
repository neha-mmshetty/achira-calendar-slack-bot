import { calendar_v3 } from 'googleapis'

export type CalendarEventType = 'created' | 'updated' | 'cancelled'

function formatDateTime(event: calendar_v3.Schema$Event): string {
  const start = event.start?.dateTime ?? event.start?.date
  if (!start) return 'unknown time'

  const startDate = new Date(start)
  const dateStr = startDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  // All-day event — no time component
  if (!event.start?.dateTime) return dateStr

  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  const startTime = startDate.toLocaleTimeString('en-GB', timeOpts)
  const end = event.end?.dateTime
  const endTime = end ? new Date(end).toLocaleTimeString('en-GB', timeOpts) : ''

  return `${dateStr}, ${startTime}–${endTime}`
}

function getRoomName(event: calendar_v3.Schema$Event): string | undefined {
  return event.attendees?.find((a) => a.resource)?.displayName ?? undefined
}

function getOrganiser(event: calendar_v3.Schema$Event): string {
  return event.organizer?.displayName ?? event.organizer?.email ?? 'Unknown'
}

export function formatSlackMessage(
  event: calendar_v3.Schema$Event,
  type: CalendarEventType,
): string {
  const title = event.summary ?? '(No title)'
  const when = formatDateTime(event)
  const organiser = getOrganiser(event)
  const room = getRoomName(event)
  const roomPart = room ? ` · Room: ${room}` : ''

  switch (type) {
    case 'created':
      return `:calendar: *${title}* — ${when}\nOrganiser: ${organiser}${roomPart}`
    case 'updated':
      return `:pencil2: *${title}* (updated) — ${when}\nOrganiser: ${organiser}${roomPart}`
    case 'cancelled':
      return `:x: *${title}* cancelled — was ${when}\nOrganiser: ${organiser}`
  }
}

export async function postToSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) throw new Error('SLACK_WEBHOOK_URL is not set')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`)
  }
}
