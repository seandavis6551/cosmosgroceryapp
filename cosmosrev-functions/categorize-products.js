// Suggests a category for each product from its name (keyword rules) and writes
// a reviewable Excel sheet. Does NOT write to Dataverse — review first.
//   node categorize-products.js
const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'products_dump.json'), 'utf8'))

// Ordered: first match wins. Specific overrides come before generic.
const RULES = [
  [/baby (oil|wipe)/, 'Personal Care'],
  [/peanut butter/, 'Condiments & Sauces'],
  [/(soya?\s*bean oil|soyabean|soysbean|pure .*oil|vegetable oil|\bcooking oil\b)/, 'Condiments & Sauces'],
  [/\bcharles\b/, 'Snacks & Confectionery'],
  [/(carnation|evaporated|filled milk|butterfly|peanut punch|cho'?c nut|condensed)/, 'Dairy & Eggs'],
  [/(flavou?red milk|almond milk|proud land|dairy dairy|creemee|\bsilk\b|\bmilk\b)/, 'Dairy & Eggs'],
  [/(blue band|margarine|\bbutter\b|cheese|yogh?urt|\beggs?\b)/, 'Dairy & Eggs'],
  [/(body powder|cornstarch powder|deodorant|anti-?perspirant|body wash|hand soap|medicated soap|\bsoap\b|shampoo|conditioner|toothpaste|colgate|aquafresh|\baxe\b|\bbrut\b|\bdove\b|\bdegree\b|gillette|old spice|petroleum jelly|hair (styling|food|wax)|gabri|jet jet|herbal blend|\blux\b|reach .*(clean|crystal|firm|soft|medium)|make up remover|feminine|flushab|stayfree|\bmaxi\b|condom|cool mint|simply for women)/, 'Personal Care'],
  [/(cleaner|bleach|dishwashing|diswashing|laundry|detergent|fabric softener|paper towel|aluminum foil|aluminium foil|easi-wrap|light bulb|broom|\bmop\b|garbage|trash|napkin|tissue|sponge|plastic cup|\bfork|spoon|spork|cutlery|sparklean)/, 'Household & Cleaning'],
  [/(tuna|sardine|mackerel|salmon|corned beef|vienna sausage|sausage|luncheon|baked beans|peas & carrots|\bpeas\b)/, 'Canned & Packaged Goods'],
  [/(bbq sauce|ketchup|mayonnaise|\bmayo\b|pepper sauce|hot sauce|soy sauce|\bsauce\b|\bseasoning\b|vinegar|\bsalt\b|black pepper|\bpepper\b|oregano|vet-?sin|\bjam\b|guava)/, 'Condiments & Sauces'],
  [/(cola|coca-?cola|gatorade|lucozade|monster|\bsting\b|energy|smalta|malta|mauby|kool-?aid|\btang\b|ginger ale|schweppes|juse|juice|sorrel|bitters|chill lemon)/, 'Non-Alcoholic Beverages'],
  [/(nescafe|coffee|cappuccino|mokaccino|ovaltine|milo|\btea\b|cocoa)/, 'Beverages'],
  [/(\brice\b|corn ?meal|\boats\b|wheat bran|\bbran\b|\bflour\b|macaroni|spaghetti|pasta|noodle|chowmein|ramen|samyang|popcorn|\bsugar\b|corn flakes|frosted flakes|choco flakes|nutty flakes|wheat flakes|raisin bran|granola|cereal|froot|zoomers|super shapes|\bflakes\b|\bdelight\b)/, 'Grains & Cereals'],
  [/(\bbread\b|\bbuns?\b|\brolls?\b|\bkiss\b|wheat hops|cbi wheat|\bwheat\b)/, 'Grains & Cereals'],
  [/(chocolate|choclate|catch|gold finger|devon|chips|tortillaz|big foot|peanuts|peanola|granola bar|crackers|biscuit|cookie|wafer|candy|sweets|\bgum\b|ping pong|toca loco|toco loco|twin (milk|crunch)|bonanza|raisin & nut|fruit & nut)/, 'Snacks & Confectionery'],
]

function categorize(name) {
  const n = name.toLowerCase()
  for (const [re, cat] of RULES) if (re.test(n)) return cat
  return '⚠ REVIEW'
}

const out = rows.map((r) => ({ ...r, suggested: categorize(r.name) }))
out.sort((a, b) => a.suggested.localeCompare(b.suggested) || a.name.localeCompare(b.name))

// Summary
const counts = {}
out.forEach((r) => { counts[r.suggested] = (counts[r.suggested] || 0) + 1 })
console.log('Suggested category counts:')
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(3)}  ${k}`))
const review = out.filter((r) => r.suggested === '⚠ REVIEW')
console.log(`\n${review.length} need manual review:`)
review.forEach((r) => console.log('   - ' + r.name))

;(async () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Stock Count')
  ws.columns = [
    { header: 'Suggested Category', key: 'suggested', width: 26 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Barcode', key: 'bc', width: 18 },
    { header: 'Product Name', key: 'name', width: 46 },
    { header: 'COUNTED QTY', key: 'counted', width: 14 },
    { header: 'Notes', key: 'notes', width: 28 },
  ]
  out.forEach((r) => ws.addRow(r))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.getCell('E1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }

  const date = new Date().toISOString().slice(0, 10)
  const outPath = path.join(__dirname, '..', '..', `CosmosRev_Stock_Count_Categorized_${date}.xlsx`)
  await wb.xlsx.writeFile(outPath)
  console.log(`\nWrote ${out.length} products to:\n  ${outPath}`)
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
