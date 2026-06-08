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

// Loyverse uses cursor pagination with a default page of ~10 and a max of 250.
// Without looping the cursor we only ever see the first page, which is what made
// the pull think most variants had no stock and reset them to 0.
async function fetchAllPages(path, key) {
  let all = []
  let cursor = null
  do {
    const url = new URL(`${LOYVERSE_BASE}/${path}`)
    url.searchParams.set('limit', '250')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(`Loyverse ${path} fetch error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    all = all.concat(data[key] || [])
    cursor = data.cursor || null
  } while (cursor)
  return all
}

async function getAllItems() {
  return { items: await fetchAllPages('items', 'items') }
}

async function getStoreInventory() {
  const items = await fetchAllPages(
    `inventory?store_id=${process.env.LOYVERSE_STORE_ID}`,
    'inventory_levels'
  )
  return { inventory_levels: items }
}

// All receipts in a created-at window (for the "Pull sales" reconciliation).
// Cursor-paginated so we get every receipt, not just the first page.
async function getReceipts({ createdMin, createdMax } = {}) {
  const params = new URLSearchParams()
  if (process.env.LOYVERSE_STORE_ID) params.set('store_id', process.env.LOYVERSE_STORE_ID)
  if (createdMin) params.set('created_at_min', createdMin)
  if (createdMax) params.set('created_at_max', createdMax)
  const qs = params.toString()
  return fetchAllPages(`receipts${qs ? '?' + qs : ''}`, 'receipts')
}

async function getItem(loyverseItemId) {
  const res = await fetch(`${LOYVERSE_BASE}/items/${loyverseItemId}`, { headers: headers() })
  if (!res.ok) throw new Error(`Loyverse item fetch error ${res.status}: ${await res.text()}`)
  return res.json()
}

// Push the reorder threshold (min) to Loyverse. low_stock lives on the variant's
// store entry, not the /inventory endpoint, so we fetch the item, patch the field
// on the matching store, and post the whole item back (preserving every other field).
async function updateVariantLowStock(loyverseItemId, variantId, lowStock) {
  const item = await getItem(loyverseItemId)
  const storeId = process.env.LOYVERSE_STORE_ID
  const v = (item.variants || []).find((x) => !variantId || x.variant_id === variantId) || item.variants?.[0]
  if (!v) throw new Error('variant not found on item')

  // Build a CLEAN minimal payload. Echoing the full GET'd item back (with
  // read-only fields like created_at/updated_at/deleted_at/components) makes
  // Loyverse reject the update — that was the cause of the mass sync failure.
  const stores = (v.stores || []).map((s) => ({
    store_id: s.store_id,
    pricing_type: s.pricing_type || 'FIXED',
    price: s.price ?? v.default_price ?? 0,
    available_for_sale: s.available_for_sale ?? true,
    optimal_stock: s.optimal_stock ?? null,
    low_stock: (!storeId || s.store_id === storeId) ? lowStock : (s.low_stock ?? null),
  }))

  const body = {
    id: item.id,
    item_name: item.item_name,
    reference_id: item.reference_id,
    description: item.description || '',
    track_stock: true,
    variants: [{
      variant_id: v.variant_id,
      default_pricing_type: v.default_pricing_type || 'FIXED',
      default_price: v.default_price ?? 0,
      stores,
    }],
  }
  if (item.category_id) body.category_id = item.category_id

  const res = await fetch(`${LOYVERSE_BASE}/items/${loyverseItemId}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Loyverse low_stock error ${res.status}: ${await res.text()}`)
  return res.json()
}

module.exports = { createItem, updateItemStock, updateItem, deleteItem, getStoreInventory, getAllItems, getItem, updateVariantLowStock, getReceipts }
