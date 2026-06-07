const { app } = require('@azure/functions')
const { BlobServiceClient } = require('@azure/storage-blob')
const { dvPatchImageUrl } = require('../lib/dataverse')

app.http('uploadProductImage', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log('uploadProductImage triggered')

    try {
      const productId = request.query.get('productId')
      if (!productId) return { status: 400, jsonBody: { error: 'productId query param required' } }

      const contentType = request.headers.get('content-type') || 'image/jpeg'
      const buffer = await request.arrayBuffer()
      if (!buffer || buffer.byteLength === 0) {
        return { status: 400, jsonBody: { error: 'No image data received' } }
      }

      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
      const blobName = `${productId}.${ext}`

      const blobService = BlobServiceClient.fromConnectionString(process.env.BLOB_STORAGE_CONNECTION_STRING)
      const container = blobService.getContainerClient(process.env.BLOB_CONTAINER_NAME)
      const blobClient = container.getBlockBlobClient(blobName)

      await blobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType },
        overwrite: true,
      })

      const imageUrl = blobClient.url

      // Save public URL to sol_image_url in Dataverse
      await dvPatchImageUrl(productId, imageUrl)

      return { status: 200, jsonBody: { imageUrl } }
    } catch (err) {
      context.log(`uploadProductImage error: ${err.message}`)
      return { status: 500, jsonBody: { error: err.message } }
    }
  },
})
