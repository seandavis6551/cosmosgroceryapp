const { app } = require('@azure/functions')
const { getProductById, deactivateProduct } = require('../lib/db')
const { deleteItem } = require('../lib/loyverse')

// Soft-delete a product everywhere: removes the item from Loyverse (so it stops
// ringing up at the POS) and deactivates the Dataverse product + inventory rows
// (hidden from dashboard/storefront, history preserved).
// Body: { "productId": "<guid>" }
app.http('deleteProduct', {
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

    context.log(`deleteProduct triggered for ${productId}`)

    try {
      const product = await getProductById(productId)

      // Remove from Loyverse first (ignore if already gone).
      if (product.sol_loyverse_item_id) {
        try {
          await deleteItem(product.sol_loyverse_item_id)
        } catch (err) {
          context.log(`Loyverse delete failed for ${productId}: ${err.message}`)
        }
      }

      // Deactivate in Dataverse (soft delete).
      await deactivateProduct(productId)

      return { status: 200, jsonBody: { ok: true, productId, name: product.sol_name } }
    } catch (err) {
      context.log(`deleteProduct error for ${productId}: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message, productId } }
    }
  },
})
