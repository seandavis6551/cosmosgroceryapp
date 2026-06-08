// Downloads product front images from Open Food Facts (open, freely-licensed)
// by barcode, into the "Product pics" folder, named by the product name.
// Local/Caribbean brands often aren't in OFF, so coverage will be partial.
//   node off-images.js
const fs = require('fs')
const path = require('path')

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'products_dump.json'), 'utf8'))
const OUT_DIR = path.join(__dirname, '..', '..', 'grocery-app', 'Product pics')
fs.mkdirSync(OUT_DIR, { recursive: true })

const UA = 'CosmosRev-Inventory/1.0 (seandavis6551@gmail.com)'

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  let found = 0, missing = 0, noBarcode = 0, failed = 0
  const used = new Set()

  for (const r of rows) {
    if (!r.bc) { noBarcode++; continue }
    try {
      const api = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(r.bc)}.json?fields=image_front_url`
      const res = await fetch(api, { headers: { 'User-Agent': UA } })
      const data = await res.json()
      const url = data?.product?.image_front_url
      if (!url) { missing++; continue }

      let base = safeName(r.name)
      if (used.has(base.toLowerCase())) base = `${base} (${r.sku})`
      used.add(base.toLowerCase())
      const ext = (url.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0]
      const file = path.join(OUT_DIR, base + ext)

      const img = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!img.ok) { failed++; continue }
      fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()))
      found++
      console.log(`✓ ${base}${ext}`)
    } catch (e) {
      failed++
      console.log(`✗ ${r.name}: ${e.message}`)
    }
    await sleep(150) // be polite to the OFF API
  }

  console.log(`\nDone. ${found} images downloaded, ${missing} not in OFF, ${noBarcode} no barcode, ${failed} failed.`)
  console.log(`Folder: ${OUT_DIR}`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
