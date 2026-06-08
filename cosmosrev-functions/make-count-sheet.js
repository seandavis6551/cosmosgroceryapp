// Generates a physical stock-count sheet (Excel) of every active product, for
// Lashley's staff to fill in by hand. Sorted by category, with a blank
// "Counted Qty" column. Reads creds from local.settings.json.
//
//   npm i --no-save exceljs
//   node make-count-sheet.js
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)

const ExcelJS = require('exceljs')
const { ClientSecretCredential } = require('@azure/identity')
const cred = new ClientSecretCredential(
  process.env.DATAVERSE_TENANT_ID,
  process.env.DATAVERSE_CLIENT_ID,
  process.env.DATAVERSE_CLIENT_SECRET
)

async function dv(query) {
  const token = (await cred.getToken(`${process.env.DATAVERSE_URL}/.default`)).token
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Dataverse ${res.status}: ${await res.text()}`)
  return res.json()
}

;(async () => {
  const [prods, cats] = await Promise.all([
    dv(`sol_productses?$select=sol_name,sol_sku,sol_barcode,sol_unit,_sol_categoryid_value&$filter=statecode eq 0 and sol_isactive eq true&$orderby=sol_name`),
    dv(`sol_categorieses?$select=sol_categoriesid,sol_name&$filter=statecode eq 0`),
  ])

  const catMap = {}
  cats.value.forEach((c) => { catMap[c.sol_categoriesid] = c.sol_name })

  const rows = prods.value.map((p) => ({
    category: catMap[p._sol_categoryid_value] || 'Uncategorised',
    sku: p.sol_sku || '',
    barcode: p.sol_barcode || '',
    name: p.sol_name || '',
    unit: p.sol_unit || '',
  }))

  // Sort by category, then product name — so staff can count shelf by shelf.
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Stock Count')

  ws.columns = [
    { header: 'Category', key: 'category', width: 26 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Barcode', key: 'barcode', width: 18 },
    { header: 'Product Name', key: 'name', width: 42 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'COUNTED QTY', key: 'counted', width: 16 },
    { header: 'Notes', key: 'notes', width: 30 },
  ]

  rows.forEach((r) => ws.addRow(r))

  // Header styling + freeze
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).alignment = { vertical: 'middle' }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  // Highlight the column staff must fill
  ws.getColumn('counted').eachCell((cell, rowNo) => {
    if (rowNo === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  })

  const date = new Date().toISOString().slice(0, 10)
  const outPath = path.join(__dirname, '..', '..', `CosmosRev_Stock_Count_${date}.xlsx`)
  await wb.xlsx.writeFile(outPath)
  console.log(`Wrote ${rows.length} products to:\n  ${outPath}`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
