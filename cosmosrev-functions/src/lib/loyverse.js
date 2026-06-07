const LOYVERSE_BASE = 'https://api.loyverse.com/v1.0'

function headers() {
  return {
    Authorization: `Bearer ${process.env.LOYVERSE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

async function createItem(product, reorderLevel = null) {
  const res = await fetch(`${LOYVERSE_BASE}/items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      item_name: product.sol_name,
      reference_id: product.sol_sku,
      description: product.sol_description || '',
      image_url: product.sol_imageurl || undefined,
      track_stock: true,
      variants: [{
        default_pricing_type: 'FIXED',
        default_price: product.sol_unitprice || 0,
        stores: [{
          store_id: process.env.LOYVERSE_STORE_ID,
          pricing_type: 'FIXED',
          price: product.sol_unitprice || 0,
          available_for_sale: true,
          low_stock: reorderLevel,
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
      inventory_levels: [{
        variant_id: variantId,
        store_id: process.env.LOYVERSE_STORE_ID,
        stock_after: quantity,
      }],
    }),
  })
  if (!res.ok) throw new Error(`Loyverse stock error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function updateItem(loyverseItemId, product, reorderLevel = null, variantId = null) {
  const variant = {
    default_pricing_type: 'FIXED',
    default_price: product.sol_unitprice || 0,
    stores: [{
      store_id: process.env.LOYVERSE_STORE_ID,
      pricing_type: 'FIXED',
      price: product.sol_unitprice || 0,
      available_for_sale: true,
      low_stock: reorderLevel,
    }],
  }
  // Include variant_id so Loyverse updates the existing variant in place.
  if (variantId) variant.variant_id = variantId

  const res = await fetch(`${LOYVERSE_BASE}/items/${loyverseItemId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      item_name: product.sol_name,
      reference_id: product.sol_sku,
      description: product.sol_description || '',
      image_url: product.sol_imageurl || undefined,
      track_stock: true,
      variants: [variant],
    }),
  })
  if (!res.ok) throw new Error(`Loyverse update error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function deleteItem(loyverseItemId) {
  const res = await fetch(`${LOYVERSE_BASE}/items/${loyverseItemId}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok && res.status !== 404) throw new Error(`Loyverse delete error ${res.status}: ${await res.text()}`)
  return true
}

async function getAllItems() {
  const res = await fetch(`${LOYVERSE_BASE}/items?limit=250`, { headers: headers() })
  if (!res.ok) throw new Error(`Loyverse items fetch error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function getStoreInventory() {
  const res = await fetch(`${LOYVERSE_BASE}/inventory?store_id=${process.env.LOYVERSE_STORE_ID}`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Loyverse inventory fetch error ${res.status}: ${await res.text()}`)
  return res.json()
}

module.exports = { createItem, updateItemStock, updateItem, deleteItem, getStoreInventory, getAllItems }
