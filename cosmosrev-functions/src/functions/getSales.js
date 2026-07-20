const { app } = require('@azure/functions')
const { getSalesLines } = require('../lib/db')

// Reads the sales ledger written by pullSales / the (disabled) sales webhook.
//   GET /api/getSales?since=2026-07-01T00:00:00Z&until=2026-07-08T00:00:00Z
// `since` defaults to 7 days ago; `until` is optional (open-ended = "to now").
app.http('getSales', {
  methods: ['GET'],
  authLevel: 'function',
  handler: async (request, context) => {
    const since = request.query.get('since') || new Date(Date.now() - 7 * 86400000).toISOString()
    const until = request.query.get('until') || undefined

    try {
      const lines = await getSalesLines({ since, until })
      return { status: 200, jsonBody: lines }
    } catch (err) {
      context.log(`getSales error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
