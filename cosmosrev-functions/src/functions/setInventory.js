const { app } = require('@azure/functions')
const { setInventoryLevels } = require('../lib/db')

// Sets on-hand quantity and/or reorder level for a product (creates the
// Inventory row if it's missing).
// Body: { productId, qty?, reorderLevel? }
app.http('setInventory', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 400, jsonBody: { error: 'Invalid JSON body' } } }

    const { productId, qty, reorderLevel } = body || {}
    if (!productId) return { status: 400, jsonBody: { error: 'productId is required' } }

    try {
      await setInventoryLevels(productId, { quantity: qty, reorderLevel })
      return { status: 200, jsonBody: { ok: true, productId } }
    } catch (err) {
      context.log(`setInventory error for ${productId}: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message, productId } }
    }
  },
})
