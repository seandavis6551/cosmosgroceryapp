const { app } = require('@azure/functions')
const { getLinkedProductsWithStock } = require('../lib/db')
const { updateItemStock, updateVariantLowStock } = require('../lib/loyverse')

// "Sync all" — pushes Dataverse on-hand quantities up to Loyverse for every
// linked product. Use this after manual stock adjustments / restocks in the app.
//
// NOTE: this OVERWRITES Loyverse stock with the Dataverse number. Loyverse is the
// master for sales (the webhook flows sales back into Dataverse); pressing this
// button deliberately overrides Loyverse with the app's current count.
app.http('syncInventory', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('syncInventory (sync all) triggered')

    const results = { synced: [], skipped: [], failed: [] }

    try {
      const products = await getLinkedProductsWithStock()
      context.log(`Found ${products.length} linked products`)

      for (const p of products) {
        if (p.quantity == null) {
          results.skipped.push({ sku: p.sku, name: p.name, reason: 'no inventory record' })
          continue
        }
        try {
          await updateItemStock(p.variantId, p.quantity)
          // Push the reorder threshold (min) best-effort — a low_stock hiccup
          // must not fail the stock sync for the product.
          if (p.reorderLevel != null && p.itemId) {
            try { await updateVariantLowStock(p.itemId, p.variantId, p.reorderLevel) }
            catch (lowErr) { context.log(`low_stock push failed for ${p.sku}: ${lowErr.message}`) }
          }
          results.synced.push({ sku: p.sku, name: p.name, qty: p.quantity, min: p.reorderLevel })
        } catch (err) {
          context.log(`Failed to push stock for ${p.sku}: ${err.message}`)
          results.failed.push({ sku: p.sku, name: p.name, error: err.message })
        }
      }

      return {
        status: 200,
        jsonBody: {
          message: `${results.synced.length} pushed, ${results.skipped.length} skipped, ${results.failed.length} failed.`,
          ...results,
        },
      }
    } catch (err) {
      context.log(`syncInventory error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
