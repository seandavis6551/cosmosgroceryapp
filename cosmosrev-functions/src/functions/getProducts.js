const { app } = require('@azure/functions')
const { getPublicProducts } = require('../lib/db')

app.http('getProducts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const products = await getPublicProducts()
      return { status: 200, jsonBody: products }
    } catch (err) {
      context.log(`getProducts error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
