const { app } = require('@azure/functions')
const { insertStockAdjustment, getStockAdjustments } = require('../lib/db')

// Stock adjustment audit log.
//   GET  /api/stockAdjustments?days=30  → newest first
//   POST /api/stockAdjustments          → body: { sku, name, type, quantity, previousQty, newQty, reason, ... }
app.http('stockAdjustments', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    try {
      if (request.method === 'GET') {
        const days = parseInt(request.query.get('days'), 10) || 30
        return { status: 200, jsonBody: await getStockAdjustments(days) }
      }
      let body
      try { body = await request.json() } catch { return { status: 400, jsonBody: { error: 'Invalid JSON body' } } }
      await insertStockAdjustment(body || {})
      return { status: 200, jsonBody: { ok: true } }
    } catch (err) {
      context.log(`stockAdjustments error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
