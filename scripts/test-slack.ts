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

async function main() {
  loadEnvLocal()

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL is not set')

  const host = new URL(webhookUrl).host
  console.log('Webhook host:', host)
  console.log()

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '✅ Achira Calendar Bot test message from local machine' }),
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
