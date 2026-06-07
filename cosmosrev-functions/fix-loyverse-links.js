// Repairs stale Dataverse->Loyverse links by matching Loyverse reference_id to
// Dataverse sol_sku, then writing the CURRENT (live) Loyverse item/variant IDs back.
//
//   node fix-loyverse-links.js          # dry run, shows what WOULD change
//   node fix-loyverse-links.js --apply  # actually patches Dataverse
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)
const { ClientSecretCredential } = require('@azure/identity')
const { updateProductLoyverseIds } = require('./src/lib/dataverse')

const APPLY = process.argv.includes('--apply')
const cred = new ClientSecretCredential(process.env.DATAVERSE_TENANT_ID, process.env.DATAVERSE_CLIENT_ID, process.env.DATAVERSE_CLIENT_SECRET)

async function dvGet(query) {
  const tok = (await cred.getToken(process.env.DATAVERSE_URL + '/.default')).token
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${query}`, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Dataverse ${res.status}: ${await res.text()}`)
  return res.json()
}

;(async () => {
  // Build reference_id -> {itemId, variantId} from live Loyverse.
  const lv = await (await fetch('https://api.loyverse.com/v1.0/items?limit=250', { headers: { Authorization: 'Bearer ' + process.env.LOYVERSE_API_TOKEN } })).json()
  const byRef = {}
  ;(lv.items || []).forEach((i) => {
    const v = (i.variants || [])[0]
    if (i.reference_id && v) byRef[i.reference_id] = { itemId: i.id, variantId: v.variant_id }
  })

  const prods = (await dvGet(
    `sol_productses?$select=sol_productsid,sol_name,sol_sku,sol_loyverse_item_id,sol_loyverse_variant_id&$filter=statecode eq 0 and sol_isactive eq true`
  )).value

  console.log(APPLY ? '*** APPLYING CHANGES ***\n' : '*** DRY RUN (no changes) — pass --apply to write ***\n')
  let changes = 0, ok = 0, nomatch = 0
  for (const p of prods) {
    const live = byRef[p.sol_sku]
    if (!live) {
      console.log(`NO MATCH   ${p.sol_sku}  ${p.sol_name}  (no Loyverse item with reference_id=${p.sol_sku})`)
      nomatch++
      continue
    }
    if (live.itemId === p.sol_loyverse_item_id && live.variantId === p.sol_loyverse_variant_id) {
      console.log(`OK         ${p.sol_sku}  ${p.sol_name}`)
      ok++
      continue
    }
    console.log(`REPAIR     ${p.sol_sku}  ${p.sol_name}`)
    console.log(`             item   ${p.sol_loyverse_item_id} -> ${live.itemId}`)
    console.log(`             variant${p.sol_loyverse_variant_id} -> ${live.variantId}`)
    changes++
    if (APPLY) {
      await updateProductLoyverseIds(p.sol_productsid, live.itemId, live.variantId)
      console.log('             patched ✓')
    }
  }
  console.log(`\nSummary: ${ok} already-correct, ${changes} ${APPLY ? 'repaired' : 'to repair'}, ${nomatch} no-match`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
