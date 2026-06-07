const { app } = require('@azure/functions')
const { getAllLoyverseLinkedItems, createProductFromLoyverse, setInventoryQuantity, updateProductBarcode } = require('../lib/dataverse')
const { getAllItems, getStoreInventory } = require('../lib/loyverse')

app.http('pullFromLoyverse', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('pullFromLoyverse triggered')

    const results = { imported: [], updated: [], skipped: [], failed: [] }

    try {
      const [loyverseItemsRes, loyverseInvRes, existingMap] = await Promise.all([
        getAllItems(),
        getStoreInventory(),
        getAllLoyverseLinkedItems(),
      ])

      const loyverseItems = loyverseItemsRes.items || []

      // Build stockMap: variantId → in_stock
      const stockMap = {}
      const levels = loyverseInvRes.inventory_levels || loyverseInvRes.items_variants || []
      for (const entry of levels) {
        const qty = entry.in_stock ?? entry.stock_after ?? null
        if (entry.variant_id && qty !== null) stockMap[entry.variant_id] = qty
      }

      context.log(`Loyverse: ${loyverseItems.length} items, ${levels.length} inventory entries`)
      context.log(`Dataverse: ${Object.keys(existingMap).length} already linked products`)

      for (const item of loyverseItems) {
        const variant = item.variants?.[0]
        if (!variant) {
          results.skipped.push({ name: item.item_name, reason: 'no variant' })
          continue
        }

        const variantId = variant.variant_id
        const price = variant.default_price ?? variant.stores?.[0]?.price ?? 0
        const qty = stockMap[variantId] ?? 0
        const barcode = variant.barcode || null

        if (existingMap[item.id]) {
          // Already in Dataverse — update stock and barcode
          const { productId } = existingMap[item.id]
          try {
            await setInventoryQuantity(productId, qty)
            await updateProductBarcode(productId, barcode)
            results.updated.push({ name: item.item_name, qty })
          } catch (err) {
            context.log(`Failed to update stock for ${item.item_name}: ${err.message}`)
            results.failed.push({ name: item.item_name, error: err.message })
          }
        } else {
          // New item — import into Dataverse
          try {
            await createProductFromLoyverse(item, variantId, price, qty, barcode)
            results.imported.push({ name: item.item_name, qty, price })
          } catch (err) {
            context.log(`Failed to import ${item.item_name}: ${err.message}`)
            results.failed.push({ name: item.item_name, error: err.message })
          }
        }
      }

      return {
        status: 200,
        jsonBody: {
          message: `${results.imported.length} imported, ${results.updated.length} stock updated, ${results.skipped.length} skipped, ${results.failed.length} failed.`,
          ...results,
        },
      }
    } catch (err) {
      context.log(`pullFromLoyverse error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
