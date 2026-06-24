const { app } = require('@azure/functions')
const { getProductByVariantId, setInventoryQuantity } = require('../lib/db')

// Receives Loyverse "inventory_levels.update" webhooks and mirrors the new
// on-hand quantity into Dataverse (sol_cosmosinventories). This is how a sale
// at the till flows back to the inventory app and the storefront.
//
// Loyverse calls this anonymously, so we guard with a shared secret in the URL:
//   https://<func>.azurewebsites.net/api/loyverseInventoryWebhook?token=<LOYVERSE_WEBHOOK_SECRET>
app.http('loyverseInventoryWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const expected = process.env.LOYVERSE_WEBHOOK_SECRET
    if (expected && request.query.get('token') !== expected) {
      return { status: 401, jsonBody: { error: 'unauthorized' } }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return { status: 200, jsonBody: { ok: true, note: 'no JSON body (ping?)' } }
    }

    const levels = body?.inventory_levels || []
    const storeId = process.env.LOYVERSE_STORE_ID
    const updated = []
    const skipped = []

    for (const level of levels) {
      // Only mirror the store we care about.
      if (storeId && level.store_id && level.store_id !== storeId) continue

      const variantId = level.variant_id
      const qty = level.in_stock
      if (!variantId || qty == null) {
        skipped.push({ variantId, reason: 'missing variant_id or in_stock' })
        continue
      }

      try {
        const product = await getProductByVariantId(variantId)
        if (!product) {
          skipped.push({ variantId, reason: 'no Dataverse product for this variant' })
          continue
        }
        await setInventoryQuantity(product.sol_productsid, qty)
        updated.push({ sku: product.sol_sku, name: product.sol_name, qty })
      } catch (err) {
        context.log(`inventory sync failed for variant ${variantId}: ${err.message}`)
        skipped.push({ variantId, reason: err.message })
      }
    }

    context.log(`loyverseInventoryWebhook: ${updated.length} updated, ${skipped.length} skipped`)
    // Always 200 so Loyverse doesn't retry-storm on partial failures.
    return { status: 200, jsonBody: { ok: true, updated, skipped } }
  },
})
