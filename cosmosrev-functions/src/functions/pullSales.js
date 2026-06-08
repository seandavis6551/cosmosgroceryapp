const { app } = require('@azure/functions')
const { getReceipts } = require('../lib/loyverse')
const { ingestReceipt } = require('../lib/sales')

// Manual "Pull sales" reconciliation — the safety net for the receipts webhook.
// Fetches every receipt from Loyverse in a date window and re-ingests it with
// the same idempotent logic the webhook uses, so any sale a dropped webhook
// missed gets backfilled and nothing is ever double-counted.
//
// Call with an optional window (defaults to the last 7 days):
//   POST /api/pullSales            -> last 7 days
//   POST /api/pullSales?days=30    -> last 30 days
//   body { "since": "2026-06-01T00:00:00Z", "until": "2026-06-08T00:00:00Z" }
app.http('pullSales', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body = {}
    try { body = await request.json() } catch { /* no body is fine */ }

    const daysRaw = body?.days ?? request.query.get('days')
    const days = Number.isFinite(Number(daysRaw)) && daysRaw != null ? Number(daysRaw) : 7
    const createdMin = body?.since || new Date(Date.now() - days * 86400000).toISOString()
    const createdMax = body?.until || undefined

    context.log(`pullSales: window ${createdMin} -> ${createdMax || 'now'}`)

    try {
      const receipts = await getReceipts({ createdMin, createdMax })
      let logged = 0, cancelled = 0, failed = 0
      const errors = []

      for (const r of receipts) {
        try {
          const res = await ingestReceipt(r)
          if (res.action === 'cancelled') cancelled++
          else if (res.action === 'logged') logged++
        } catch (err) {
          failed++
          context.log(`pullSales failed for receipt ${r.receipt_number}: ${err.message}`)
          errors.push({ receipt: r.receipt_number, error: err.message })
        }
      }

      return {
        status: 200,
        jsonBody: {
          message: `${receipts.length} receipts processed: ${logged} logged, ${cancelled} cancelled, ${failed} failed.`,
          from: createdMin,
          to: createdMax || null,
          receipts: receipts.length,
          logged,
          cancelled,
          failed,
          errors: errors.slice(0, 20),
        },
      }
    } catch (err) {
      context.log(`pullSales error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
