const { app } = require('@azure/functions')
const { updateProductFields } = require('../lib/dataverse')

// Updates editable product fields (category, prices) on behalf of the inventory
// app, using the service principal. This avoids requiring each signed-in user to
// hold Append/AppendTo privilege on the product↔category lookup.
//
// Body: { productId, categoryId?, unitPrice?, costPrice? }
//   - categoryId: GUID to set, or null to clear; omit to leave unchanged.
app.http('updateProduct', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let body
    try { body = await request.json() } catch { return { status: 400, jsonBody: { error: 'Invalid JSON body' } } }

    const { productId, categoryId, unitPrice, costPrice } = body || {}
    if (!productId) return { status: 400, jsonBody: { error: 'productId is required' } }

    const fields = {}
    if (categoryId !== undefined) fields.categoryId = categoryId
    if (unitPrice !== undefined) fields.unitPrice = unitPrice
    if (costPrice !== undefined) fields.costPrice = costPrice

    try {
      await updateProductFields(productId, fields)
      return { status: 200, jsonBody: { ok: true, productId } }
    } catch (err) {
      context.log(`updateProduct error for ${productId}: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message, productId } }
    }
  },
})
