const { app } = require('@azure/functions')
const { getUnsyncedProducts, updateProductLoyverseIds, getInventoryForProduct } = require('../lib/dataverse')
const { createItem, updateItemStock } = require('../lib/loyverse')

app.http('syncProducts', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('syncProducts triggered')

    const results = { synced: [], failed: [] }

    try {
      const products = await getUnsyncedProducts()
      context.log(`Found ${products.length} unsynced products`)

      for (const product of products) {
        try {
          // Look up inventory first so we can set the low-stock threshold on create
          const inventory = await getInventoryForProduct(product.sol_productsid)
          const reorderLevel = inventory?.sol_reorderlevel ?? null

          // Create item in Loyverse (with stock tracking + low-stock level)
          const loyverseItem = await createItem(product, reorderLevel)
          const variantId = loyverseItem.variants?.[0]?.variant_id

          // Write Loyverse IDs back to Dataverse
          await updateProductLoyverseIds(product.sol_productsid, loyverseItem.id, variantId)

          // Set stock quantity if inventory record exists
          if (variantId && inventory && inventory.sol_quantityonhand > 0) {
            await updateItemStock(variantId, inventory.sol_quantityonhand)
          }

          results.synced.push({ sku: product.sol_sku, name: product.sol_name, loyverseId: loyverseItem.id })
        } catch (err) {
          context.log(`Failed to sync ${product.sol_sku}: ${err.message}`)
          results.failed.push({ sku: product.sol_sku, name: product.sol_name, error: err.message })
        }
      }

      return {
        status: 200,
        jsonBody: {
          message: `Sync complete. ${results.synced.length} synced, ${results.failed.length} failed.`,
          ...results,
        },
      }
    } catch (err) {
      context.log(`syncProducts error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
