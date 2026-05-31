const LOYVERSE_BASE = 'https://api.loyverse.com/v1.0'

function headers() {
  return {
    Authorization: `Bearer ${process.env.LOYVERSE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

async function createItem(product) {
  const res = await fetch(`${LOYVERSE_BASE}/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      item_name: product.sol_name,
      reference_id: product.sol_sku,
      description: product.sol_description || '',
      variants: [{
        default_pricing_type: 'FIXED',
        default_price: product.sol_unitprice || 0,
        stores: [{
          store_id: process.env.LOYVERSE_STORE_ID,
          pricing_type: 'FIXED',
          price: product.sol_unitprice || 0,
          available_for_sale: true,
        }],
      }],
    }),
  })
  if (!res.ok) throw new Error(`Loyverse create error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function updateItemStock(variantId, quantity) {
  const res = await fetch(`${LOYVERSE_BASE}/inventory`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      store_id: process.env.LOYVERSE_STORE_ID,
      items_variants: [{
        variant_id: variantId,
        in_stock: quantity,
      }],
    }),
  })
  if (!res.ok) throw new Error(`Loyverse stock error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function updateItem(loyverseItemId, product) {
  const res = await fetch(`${LOYVERSE_BASE}/items/${loyverseItemId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      item_name: product.sol_name,
      reference_id: product.sol_sku,
      description: product.sol_description || '',
      variants: [{
        default_pricing_type: 'FIXED',
        default_price: product.sol_unitprice || 0,
        stores: [{
          store_id: process.env.LOYVERSE_STORE_ID,
          pricing_type: 'FIXED',
          price: product.sol_unitprice || 0,
          available_for_sale: true,
        }],
      }],
    }),
  })
  if (!res.ok) throw new Error(`Loyverse update error ${res.status}: ${await res.text()}`)
  return res.json()
}

module.exports = { createItem, updateItemStock, updateItem }
