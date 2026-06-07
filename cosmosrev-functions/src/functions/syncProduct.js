const { app } = require('@azure/functions')
const { getProductById, updateProductLoyverseIds, getInventoryForProduct } = require('../lib/dataverse')
const { createItem, updateItem, updateItemStock } = require('../lib/loyverse')

// Single-product, change-driven sync (Dataverse -> Loyverse).
// Meant to be called by a Power Automate flow on "row added/modified" of sol_productses.
// Body: { "productId": "<guid>" }
app.http('syncProduct', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } }
    }

    const productId = body?.productId || request.query.get('productId')
    if (!productId) {
      return { status: 400, jsonBody: { error: 'productId is required' } }
    }

    context.log(`syncProduct triggered for ${productId}`)

    try {
      const product = await getProductById(productId)

      // Skip inactive products rather than pushing them to the POS.
      if (product.sol_isactive === false) {
        return { status: 200, jsonBody: { skipped: true, reason: 'product is inactive', productId } }
      }

      const inventory = await getInventoryForProduct(productId)
      const reorderLevel = inventory?.sol_reorderlevel ?? null

      let action
      if (product.sol_loyverse_item_id) {
        // Already linked -> update the existing Loyverse item in place
        // (track_stock + low_stock are set here so stock can sync).
        await updateItem(product.sol_loyverse_item_id, product, reorderLevel, product.sol_loyverse_variant_id)
        if (product.sol_loyverse_variant_id && inventory && inventory.sol_quantityonhand != null) {
          await updateItemStock(product.sol_loyverse_variant_id, inventory.sol_quantityonhand)
        }
        action = 'updated'
      } else {
        // Not linked yet -> create it, then write the IDs back to Dataverse.
        const loyverseItem = await createItem(product, reorderLevel)
        const variantId = loyverseItem.variants?.[0]?.variant_id
        await updateProductLoyverseIds(productId, loyverseItem.id, variantId)

        // Seed initial stock from Dataverse inventory on first create only.
        if (variantId && inventory && inventory.sol_quantityonhand > 0) {
          await updateItemStock(variantId, inventory.sol_quantityonhand)
        }
        action = 'created'
      }

      return {
        status: 200,
        jsonBody: { ok: true, action, productId, sku: product.sol_sku, name: product.sol_name },
      }
    } catch (err) {
      context.log(`syncProduct error for ${productId}: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message, productId } }
    }
  },
})
