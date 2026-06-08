// Registers (or lists/deletes) the Loyverse inventory webhook that points at the
// deployed loyverseInventoryWebhook function.
//
//   node register-webhook.js list
//   node register-webhook.js add  https://<funcapp>.azurewebsites.net/api/loyverseInventoryWebhook
//   node register-webhook.js add  https://<funcapp>.azurewebsites.net/api/loyverseSalesWebhook  receipts.update
//   node register-webhook.js del  <webhook_id>
//
// The webhook type defaults to inventory_levels.update; pass it as the 3rd arg
// (e.g. receipts.update) to register the sales webhook.
//
// The shared secret (LOYVERSE_WEBHOOK_SECRET in local.settings.json) is appended
// as ?token=... so the function can verify the caller.
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)

const BASE = 'https://api.loyverse.com/v1.0/webhooks'
const H = { Authorization: 'Bearer ' + process.env.LOYVERSE_API_TOKEN, 'Content-Type': 'application/json' }
const [cmd, arg, typeArg] = process.argv.slice(2)

async function call(method, url, body) {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  console.log(method, res.status)
  console.log(text)
  if (!res.ok) process.exit(1)
  return text ? JSON.parse(text) : null
}

;(async () => {
  if (cmd === 'list') {
    await call('GET', BASE)
  } else if (cmd === 'add') {
    if (!arg) throw new Error('usage: node register-webhook.js add <function-url>')
    const secret = process.env.LOYVERSE_WEBHOOK_SECRET
    const url = secret ? `${arg}${arg.includes('?') ? '&' : '?'}token=${encodeURIComponent(secret)}` : arg
    const type = typeArg || 'inventory_levels.update'
    await call('POST', BASE, { type, url, status: 'ENABLED' })
  } else if (cmd === 'del') {
    if (!arg) throw new Error('usage: node register-webhook.js del <webhook-id>')
    await call('DELETE', `${BASE}/${arg}`)
  } else {
    console.log('usage: node register-webhook.js <list|add <url>|del <id>>')
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
