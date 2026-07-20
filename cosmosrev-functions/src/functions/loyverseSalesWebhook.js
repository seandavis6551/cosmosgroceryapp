const { app } = require('@azure/functions')
const { ingestReceipt } = require('../lib/sales')

// Receives Loyverse "receipts.update" webhooks and logs each receipt's line items
// into the Dataverse sales ledger (sol_sales). This is the foundation for sales
// and accounting reporting in the inventory app.
//
// Design notes:
//  - Idempotent: Loyverse may resend or edit a receipt, so we delete-then-insert
//    all lines for a receipt_number. Re-delivery never double-counts.
//  - Cancelled receipts: we remove their lines so totals stay correct.
//  - Refunds: quantities/amounts are stored negative so SUM() nets out to real revenue.
//  - Loyverse calls this anonymously, so we guard with a shared secret in the URL:
//      https://<func>.azurewebsites.net/api/loyverseSalesWebhook?token=<LOYVERSE_WEBHOOK_SECRET>
//  - Always returns 200 so Loyverse doesn't retry-storm on a partial failure.
app.http('loyverseSalesWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // Kill switch: sales are pulled manually (Pull Sales button) to control
    // Functions spend. Set DISABLE_SALES_WEBHOOK=false to re-enable auto-ingest
    // once the Loyverse webhook subscription is deliberately turned back on.
    if (process.env.DISABLE_SALES_WEBHOOK !== 'false') {
      return { status: 200, jsonBody: { ok: true, note: 'sales webhook disabled — pull sales manually' } }
    }

    const expected = process.env.LOYVERSE_WEBHOOK_SECRET
    if (expected && request.query.get('token') !== expected) {
      return { status: 401, jsonBody: { error: 'unauthorized' } }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return { status: 200, jsonBody: { ok: true, note: 'no JSON body (ping?)' } }
    }

    const storeFilter = process.env.LOYVERSE_STORE_ID
    const receipts = body?.receipts || []
    const logged = []
    const skipped = []

    for (const r of receipts) {
      const receiptNumber = r.receipt_number
      if (!receiptNumber) {
        skipped.push({ reason: 'no receipt_number' })
        continue
      }
      // Only mirror the store we care about (when the payload tells us).
      if (storeFilter && r.store_id && r.store_id !== storeFilter) {
        skipped.push({ receiptNumber, reason: 'different store' })
        continue
      }

      try {
        const res = await ingestReceipt(r)
        if (res.action === 'cancelled') skipped.push({ receiptNumber, reason: 'cancelled — lines removed' })
        else logged.push({ receiptNumber, type: r.receipt_type, lines: res.lines })
      } catch (err) {
        context.log(`sales webhook failed for receipt ${receiptNumber}: ${err.message}`)
        skipped.push({ receiptNumber, reason: err.message })
      }
    }

    context.log(`loyverseSalesWebhook: ${logged.length} receipts logged, ${skipped.length} skipped`)
    return { status: 200, jsonBody: { ok: true, logged, skipped } }
  },
})
