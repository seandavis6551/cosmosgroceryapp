const { deleteSalesByReceipt, insertReceiptLines } = require('./db')

// Shared receipt -> sales-ledger logic, used by BOTH the live webhook and the
// manual "Pull sales" reconciliation. Keeping it here means the two paths can
// never drift apart and produce different numbers.

// Turn a Loyverse receipt into normalized ledger lines. Refunds are stored
// negative so SUM() over the ledger nets out to real revenue.
function normalizeReceipt(r) {
  const isRefund = r.receipt_type === 'REFUND'
  const sign = isRefund ? -1 : 1

  const lines = (r.line_items || []).map((li, i) => {
    const quantity = (li.quantity ?? 0) * sign
    const unitPrice = li.price ?? 0
    const lineTotal = (li.total_money ?? li.gross_total_money ?? (li.price ?? 0) * (li.quantity ?? 0)) * sign
    const cost = li.cost_total ?? (li.cost != null ? li.cost * (li.quantity ?? 0) : null)
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

  return {
    receipt: {
      receiptNumber: r.receipt_number,
      receiptType: r.receipt_type || 'SALE',
      receiptDate: r.receipt_date || r.created_at || new Date().toISOString(),
      storeId: r.store_id || process.env.LOYVERSE_STORE_ID || null,
    },
    lines,
  }
}

// Idempotent ingest of a single receipt: clear any prior version, then insert
// the current lines (unless the receipt is cancelled). Safe to call repeatedly
// for the same receipt — the webhook and the pull both rely on this.
async function ingestReceipt(r) {
  const receiptNumber = r.receipt_number
  if (!receiptNumber) return { action: 'skipped', reason: 'no receipt_number' }

  await deleteSalesByReceipt(receiptNumber)
  if (r.cancelled_at) return { receiptNumber, action: 'cancelled', lines: 0 }

  const { receipt, lines } = normalizeReceipt(r)
  const written = await insertReceiptLines(receipt, lines)
  return { receiptNumber, action: 'logged', lines: written }
}

module.exports = { normalizeReceipt, ingestReceipt }
