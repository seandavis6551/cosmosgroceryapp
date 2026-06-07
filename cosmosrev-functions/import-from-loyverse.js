// Reverse import: creates Dataverse products (+ inventory rows) from Loyverse
// items that don't yet exist in Dataverse. Use to re-create items you deleted
// from Dataverse but still have in the POS.
//
//   node import-from-loyverse.js              # dry run, shows what WOULD be created
//   node import-from-loyverse.js --apply      # actually creates them
//   node import-from-loyverse.js --apply --include-no-sku   # also import items without a reference_id
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)
const { ClientSecretCredential } = require('@azure/identity')

const APPLY = process.argv.includes('--apply')
const INCLUDE_NO_SKU = process.argv.includes('--include-no-sku')
const cred = new ClientSecretCredential(process.env.DATAVERSE_TENANT_ID, process.env.DATAVERSE_CLIENT_ID, process.env.DATAVERSE_CLIENT_SECRET)
const LH = { Authorization: 'Bearer ' + process.env.LOYVERSE_API_TOKEN }

async function dv(method, q, body) {
  const tok = (await cred.getToken(process.env.DATAVERSE_URL + '/.default')).token
  const headers = { Authorization: 'Bearer ' + tok, 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', Accept: 'application/json' }
  if (body) { headers['Content-Type'] = 'application/json'; headers['Prefer'] = 'return=representation' }
  const r = await fetch(process.env.DATAVERSE_URL + '/api/data/v9.2/' + q, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.status === 204 ? null : r.json()
}

function nextId(prefix, existing) {
  const nums = existing.map((v) => { const m = v?.match(/\d+$/); return m ? parseInt(m[0], 10) : 0 }).filter((n) => !isNaN(n))
  return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
}

;(async () => {
  const items = (await (await fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers: LH })).json()).items || []
  const inv = (await (await fetch('https://api.loyverse.com/v1.0/inventory?limit=250', { headers: LH })).json()).inventory_levels || []
  const stock = {}; inv.forEach((l) => { stock[l.variant_id] = l.in_stock })

  const prods = (await dv('GET', 'sol_productses?$select=sol_sku,sol_productid,sol_loyverse_item_id')).value
  const haveSku = new Set(prods.map((p) => p.sol_sku).filter(Boolean))
  const haveItem = new Set(prods.map((p) => p.sol_loyverse_item_id).filter(Boolean))
  let prodSeq = prods.map((p) => p.sol_productid).filter(Boolean)

  const invRows = (await dv('GET', 'sol_cosmosinventories?$select=sol_inventoryid')).value
  let invSeq = invRows.map((i) => i.sol_inventoryid).filter(Boolean)

  console.log(APPLY ? '*** APPLYING ***\n' : '*** DRY RUN — pass --apply to create ***\n')
  let created = 0, skipped = 0, failed = 0
  for (const it of items) {
    const v = (it.variants || [])[0] || {}
    const sku = it.reference_id || (INCLUDE_NO_SKU ? v.sku : null)
    if (haveSku.has(it.reference_id) || haveItem.has(it.id)) continue   // already in Dataverse
    if (!sku) { console.log(`SKIP (no reference_id) "${it.item_name}"`); skipped++; continue }

    const qty = stock[v.variant_id] ?? 0
    const productId = nextId('PRD', prodSeq)
    const inventoryId = nextId('INV', invSeq)
    console.log(`CREATE "${it.item_name}"  sku=${sku} price=${v.default_price ?? 0} stock=${qty}  (${productId}/${inventoryId})`)

    if (APPLY) {
      try {
        const product = await dv('POST', 'sol_productses', {
          sol_name: it.item_name,
          sol_sku: sku,
          sol_productid: productId,
          sol_unitprice: v.default_price ?? 0,
          sol_isactive: true,
          sol_loyverse_item_id: it.id,
          sol_loyverse_variant_id: v.variant_id,
          sol_loyverse_sync_status: 922880000,
        })
        await dv('POST', 'sol_cosmosinventories', {
          sol_inventoryid: inventoryId,
          sol_quantityonhand: qty,
          sol_reorderlevel: 10,
          'sol_ProductID@odata.bind': `/sol_productses(${product.sol_productsid})`,
        })
        console.log('   created ✓')
        created++; prodSeq.push(productId); invSeq.push(inventoryId)
      } catch (e) {
        console.log('   FAILED: ' + e.message)
        failed++
      }
    } else {
      created++; prodSeq.push(productId); invSeq.push(inventoryId)
    }
  }
  console.log(`\nSummary: ${created} ${APPLY ? 'created' : 'to create'}, ${skipped} skipped, ${failed} failed`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
