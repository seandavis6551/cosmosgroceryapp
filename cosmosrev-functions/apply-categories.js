// Creates the Tobacco category (if missing) and assigns a category to every
// active product from its name. Dry run by default; pass --apply to write.
//   node apply-categories.js            # dry run — shows the plan
//   node apply-categories.js --apply    # creates Tobacco + patches products
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)
const { ClientSecretCredential } = require('@azure/identity')
const cred = new ClientSecretCredential(process.env.DATAVERSE_TENANT_ID, process.env.DATAVERSE_CLIENT_ID, process.env.DATAVERSE_CLIENT_SECRET)
const APPLY = process.argv.includes('--apply')

async function dv(method, query, body) {
  const token = (await cred.getToken(`${process.env.DATAVERSE_URL}/.default`)).token
  const res = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'If-Match': method === 'PATCH' ? '*' : undefined,
      Prefer: method === 'POST' ? 'return=representation' : undefined,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

const RULES = [
  [/dunhill|rothmans|lucky strike/, 'Tobacco'],
  [/\bkiss\b|\bbread\b|\bbuns?\b|\brolls?\b|wheat hops|cbi wheat/, 'Bakery'],
  [/baby (oil|wipe)/, 'Personal Care'],
  [/peanut butter/, 'Condiments & Sauces'],
  [/(soya?\s*bean oil|soyabean|soysbean|pure .*oil|vegetable oil)/, 'Condiments & Sauces'],
  [/\bcharles\b/, 'Snacks & Confectionery'],
  [/(carnation|evaporated|filled milk|butterfly|peanut punch|cho'?c nut|condensed)/, 'Dairy & Eggs'],
  [/(flavou?red milk|almond milk|proud land|dairy dairy|creemee|\bsilk\b|\bmilk\b)/, 'Dairy & Eggs'],
  [/(blue band|margarine|\bbutter\b|cheese|yogh?urt|\beggs?\b|french maid|island pride)/, 'Dairy & Eggs'],
  [/(body powder|cornstarch powder|deodorant|anti-?perspirant|body wash|hand soap|medicated soap|\bsoap\b|shampoo|conditioner|toothpaste|colgate|aquafresh|\baxe\b|\bbrut\b|\bdove\b|\bdegree\b|gillette|old spice|petroleum jelly|hair (styling|food|wax)|gabri|jet jet|herbal blend|\blux\b|reach .*(clean|crystal|firm|soft|medium)|make up remover|feminine|flushab|stayfree|\bmaxi\b|condom|cool mint|simply for women)/, 'Personal Care'],
  [/(cleaner|bleach|dishwashing|diswashing|laundry|detergent|fabric softener|paper towel|aluminum foil|aluminium foil|easi-wrap|light bulb|broom|\bmop\b|garbage|trash|napkin|tissue|sponge|plastic cup|\bfork|spoon|spork|cutlery|sparklean|bandeja)/, 'Household & Cleaning'],
  [/(tuna|sardine|mackerel|salmon|corned beef|vienna sausage|sausage|luncheon|baked beans|peas & carrots|\bpeas\b)/, 'Canned & Packaged Goods'],
  [/(bbq sauce|ketchup|mayonnaise|\bmayo\b|pepper sauce|hot sauce|soy sauce|\bsauce\b|\bseasoning\b|vinegar|\bsalt\b|black pepper|\bpepper\b|oregano|vet-?sin|\bjam\b|guava)/, 'Condiments & Sauces'],
  [/(cola|coca-?cola|gatorade|lucozade|monster|\bsting\b|energy|smalta|malta|mauby|kool-?aid|\btang\b|ginger ale|schweppes|juse|juice|sorrel|bitters|chill lemon)/, 'Non-Alcoholic Beverages'],
  [/(nescafe|coffee|cappuccino|mokaccino|ovaltine|milo|\btea\b|cocoa)/, 'Beverages'],
  [/(\brice\b|corn ?meal|\boats\b|good fashioned|wheat bran|\bbran\b|\bflour\b|macaroni|spaghetti|pasta|noodle|chowmein|ramen|samyang|popcorn|\bsugar\b|corn flakes|frosted flakes|choco flakes|nutty flakes|wheat flakes|raisin bran|granola|cereal|froot|zoomers|super shapes|\bflakes\b|\bdelight\b)/, 'Grains & Cereals'],
  [/(\bbread\b|\bbuns?\b|\brolls?\b|\bkiss\b|wheat hops|cbi wheat|\bwheat\b)/, 'Grains & Cereals'],
  [/(chocolate|choclate|catch|gold finger|devon|chips|tortillaz|big foot|peanuts|peanola|granola bar|crackers|biscuit|cookie|wafer|candy|sweets|\bgum\b|ping pong|toca loco|toco loco|twin (milk|crunch)|bonanza|raisin & nut|fruit & nut)/, 'Snacks & Confectionery'],
]
function categorize(name) {
  const n = name.toLowerCase()
  for (const [re, cat] of RULES) if (re.test(n)) return cat
  return null
}
function nextCat(existing) {
  const nums = existing.map((v) => { const m = v?.match(/\d+$/); return m ? parseInt(m[0], 10) : 0 }).filter((n) => !isNaN(n))
  return `CAT-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`
}

;(async () => {
  const cats = (await dv('GET', `sol_categorieses?$select=sol_categoriesid,sol_categoryid,sol_name&$filter=statecode eq 0`)).value
  const byName = {}; cats.forEach((c) => { byName[c.sol_name] = c.sol_categoriesid })

  // Ensure required categories exist (create any that are missing).
  const allIds = cats.map((c) => c.sol_categoryid).filter(Boolean)
  for (const catName of ['Tobacco', 'Bakery']) {
    if (byName[catName]) { console.log(`${catName} category already exists ✓`); continue }
    const id = nextCat(allIds)
    allIds.push(id)
    console.log(`${APPLY ? 'Creating' : 'WOULD create'} category "${catName}" (${id})`)
    if (APPLY) {
      const created = await dv('POST', 'sol_categorieses', { sol_name: catName, sol_categoryid: id })
      byName[catName] = created.sol_categoriesid
    }
  }

  const prods = (await dv('GET', `sol_productses?$select=sol_productsid,sol_name,_sol_categoryid_value&$filter=statecode eq 0 and sol_isactive eq true&$orderby=sol_name&$top=400`)).value

  let toSet = 0, already = 0, unresolved = 0, written = 0, failed = 0
  for (const p of prods) {
    const cat = categorize(p.sol_name)
    if (!cat) { unresolved++; console.log('  ? no rule:', p.sol_name); continue }
    if (p._sol_categoryid_value && byName[cat] === p._sol_categoryid_value) { already++; continue }
    toSet++
    if (APPLY) {
      const guid = byName[cat]
      if (!guid) { failed++; console.log('  ! category row missing (run --apply to create Tobacco first):', cat); continue }
      try { await dv('PATCH', `sol_productses(${p.sol_productsid})`, { 'sol_CategoryID@odata.bind': `/sol_categorieses(${guid})` }); written++ }
      catch (e) { failed++; console.log('  ! patch failed', p.sol_name, e.message) }
    }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}: ${toSet} to assign, ${already} already correct, ${unresolved} unresolved` + (APPLY ? `, ${written} written, ${failed} failed` : ''))
  if (!APPLY) console.log('Re-run with --apply to write.')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
