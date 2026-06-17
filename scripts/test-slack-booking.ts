import fs from 'fs'
import path from 'path'

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

const MESSAGE = `🏢 Room Booking

Room: MFG Instruments-2-BioDot (10)

Title: Test Meeting
Organizer: test@achiralabs.com
Start: 17 Jun 2026 10:00 AM IST
End: 17 Jun 2026 11:00 AM IST

This is only a test message.`

async function main() {
  loadEnvLocal()

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not set')

  console.log('Webhook host:', new URL(webhookUrl).host)
  console.log()
  console.log('Message:')
  console.log(MESSAGE)
  console.log()

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: MESSAGE }),
  })

  console.log('HTTP status:', response.status)
  const body = await response.text()
  console.log('Response body:', body)

  if (response.ok) {
    console.log('\nSUCCESS')
  } else {
    console.error('\nFAILURE')
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error('--- ERROR ---')
  if (err instanceof Error) console.error('Message:', err.message)
  console.error(err)
  process.exit(1)
})
