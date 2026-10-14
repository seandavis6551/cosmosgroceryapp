const { app } = require('@azure/functions')
const { createProduct, setInventoryLevels } = require('../lib/db')

// Creates a product (and its Inventory row) from the inventory app.
// Body: { name, sku, barcode?, description?, unitPrice?, costPrice?, unit?, isActive?, categoryId?, qty?, reorderLevel? }
app.http('createProduct', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 400, jsonBody: { error: 'Invalid JSON body' } } }
    if (!body?.name) return { status: 400, jsonBody: { error: 'name is required' } }

    try {
      const created = await createProduct(body)
      await setInventoryLevels(created.id, { quantity: body.qty ?? 0, reorderLevel: body.reorderLevel ?? 10 })
      return { status: 200, jsonBody: created }
    } catch (err) {
      context.log(`createProduct error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
