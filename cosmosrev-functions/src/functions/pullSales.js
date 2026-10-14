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
//
// Loyverse's free plan refuses (402) any receipts query reaching back more than
// 31 days, so older windows are trimmed to the last 30 days.
const HISTORY_LIMIT_DAYS = 30
app.http('pullSales', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body = {}
    try { body = await request.json() } catch { /* no body is fine */ }

    const daysRaw = body?.days ?? request.query.get('days')
    const days = Number.isFinite(Number(daysRaw)) && daysRaw != null ? Number(daysRaw) : 7
    const requestedMin = body?.since || new Date(Date.now() - days * 86400000).toISOString()
    const createdMax = body?.until || undefined
    const historyStart = new Date(Date.now() - HISTORY_LIMIT_DAYS * 86400000)
    const trimmed = new Date(requestedMin) < historyStart
    const createdMin = trimmed ? historyStart.toISOString() : requestedMin
    const note = trimmed ? ` Loyverse only allows the last ${HISTORY_LIMIT_DAYS} days, so older sales were skipped.` : ''

    if (createdMax && new Date(createdMax) <= historyStart) {
      return {
        status: 200,
        jsonBody: { message: `Nothing pulled.${note}`, from: requestedMin, to: createdMax, receipts: 0, logged: 0, cancelled: 0, failed: 0, errors: [], trimmed },
      }
    }

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
          message: `${receipts.length} receipts processed: ${logged} logged, ${cancelled} cancelled, ${failed} failed.${note}`,
          from: createdMin,
          to: createdMax || null,
          receipts: receipts.length,
          logged,
          cancelled,
          failed,
          errors: errors.slice(0, 20),
          trimmed,
        },
      }
    } catch (err) {
      context.log(`pullSales error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
