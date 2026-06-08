const { ClientSecretCredential } = require('@azure/identity')

let credential = null

function getCredential() {
  if (!credential) {
    credential = new ClientSecretCredential(
      process.env.DATAVERSE_TENANT_ID,
      process.env.DATAVERSE_CLIENT_ID,
      process.env.DATAVERSE_CLIENT_SECRET
    )
  }
  return credential
}

async function getToken() {
  const cred = getCredential()
  const token = await cred.getToken(`${process.env.DATAVERSE_URL}/.default`)
  return token.token
}

async function dvFetch(path) {
  const token = await getToken()
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Dataverse GET error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function dvPatch(path, body) {
  const token = await getToken()
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Dataverse PATCH error ${res.status}: ${await res.text()}`)
}

async function dvPost(path, body) {
  const token = await getToken()
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Dataverse POST error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function dvDelete(path) {
  const token = await getToken()
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Dataverse DELETE error ${res.status}: ${await res.text()}`)
}

function nextId(prefix, existing) {
  const nums = existing
    .map((v) => { const m = v?.match(/\d+$/); return m ? parseInt(m[0], 10) : 0 })
    .filter((n) => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

async function getNextProductId() {
  const data = await dvFetch(`sol_productses?$select=sol_productid&$orderby=sol_productid desc&$top=50`)
  return nextId('PRD', data.value.map((r) => r.sol_productid).filter(Boolean))
}

async function getNextInventoryId() {
  const data = await dvFetch(`sol_cosmosinventories?$select=sol_inventoryid&$orderby=sol_inventoryid desc&$top=50`)
  return nextId('INV', data.value.map((r) => r.sol_inventoryid).filter(Boolean))
}

// All products that already have a Loyverse item ID — used to skip during import.
async function getAllLoyverseLinkedItems() {
  const data = await dvFetch(
    `sol_productses?$select=sol_productsid,sol_loyverse_item_id,sol_loyverse_variant_id&$filter=statecode eq 0 and sol_loyverse_item_id ne null`
  )
  const map = {}
  data.value.forEach((r) => { map[r.sol_loyverse_item_id] = { productId: r.sol_productsid, variantId: r.sol_loyverse_variant_id } })
  return map
}

async function updateProductBarcode(productId, barcode) {
  if (!barcode) return
  await dvPatch(`sol_productses(${productId})`, { sol_barcode: barcode })
}

async function createProductFromLoyverse(item, variantId, price, quantity, barcode, reorderLevel = 10) {
  const productId = await getNextProductId()
  const product = await dvPost('sol_productses', {
    sol_name: item.item_name,
    sol_productid: productId,
    sol_sku: item.reference_id || productId,
    sol_barcode: barcode || null,
    sol_unitprice: price || 0,
    sol_description: item.description || '',
    sol_isactive: true,
    sol_loyverse_item_id: item.id,
    sol_loyverse_variant_id: variantId,
    sol_loyverse_sync_status: 922880000,
  })
  const inventoryId = await getNextInventoryId()
  await dvPost('sol_cosmosinventories', {
    sol_inventoryid: inventoryId,
    sol_quantityonhand: quantity ?? 0,
    sol_reorderlevel: reorderLevel ?? 10,
    'sol_ProductID@odata.bind': `/sol_productses(${product.sol_productsid})`,
  })
  return product
}

// Update editable product fields (category lookup + prices) with the service
// principal. The inventory app calls this via the updateProduct function so a
// signed-in user doesn't need Append/AppendTo privilege on the category lookup.
async function updateProductFields(productId, { categoryId, unitPrice, costPrice } = {}) {
  const body = {}
  if (unitPrice !== undefined) body.sol_unitprice = unitPrice
  if (costPrice !== undefined) body.sol_cost_price = costPrice
  if (categoryId) body['sol_CategoryID@odata.bind'] = `/sol_categorieses(${categoryId})`
  if (Object.keys(body).length) await dvPatch(`sol_productses(${productId})`, body)
  // Explicit null clears the category (disassociate the lookup).
  if (categoryId === null) await dvDelete(`sol_productses(${productId})/sol_CategoryID/$ref`)
}

async function getUnsyncedProducts() {
  const data = await dvFetch(
    `sol_productses?$select=sol_productsid,sol_name,sol_sku,sol_unitprice,sol_description,sol_isactive,sol_loyverse_item_id,sol_imageurl` +
    `&$filter=statecode eq 0 and sol_isactive eq true and sol_loyverse_item_id eq null`
  )
  return data.value
}

async function getProductById(productId) {
  const data = await dvFetch(
    `sol_productses(${productId})?$select=sol_productsid,sol_name,sol_sku,sol_unitprice,sol_description,sol_isactive,sol_loyverse_item_id,sol_loyverse_variant_id`
  )
  return data
}

async function updateProductLoyverseIds(productId, loyverseItemId, loyverseVariantId) {
  await dvPatch(`sol_productses(${productId})`, {
    sol_loyverse_item_id: loyverseItemId,
    sol_loyverse_variant_id: loyverseVariantId,
    sol_loyverse_sync_status: 922880000,
  })
}

async function getInventoryForProduct(productId) {
  const data = await dvFetch(
    `sol_cosmosinventories?$select=sol_quantityonhand,sol_reorderlevel&$filter=_sol_productid_value eq ${productId}&$top=1`
  )
  return data.value[0] || null
}

async function createInventoryRecord(productId) {
  return await dvPost('sol_cosmosinventories', {
    sol_quantityonhand: 0,
    sol_reorderlevel: 10,
    'sol_ProductID@odata.bind': `/sol_productses(${productId})`,
  })
}

// All active products that are linked to Loyverse, with their on-hand qty.
async function getLinkedProductsWithStock() {
  const [productsData, inventoryData] = await Promise.all([
    dvFetch(
      `sol_productses?$select=sol_productsid,sol_name,sol_sku,sol_loyverse_item_id,sol_loyverse_variant_id` +
      `&$filter=statecode eq 0 and sol_isactive eq true and sol_loyverse_variant_id ne null`
    ),
    dvFetch(
      `sol_cosmosinventories?$select=sol_quantityonhand,sol_reorderlevel,_sol_productid_value&$filter=statecode eq 0`
    ),
  ])

  const invMap = {}
  inventoryData.value.forEach((i) => {
    if (i._sol_productid_value) invMap[i._sol_productid_value] = i
  })

  return productsData.value.map((p) => {
    const inv = invMap[p.sol_productsid]
    return {
      productId: p.sol_productsid,
      name: p.sol_name,
      sku: p.sol_sku,
      variantId: p.sol_loyverse_variant_id,
      itemId: p.sol_loyverse_item_id,
      quantity: inv?.sol_quantityonhand ?? null,
      reorderLevel: inv?.sol_reorderlevel ?? null,
    }
  })
}

// Soft-delete: deactivate the product and its inventory rows (statecode=Inactive).
// Keeps the records + history; hides them from dashboard, storefront, and queries.
async function deactivateProduct(productId) {
  const inv = await dvFetch(
    `sol_cosmosinventories?$select=sol_cosmosinventoryid&$filter=_sol_productid_value eq ${productId}`
  )
  for (const r of inv.value) {
    await dvPatch(`sol_cosmosinventories(${r.sol_cosmosinventoryid})`, { statecode: 1, statuscode: 2 })
  }
  await dvPatch(`sol_productses(${productId})`, { statecode: 1, statuscode: 2 })
}

// Find the Dataverse product linked to a given Loyverse variant id.
async function getProductByVariantId(loyverseVariantId) {
  const data = await dvFetch(
    `sol_productses?$select=sol_productsid,sol_name,sol_sku&$filter=sol_loyverse_variant_id eq '${loyverseVariantId}'&$top=1`
  )
  return data.value[0] || null
}

// Set on-hand quantity for a product, creating the inventory row if missing.
async function setInventoryQuantity(productId, quantity) {
  const data = await dvFetch(
    `sol_cosmosinventories?$select=sol_cosmosinventoryid&$filter=_sol_productid_value eq ${productId}&$top=1`
  )
  const existing = data.value[0]
  if (existing) {
    await dvPatch(`sol_cosmosinventories(${existing.sol_cosmosinventoryid})`, {
      sol_quantityonhand: quantity,
    })
  } else {
    await dvPost('sol_cosmosinventories', {
      sol_quantityonhand: quantity,
      sol_reorderlevel: 10,
      'sol_ProductID@odata.bind': `/sol_productses(${productId})`,
    })
  }
}

// Patch on-hand qty and/or reorder level WITHOUT clobbering the other field.
// Only fields that are actually provided (non-null) get written — this is what
// keeps the pull from zeroing a product just because Loyverse omitted its data.
async function setInventoryLevels(productId, { quantity, reorderLevel } = {}) {
  const patch = {}
  if (quantity != null) patch.sol_quantityonhand = quantity
  if (reorderLevel != null) patch.sol_reorderlevel = reorderLevel
  if (Object.keys(patch).length === 0) return

  const data = await dvFetch(
    `sol_cosmosinventories?$select=sol_cosmosinventoryid&$filter=_sol_productid_value eq ${productId}&$top=1`
  )
  const existing = data.value[0]
  if (existing) {
    await dvPatch(`sol_cosmosinventories(${existing.sol_cosmosinventoryid})`, patch)
  } else {
    await dvPost('sol_cosmosinventories', {
      sol_quantityonhand: quantity ?? 0,
      sol_reorderlevel: reorderLevel ?? 10,
      'sol_ProductID@odata.bind': `/sol_productses(${productId})`,
    })
  }
}

// Requires sol_unit and sol_image_url fields on sol_productses in Dataverse
async function getPublicProducts() {
  const [productsData, inventoryData] = await Promise.all([
    dvFetch(
      `sol_productses?$select=sol_productsid,sol_name,sol_unitprice,sol_unit,sol_imageurl,_sol_categoryid_value` +
      `&$filter=statecode eq 0 and sol_isactive eq true&$orderby=sol_name`
    ),
    dvFetch(
      `sol_cosmosinventories?$select=sol_quantityonhand,_sol_productid_value&$filter=statecode eq 0`
    ),
  ])

  const invMap = {}
  inventoryData.value.forEach((i) => {
    if (i._sol_productid_value) invMap[i._sol_productid_value] = i.sol_quantityonhand ?? null
  })

  return productsData.value.map((r) => {
    const qty = invMap[r.sol_productsid] ?? null
    return {
      id: r.sol_productsid,
      name: r.sol_name,
      price: r.sol_unitprice || 0,
      unit: r.sol_unit || '',
      imageUrl: r.sol_imageurl || null,
      categoryId: r['_sol_categoryid_value'] || null,
      quantityOnHand: qty,
      inStock: qty === null || qty > 0,
    }
  })
}

async function getPublicCategories() {
  const data = await dvFetch(
    `sol_categorieses?$select=sol_categoriesid,sol_name&$filter=statecode eq 0&$orderby=sol_name`
  )
  return data.value.map((r) => ({
    id: r.sol_categoriesid,
    name: r.sol_name,
  }))
}

async function dvPatchImageUrl(productId, imageUrl) {
  await dvPatch(`sol_productses(${productId})`, { sol_imageurl: imageUrl })
}

// --- Sales ledger (sol_sales) -----------------------------------------------
// Append-only log of receipt line items. A receipt can be re-sent or edited by
// Loyverse, so we make ingestion idempotent: delete any existing rows for the
// receipt, then insert the current lines fresh. Sums therefore always reconcile.

// Escape single quotes for OData string literals.
function odataStr(v) {
  return String(v).replace(/'/g, "''")
}

async function deleteSalesByReceipt(receiptNumber) {
  const data = await dvFetch(
    `sol_sales?$select=sol_saleid&$filter=sol_receiptnumber eq '${odataStr(receiptNumber)}'`
  )
  for (const r of data.value) {
    await dvDelete(`sol_sales(${r.sol_saleid})`)
  }
  return data.value.length
}

// Insert all line items for one receipt. Resolves the Dataverse product via the
// Loyverse variant id when possible so the row links back to the catalog (cost,
// category, etc.). Returns the number of lines written.
async function insertReceiptLines(receipt, lines) {
  // Optional link back to the catalog product. Lookup nav-property names are a
  // known gotcha in this org, so we only bind when SALES_PRODUCT_LOOKUP_BIND is
  // set to the exact bind key (e.g. "sol_ProductID@odata.bind"). Until then the
  // ledger still works and joins happen on sol_loyversevariantid.
  const bindProp = process.env.SALES_PRODUCT_LOOKUP_BIND
  let written = 0
  for (const line of lines) {
    const product = bindProp && line.variantId ? await getProductByVariantId(line.variantId) : null
    const row = {
      sol_name: `${receipt.receiptNumber}-${line.lineNumber}`,
      sol_receiptnumber: receipt.receiptNumber,
      sol_linenumber: line.lineNumber,
      sol_receiptdate: receipt.receiptDate,
      sol_receipttype: receipt.receiptType,
      sol_storeid: receipt.storeId || null,
      sol_itemname: line.itemName || null,
      sol_loyversevariantid: line.variantId || null,
      sol_quantity: line.quantity,
      sol_unitprice: line.unitPrice,
      sol_linetotal: line.lineTotal,
      sol_cost: line.cost,
      sol_grossmargin: line.lineTotal != null && line.cost != null ? line.lineTotal - line.cost : null,
    }
    if (product && bindProp) row[bindProp] = `/sol_productses(${product.sol_productsid})`
    await dvPost('sol_sales', row)
    written++
  }
  return written
}

module.exports = {
  dvPatchImageUrl,
  getAllLoyverseLinkedItems,
  createProductFromLoyverse,
  updateProductBarcode,
  getUnsyncedProducts,
  getProductById,
  updateProductLoyverseIds,
  getInventoryForProduct,
  createInventoryRecord,
  getProductByVariantId,
  setInventoryQuantity,
  setInventoryLevels,
  getLinkedProductsWithStock,
  deactivateProduct,
  getPublicProducts,
  getPublicCategories,
  deleteSalesByReceipt,
  insertReceiptLines,
  updateProductFields,
}
