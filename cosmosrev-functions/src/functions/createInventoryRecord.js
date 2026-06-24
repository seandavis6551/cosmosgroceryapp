const { app } = require('@azure/functions')
const { createInventoryRecord } = require('../lib/db')

app.http('createInventoryRecord', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('createInventoryRecord triggered')

    try {
      const body = await request.json()
      const { productId } = body

      if (!productId) {
        return { status: 400, jsonBody: { error: 'productId is required' } }
      }

      const record = await createInventoryRecord(productId)
      return { status: 200, jsonBody: { success: true, inventoryId: record.sol_cosmosinventoryid } }
    } catch (err) {
      context.log(`createInventoryRecord error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
