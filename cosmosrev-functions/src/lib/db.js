const sql = require('mssql')

let pool = null

async function getPool() {
  if (pool) return pool

  const config = process.env.SQL_PASSWORD
    ? {
        user: process.env.SQL_USERNAME,
        password: process.env.SQL_PASSWORD,
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        options: { encrypt: true, trustServerCertificate: false },
      }
    : {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        authentication: { type: 'azure-active-directory-default' },
        options: { encrypt: true, trustServerCertificate: false },
      }

  pool = await sql.connect(config)
  return pool
}

// Map a Products row → sol_ shaped object so all existing function files work unchanged.
function mapProduct(row) {
  if (!row) return null
  return {
    sol_productsid: row.id,
    sol_productid: row.product_code,
    sol_name: row.name,
    sol_sku: row.sku,
    sol_barcode: row.barcode,
    sol_unitprice: row.unit_price,
    sol_cost_price: row.cost_price,
    sol_description: row.description,
    sol_unit: row.unit,
    sol_isactive: row.is_active === true || row.is_active === 1,
    sol_loyverse_item_id: row.loyverse_item_id,
    sol_loyverse_variant_id: row.loyverse_variant_id,
    sol_loyverse_sync_status: row.loyverse_sync_status,
    sol_imageurl: row.image_url,
    '_sol_categoryid_value': row.category_id,
  }
}

// Map an Inventory row → sol_ shaped object.
function mapInventory(row) {
  if (!row) return null
  return {
    sol_cosmosinventoryid: row.id,
    sol_inventoryid: row.inventory_code,
    sol_quantityonhand: row.quantity_on_hand,
    sol_reorderlevel: row.reorder_level,
    '_sol_productid_value': row.product_id,
  }
}

function nextCodeId(prefix, existing) {
  const nums = existing
    .map((v) => { const m = v?.match(/\d+$/); return m ? parseInt(m[0], 10) : 0 })
    .filter((n) => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

async function getNextProductCode() {
  const p = await getPool()
  const res = await p.request().query(
    `SELECT TOP 50 product_code FROM Products WHERE product_code IS NOT NULL ORDER BY product_code DESC`
  )
  return nextCodeId('PRD', res.recordset.map((r) => r.product_code))
}

async function getNextInventoryCode() {
  const p = await getPool()
  const res = await p.request().query(
    `SELECT TOP 50 inventory_code FROM Inventory WHERE inventory_code IS NOT NULL ORDER BY inventory_code DESC`
  )
  return nextCodeId('INV', res.recordset.map((r) => r.inventory_code))
}

async function getAllLoyverseLinkedItems() {
  const p = await getPool()
  const res = await p.request().query(
    `SELECT id, loyverse_item_id, loyverse_variant_id FROM Products WHERE is_deleted = 0 AND loyverse_item_id IS NOT NULL`
  )
  const map = {}
  res.recordset.forEach((r) => {
    map[r.loyverse_item_id] = { productId: r.id, variantId: r.loyverse_variant_id }
  })
  return map
}

async function updateProductBarcode(productId, barcode) {
  if (!barcode) return
  const p = await getPool()
  await p.request()
    .input('id', sql.UniqueIdentifier, productId)
    .input('barcode', sql.NVarChar(100), barcode)
    .query(`UPDATE Products SET barcode = @barcode, updated_at = GETUTCDATE() WHERE id = @id`)
}

async function createProductFromLoyverse(item, variantId, price, quantity, barcode, reorderLevel = 10) {
  const [productCode, inventoryCode] = await Promise.all([getNextProductCode(), getNextInventoryCode()])
  const p = await getPool()

  const productRes = await p.request()
    .input('name', sql.NVarChar(255), item.item_name)
    .input('productCode', sql.NVarChar(20), productCode)
    .input('sku', sql.NVarChar(100), item.reference_id || productCode)
    .input('barcode', sql.NVarChar(100), barcode || null)
    .input('unitPrice', sql.Decimal(18, 4), price || 0)
    .input('description', sql.NVarChar(sql.MAX), item.description || '')
    .input('loyverseItemId', sql.NVarChar(100), item.id)
    .input('loyverseVariantId', sql.NVarChar(100), variantId)
    .query(`
      INSERT INTO Products
        (name, product_code, sku, barcode, unit_price, description, is_active, loyverse_item_id, loyverse_variant_id, loyverse_sync_status)
      OUTPUT INSERTED.*
      VALUES
        (@name, @productCode, @sku, @barcode, @unitPrice, @description, 1, @loyverseItemId, @loyverseVariantId, 922880000)
    `)
  const product = productRes.recordset[0]

  await p.request()
    .input('inventoryCode', sql.NVarChar(20), inventoryCode)
    .input('productId', sql.UniqueIdentifier, product.id)
    .input('qty', sql.Decimal(18, 4), quantity ?? 0)
    .input('reorderLevel', sql.Decimal(18, 4), reorderLevel ?? 10)
    .query(`
      INSERT INTO Inventory (inventory_code, product_id, quantity_on_hand, reorder_level)
      VALUES (@inventoryCode, @productId, @qty, @reorderLevel)
    `)

  return mapProduct(product)
}

async function updateProductFields(productId, { categoryId, unitPrice, costPrice } = {}) {
  const sets = []
  const req = (await getPool()).request().input('id', sql.UniqueIdentifier, productId)

  if (unitPrice !== undefined) { sets.push('unit_price = @unitPrice'); req.input('unitPrice', sql.Decimal(18, 4), unitPrice) }
  if (costPrice !== undefined) { sets.push('cost_price = @costPrice'); req.input('costPrice', sql.Decimal(18, 4), costPrice) }
  if (categoryId === null) {
    sets.push('category_id = NULL')
  } else if (categoryId !== undefined) {
    sets.push('category_id = @categoryId')
    req.input('categoryId', sql.UniqueIdentifier, categoryId)
  }

  if (sets.length === 0) return
  sets.push('updated_at = GETUTCDATE()')
  await req.query(`UPDATE Products SET ${sets.join(', ')} WHERE id = @id`)
}

async function getUnsyncedProducts() {
  const p = await getPool()
  const res = await p.request().query(`
    SELECT id, product_code, name, sku, unit_price, description, is_active, loyverse_item_id, image_url
    FROM Products
    WHERE is_deleted = 0 AND is_active = 1 AND loyverse_item_id IS NULL
  `)
  return res.recordset.map(mapProduct)
}

async function getProductById(productId) {
  const p = await getPool()
  const res = await p.request()
    .input('id', sql.UniqueIdentifier, productId)
    .query(`
      SELECT id, product_code, name, sku, unit_price, description, is_active,
             loyverse_item_id, loyverse_variant_id, image_url
      FROM Products WHERE id = @id
    `)
  return mapProduct(res.recordset[0] || null)
}

async function updateProductLoyverseIds(productId, loyverseItemId, loyverseVariantId) {
  const p = await getPool()
  await p.request()
    .input('id', sql.UniqueIdentifier, productId)
    .input('loyverseItemId', sql.NVarChar(100), loyverseItemId)
    .input('loyverseVariantId', sql.NVarChar(100), loyverseVariantId)
    .query(`
      UPDATE Products
      SET loyverse_item_id = @loyverseItemId,
          loyverse_variant_id = @loyverseVariantId,
          loyverse_sync_status = 922880000,
          updated_at = GETUTCDATE()
      WHERE id = @id
    `)
}

async function getInventoryForProduct(productId) {
  const p = await getPool()
  const res = await p.request()
    .input('productId', sql.UniqueIdentifier, productId)
    .query(`
      SELECT TOP 1 id, inventory_code, product_id, quantity_on_hand, reorder_level
      FROM Inventory WHERE product_id = @productId AND is_deleted = 0
    `)
  return mapInventory(res.recordset[0] || null)
}

async function createInventoryRecord(productId) {
  const inventoryCode = await getNextInventoryCode()
  const p = await getPool()
  const res = await p.request()
    .input('inventoryCode', sql.NVarChar(20), inventoryCode)
    .input('productId', sql.UniqueIdentifier, productId)
    .query(`
      INSERT INTO Inventory (inventory_code, product_id, quantity_on_hand, reorder_level)
      OUTPUT INSERTED.*
      VALUES (@inventoryCode, @productId, 0, 10)
    `)
  return mapInventory(res.recordset[0])
}

async function getProductByVariantId(loyverseVariantId) {
  const p = await getPool()
  const res = await p.request()
    .input('variantId', sql.NVarChar(100), loyverseVariantId)
    .query(`
      SELECT TOP 1 id, product_code, name, sku
      FROM Products WHERE loyverse_variant_id = @variantId AND is_deleted = 0
    `)
  return mapProduct(res.recordset[0] || null)
}

async function setInventoryQuantity(productId, quantity) {
  const p = await getPool()
  const check = await p.request()
    .input('productId', sql.UniqueIdentifier, productId)
    .query(`SELECT TOP 1 id FROM Inventory WHERE product_id = @productId AND is_deleted = 0`)

  if (check.recordset.length) {
    await p.request()
      .input('productId', sql.UniqueIdentifier, productId)
      .input('qty', sql.Decimal(18, 4), quantity)
      .query(`UPDATE Inventory SET quantity_on_hand = @qty, updated_at = GETUTCDATE() WHERE product_id = @productId AND is_deleted = 0`)
  } else {
    const inventoryCode = await getNextInventoryCode()
    await p.request()
      .input('inventoryCode', sql.NVarChar(20), inventoryCode)
      .input('productId', sql.UniqueIdentifier, productId)
      .input('qty', sql.Decimal(18, 4), quantity)
      .query(`INSERT INTO Inventory (inventory_code, product_id, quantity_on_hand, reorder_level) VALUES (@inventoryCode, @productId, @qty, 10)`)
  }
}

async function setInventoryLevels(productId, { quantity, reorderLevel } = {}) {
  if (quantity == null && reorderLevel == null) return

  const p = await getPool()
  const check = await p.request()
    .input('productId', sql.UniqueIdentifier, productId)
    .query(`SELECT TOP 1 id FROM Inventory WHERE product_id = @productId AND is_deleted = 0`)

  if (check.recordset.length) {
    const sets = ['updated_at = GETUTCDATE()']
    const req = p.request().input('productId', sql.UniqueIdentifier, productId)
    if (quantity != null) { sets.push('quantity_on_hand = @qty'); req.input('qty', sql.Decimal(18, 4), quantity) }
    if (reorderLevel != null) { sets.push('reorder_level = @reorderLevel'); req.input('reorderLevel', sql.Decimal(18, 4), reorderLevel) }
    await req.query(`UPDATE Inventory SET ${sets.join(', ')} WHERE product_id = @productId AND is_deleted = 0`)
  } else {
    const inventoryCode = await getNextInventoryCode()
    await p.request()
      .input('inventoryCode', sql.NVarChar(20), inventoryCode)
      .input('productId', sql.UniqueIdentifier, productId)
      .input('qty', sql.Decimal(18, 4), quantity ?? 0)
      .input('reorderLevel', sql.Decimal(18, 4), reorderLevel ?? 10)
      .query(`INSERT INTO Inventory (inventory_code, product_id, quantity_on_hand, reorder_level) VALUES (@inventoryCode, @productId, @qty, @reorderLevel)`)
  }
}

async function getLinkedProductsWithStock() {
  const p = await getPool()
  const res = await p.request().query(`
    SELECT p.id, p.name, p.sku, p.loyverse_variant_id, p.loyverse_item_id,
           i.quantity_on_hand, i.reorder_level
    FROM Products p
    LEFT JOIN Inventory i ON i.product_id = p.id AND i.is_deleted = 0
    WHERE p.is_deleted = 0 AND p.is_active = 1 AND p.loyverse_variant_id IS NOT NULL
  `)
  return res.recordset.map((r) => ({
    productId: r.id,
    name: r.name,
    sku: r.sku,
    variantId: r.loyverse_variant_id,
    itemId: r.loyverse_item_id,
    quantity: r.quantity_on_hand ?? null,
    reorderLevel: r.reorder_level ?? null,
  }))
}

async function deactivateProduct(productId) {
  const p = await getPool()
  await p.request()
    .input('productId', sql.UniqueIdentifier, productId)
    .query(`UPDATE Inventory SET is_deleted = 1, updated_at = GETUTCDATE() WHERE product_id = @productId`)
  await p.request()
    .input('id', sql.UniqueIdentifier, productId)
    .query(`UPDATE Products SET is_deleted = 1, is_active = 0, updated_at = GETUTCDATE() WHERE id = @id`)
}

async function getPublicProducts() {
  const p = await getPool()
  const res = await p.request().query(`
    SELECT p.id, p.name, p.unit_price, p.unit, p.image_url, p.category_id, i.quantity_on_hand
    FROM Products p
    LEFT JOIN Inventory i ON i.product_id = p.id AND i.is_deleted = 0
    WHERE p.is_deleted = 0 AND p.is_active = 1
    ORDER BY p.name
  `)
  return res.recordset.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.unit_price || 0,
    unit: r.unit || '',
    imageUrl: r.image_url || null,
    categoryId: r.category_id || null,
    quantityOnHand: r.quantity_on_hand ?? null,
    inStock: r.quantity_on_hand === null || r.quantity_on_hand > 0,
  }))
}

async function getPublicCategories() {
  const p = await getPool()
  const res = await p.request().query(
    `SELECT id, name FROM Categories WHERE is_deleted = 0 ORDER BY name`
  )
  return res.recordset.map((r) => ({ id: r.id, name: r.name }))
}

async function dvPatchImageUrl(productId, imageUrl) {
  const p = await getPool()
  await p.request()
    .input('id', sql.UniqueIdentifier, productId)
    .input('imageUrl', sql.NVarChar(sql.MAX), imageUrl)
    .query(`UPDATE Products SET image_url = @imageUrl, updated_at = GETUTCDATE() WHERE id = @id`)
}

// Reads the sales ledger for a { since, until } ISO window (until optional).
// Shaped to match what the Sales page expects: id, receiptNumber, date, type, etc.
async function getSalesLines({ since, until } = {}) {
  const p = await getPool()
  const req = p.request().input('since', sql.DateTime2, new Date(since))
  let query = `
    SELECT id, receipt_number, line_number, receipt_date, receipt_type, item_name,
           loyverse_variant_id, quantity, unit_price, line_total, cost, gross_margin
    FROM Sales
    WHERE receipt_date >= @since`
  if (until) {
    req.input('until', sql.DateTime2, new Date(until))
    query += ` AND receipt_date < @until`
  }
  query += ` ORDER BY receipt_date DESC`
  const res = await req.query(query)
  return res.recordset.map((r) => ({
    id: r.id,
    receiptNumber: r.receipt_number,
    lineNumber: r.line_number,
    date: r.receipt_date,
    type: r.receipt_type || 'SALE',
    itemName: r.item_name,
    variantId: r.loyverse_variant_id || null,
    quantity: r.quantity != null ? Number(r.quantity) : 0,
    unitPrice: r.unit_price != null ? Number(r.unit_price) : 0,
    lineTotal: r.line_total != null ? Number(r.line_total) : 0,
    cost: r.cost != null ? Number(r.cost) : null,
    grossMargin: r.gross_margin != null ? Number(r.gross_margin) : null,
  }))
}

async function deleteSalesByReceipt(receiptNumber) {
  const p = await getPool()
  const res = await p.request()
    .input('receiptNumber', sql.NVarChar(100), receiptNumber)
    .query(`DELETE FROM Sales OUTPUT DELETED.id WHERE receipt_number = @receiptNumber`)
  return res.rowsAffected[0] || 0
}

async function insertReceiptLines(receipt, lines) {
  const p = await getPool()
  let written = 0
  for (const line of lines) {
    let productId = null
    if (line.variantId) {
      const prodRes = await p.request()
        .input('variantId', sql.NVarChar(100), line.variantId)
        .query(`SELECT TOP 1 id FROM Products WHERE loyverse_variant_id = @variantId AND is_deleted = 0`)
      productId = prodRes.recordset[0]?.id || null
    }

    const grossMargin = line.lineTotal != null && line.cost != null ? line.lineTotal - line.cost : null

    await p.request()
      .input('name', sql.NVarChar(255), `${receipt.receiptNumber}-${line.lineNumber}`)
      .input('receiptNumber', sql.NVarChar(100), receipt.receiptNumber)
      .input('lineNumber', sql.Int, line.lineNumber)
      .input('receiptDate', sql.DateTime2, new Date(receipt.receiptDate))
      .input('receiptType', sql.NVarChar(20), receipt.receiptType || 'SALE')
      .input('storeId', sql.NVarChar(100), receipt.storeId || null)
      .input('itemName', sql.NVarChar(255), line.itemName || null)
      .input('loyverseVariantId', sql.NVarChar(100), line.variantId || null)
      .input('quantity', sql.Decimal(18, 4), line.quantity)
      .input('unitPrice', sql.Decimal(18, 4), line.unitPrice)
      .input('lineTotal', sql.Decimal(18, 4), line.lineTotal ?? null)
      .input('cost', sql.Decimal(18, 4), line.cost ?? null)
      .input('grossMargin', sql.Decimal(18, 4), grossMargin)
      .input('productId', sql.UniqueIdentifier, productId)
      .query(`
        INSERT INTO Sales
          (name, receipt_number, line_number, receipt_date, receipt_type, store_id,
           item_name, loyverse_variant_id, quantity, unit_price, line_total, cost, gross_margin, product_id)
        VALUES
          (@name, @receiptNumber, @lineNumber, @receiptDate, @receiptType, @storeId,
           @itemName, @loyverseVariantId, @quantity, @unitPrice, @lineTotal, @cost, @grossMargin, @productId)
      `)
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
  getSalesLines,
  updateProductFields,
}
