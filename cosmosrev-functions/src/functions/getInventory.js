const { app } = require('@azure/functions')
const { getInventoryList, findInventoryItem } = require('../lib/db')

// Inventory app reads.
//   GET /api/getInventory                 → every product with its stock levels
//   GET /api/getInventory?id=<guid>       → one product (also ?barcode= or ?sku=); 404 if none
app.http('getInventory', {
  methods: ['GET'],
  authLevel: 'function',
  handler: async (request, context) => {
    const id = request.query.get('id')
    const barcode = request.query.get('barcode')
    const sku = request.query.get('sku')

    try {
      if (id || barcode || sku) {
        const item = await findInventoryItem({ id, barcode, sku })
        return item ? { status: 200, jsonBody: item } : { status: 404, jsonBody: { error: 'Not found' } }
      }
      return { status: 200, jsonBody: await getInventoryList() }
    } catch (err) {
      context.log(`getInventory error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
