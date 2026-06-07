// Read-only sync check: compares Dataverse products against Loyverse items.
// Run: node check-sync.js   (loads creds from local.settings.json)
const fs = require('fs')
const path = require('path')

// Load env from local.settings.json
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8'))
Object.assign(process.env, settings.Values)

const { ClientSecretCredential } = require('@azure/identity')
const cred = new ClientSecretCredential(
  process.env.DATAVERSE_TENANT_ID,
  process.env.DATAVERSE_CLIENT_ID,
  process.env.DATAVERSE_CLIENT_SECRET
)

async function dvFetch(query) {
  const token = (await cred.getToken(`${process.env.DATAVERSE_URL}/.default`)).token
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Dataverse ${res.status}: ${await res.text()}`)
  return res.json()
}

async function loyverse(pathname) {
  const res = await fetch(`https://api.loyverse.com/v1.0/${pathname}`, {
    headers: { Authorization: `Bearer ${process.env.LOYVERSE_API_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Loyverse ${res.status}: ${await res.text()}`)
  return res.json()
}

;(async () => {
  // Active products in Dataverse
  const dv = await dvFetch(
    `sol_productses?$select=sol_name,sol_sku,sol_loyverse_item_id,sol_loyverse_variant_id,sol_loyverse_sync_status` +
    `&$filter=statecode eq 0 and sol_isactive eq true&$orderby=sol_name`
  )
  const products = dv.value
  const synced = products.filter((p) => p.sol_loyverse_item_id)
  const unsynced = products.filter((p) => !p.sol_loyverse_item_id)

  // Items in Loyverse (first page; bump limit if needed)
  const lv = await loyverse('items?limit=250')
  const lvItems = lv.items || []
  const lvIds = new Set(lvItems.map((i) => i.id))

  console.log('=== DATAVERSE ===')
  console.log(`Active products:    ${products.length}`)
  console.log(`Synced (has ID):    ${synced.length}`)
  console.log(`Unsynced (no ID):   ${unsynced.length}`)
  if (unsynced.length) {
    console.log('  Unsynced:')
    unsynced.forEach((p) => console.log(`   - ${p.sol_sku || '(no sku)'}  ${p.sol_name}`))
  }

  console.log('\n=== LOYVERSE ===')
  console.log(`Items returned:     ${lvItems.length}${lv.cursor ? ' (more pages exist!)' : ''}`)

  console.log('\n=== CROSS-CHECK ===')
  const dangling = synced.filter((p) => !lvIds.has(p.sol_loyverse_item_id))
  if (dangling.length) {
    console.log(`Dataverse points to ${dangling.length} Loyverse item(s) that no longer exist:`)
    dangling.forEach((p) => console.log(`   - ${p.sol_sku}  ${p.sol_name}  (${p.sol_loyverse_item_id})`))
  } else {
    console.log('All synced Dataverse products map to a live Loyverse item. ✓')
  }

  const verdict = unsynced.length === 0 && dangling.length === 0
  console.log(`\nIN SYNC: ${verdict ? 'YES ✓' : 'NO ✗'}`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
