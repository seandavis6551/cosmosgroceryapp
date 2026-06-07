// Enables "Track stock" on linked Loyverse items and sets their low-stock
// threshold from the Dataverse reorder level. Without track_stock=true, Loyverse
// rejects stock counts, so Sync All can't forward quantities.
//
//   node enable-loyverse-tracking.js          # dry run
//   node enable-loyverse-tracking.js --apply  # writes to Loyverse
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)
const { getLinkedProductsWithStock } = require('./src/lib/dataverse')

const APPLY = process.argv.includes('--apply')
const LH = { Authorization: 'Bearer ' + process.env.LOYVERSE_API_TOKEN, 'Content-Type': 'application/json' }
const STORE = process.env.LOYVERSE_STORE_ID

;(async () => {
  const linked = await getLinkedProductsWithStock()
  const items = (await (await fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers: LH })).json()).items || []
  const byId = {}; items.forEach((i) => { byId[i.id] = i })

  console.log(APPLY ? '*** APPLYING ***\n' : '*** DRY RUN — pass --apply to write ***\n')
  let changed = 0, ok = 0, failed = 0
  for (const p of linked) {
    const item = byId[p.itemId]
    if (!item) { console.log(`SKIP "${p.name}" — Loyverse item not found`); continue }
    const v = item.variants?.[0]
    const store = v?.stores?.find((s) => s.store_id === STORE) || v?.stores?.[0] || {}
    const needsTracking = item.track_stock !== true
    const needsLow = (store.low_stock ?? null) !== (p.reorderLevel ?? null)
    if (!needsTracking && !needsLow) { console.log(`OK   "${p.name}"`); ok++; continue }

    console.log(`SET  "${p.name}"  track_stock:${item.track_stock}->true  low_stock:${store.low_stock}->${p.reorderLevel}`)
    changed++
    if (APPLY) {
      try {
        const body = {
          id: item.id,
          item_name: item.item_name,
          reference_id: item.reference_id,
          description: item.description || '',
          track_stock: true,
          variants: [{
            variant_id: v.variant_id,
            default_pricing_type: v.default_pricing_type || 'FIXED',
            default_price: v.default_price ?? 0,
            stores: [{
              store_id: store.store_id || STORE,
              pricing_type: store.pricing_type || 'FIXED',
              price: store.price ?? v.default_price ?? 0,
              available_for_sale: store.available_for_sale ?? true,
              low_stock: p.reorderLevel,
              optimal_stock: store.optimal_stock ?? null,
            }],
          }],
        }
        const res = await fetch('https://api.loyverse.com/v1.0/items', { method: 'POST', headers: LH, body: JSON.stringify(body) })
        if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`)
        console.log('   ok ✓')
      } catch (e) { console.log('   FAILED: ' + e.message); failed++; changed-- }
    }
  }
  console.log(`\nSummary: ${ok} already-ok, ${changed} ${APPLY ? 'updated' : 'to update'}, ${failed} failed`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
