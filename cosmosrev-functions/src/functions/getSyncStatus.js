const { app } = require('@azure/functions')
const { getSyncMeta } = require('../lib/db')

// Small status read for the Dashboard header: when did pullFromLoyverse last
// actually complete (distinct from any product's individual updated_at).
app.http('getSyncStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const lastPullFromLoyverse = await getSyncMeta('lastPullFromLoyverse')
      return { status: 200, jsonBody: { lastPullFromLoyverse } }
    } catch (err) {
      // SyncMeta table not provisioned yet — not an error the UI needs to see.
      context.log(`getSyncStatus: ${err.message}`)
      return { status: 200, jsonBody: { lastPullFromLoyverse: null } }
    }
  },
})
