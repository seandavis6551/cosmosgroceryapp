const { app } = require('@azure/functions')
const { getPublicCategories } = require('../lib/db')

app.http('getCategories', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const categories = await getPublicCategories()
      return { status: 200, jsonBody: categories }
    } catch (err) {
      context.log(`getCategories error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
