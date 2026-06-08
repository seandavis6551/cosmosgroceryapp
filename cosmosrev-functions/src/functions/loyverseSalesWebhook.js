const { app } = require('@azure/functions')
const { deleteSalesByReceipt, insertReceiptLines } = require('../lib/dataverse')

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
        // Clear any previous version of this receipt first (idempotency).
        await deleteSalesByReceipt(receiptNumber)

        // Cancelled receipt: lines removed above, nothing to re-insert.
        if (r.cancelled_at) {
          skipped.push({ receiptNumber, reason: 'cancelled — lines removed' })
          continue
        }

        const isRefund = r.receipt_type === 'REFUND'
        const sign = isRefund ? -1 : 1

        const lines = (r.line_items || []).map((li, i) => {
          const quantity = (li.quantity ?? 0) * sign
          const unitPrice = li.price ?? 0
          const lineTotal = (li.total_money ?? li.gross_total_money ?? (li.price ?? 0) * (li.quantity ?? 0)) * sign
          const cost = (li.cost_total ?? (li.cost != null ? li.cost * (li.quantity ?? 0) : null))
          return {
            lineNumber: i + 1,
            itemName: li.item_name || li.variant_name || null,
            variantId: li.variant_id || null,
            quantity,
            unitPrice,
            lineTotal,
            cost: cost != null ? cost * sign : null,
          }
        })

        const written = await insertReceiptLines(
          {
            receiptNumber,
            receiptType: r.receipt_type || 'SALE',
            receiptDate: r.receipt_date || r.created_at || new Date().toISOString(),
            storeId: r.store_id || storeFilter || null,
          },
          lines
        )
        logged.push({ receiptNumber, type: r.receipt_type, lines: written })
      } catch (err) {
        context.log(`sales webhook failed for receipt ${receiptNumber}: ${err.message}`)
        skipped.push({ receiptNumber, reason: err.message })
      }
    }

    context.log(`loyverseSalesWebhook: ${logged.length} receipts logged, ${skipped.length} skipped`)
    return { status: 200, jsonBody: { ok: true, logged, skipped } }
  },
})
