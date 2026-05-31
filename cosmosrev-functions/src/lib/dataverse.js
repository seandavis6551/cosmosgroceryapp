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

async function getUnsyncedProducts() {
  const data = await dvFetch(
    `sol_productses?$select=sol_productsid,sol_name,sol_sku,sol_unitprice,sol_description,sol_isactive,sol_loyverse_item_id` +
    `&$filter=statecode eq 0 and sol_isactive eq true and sol_loyverse_item_id eq null`
  )
  return data.value
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
    'sol_ProductId@odata.bind': `/sol_productses(${productId})`,
  })
}

// Requires sol_unit and sol_image_url fields on sol_productses in Dataverse
async function getPublicProducts() {
  const data = await dvFetch(
    `sol_productses?$select=sol_productsid,sol_name,sol_unitprice,sol_unit,sol_image_url,_sol_categoryid_value` +
    `&$filter=statecode eq 0 and sol_isactive eq true&$orderby=sol_name`
  )
  return data.value.map((r) => ({
    id: r.sol_productsid,
    name: r.sol_name,
    price: r.sol_unitprice || 0,
    unit: r.sol_unit || '',
    imageUrl: r.sol_image_url || null,
    categoryId: r['_sol_categoryid_value'] || null,
  }))
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

module.exports = {
  getUnsyncedProducts,
  updateProductLoyverseIds,
  getInventoryForProduct,
  createInventoryRecord,
  getPublicProducts,
  getPublicCategories,
}
