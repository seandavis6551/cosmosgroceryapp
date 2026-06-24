// Categorizes ONLY uncategorized (newly added) products, using the current
// taxonomy (Beverages = ready-to-drink, Drink Mixes, Bakery, Tobacco, etc.).
// Never touches products that already have a category, so manual fixes are safe.
//   node categorize-new.js            # dry run
//   node categorize-new.js --apply    # write
const fs = require('fs')
const path = require('path')
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values)
const { ClientSecretCredential } = require('@azure/identity')
const cred = new ClientSecretCredential(process.env.DATAVERSE_TENANT_ID, process.env.DATAVERSE_CLIENT_ID, process.env.DATAVERSE_CLIENT_SECRET)
const APPLY = process.argv.includes('--apply')

async function dv(m, q, b) {
  const t = (await cred.getToken(`${process.env.DATAVERSE_URL}/.default`)).token
  const r = await fetch(`${process.env.DATAVERSE_URL}/api/data/v9.2/${q}`, {
    method: m, headers: { Authorization: `Bearer ${t}`, Accept: 'application/json', 'Content-Type': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'If-Match': m === 'PATCH' ? '*' : undefined },
    body: b ? JSON.stringify(b) : undefined,
  })
  if (!r.ok) throw new Error(`${m} ${r.status}: ${(await r.text()).slice(0, 150)}`)
  return r.status === 204 ? null : r.json()
}

// Ordered, first match wins.
const RULES = [
  [/^a grocery item$/i, 'REVIEW (placeholder?)'],
  [/cable|charger|earphone|\busb\b|lightning|type.?c|mynheers|samsung/i, 'REVIEW (electronics — no category)'],
  [/sheer perfect|panty hose/i, 'Personal Care'],
  [/du maurier|dunhill|rothmans|lucky strike|lucky broadway|broadway|cigarette|raw black|rice paper|rolling paper|\blighter\b/i, 'Tobacco'],
  [/carib lager|stag beer|\bbeer\b|\brum\b|\bvodka\b|stout|puncheon|\bwine\b/i, 'Alcoholic Beverages'],
  [/kiss cake|cupcake|fruit cake|coconut cake|chocolate cake|danish|holsum/i, 'Bakery'],
  [/dasheen|eddoes|\bplantain\b(?!.*chip)|\byam\b|cassava \(/i, 'Root Vegetables'],
  [/julie mango|mango \(each\)/i, 'Fruits'],
  [/\bmilo\b|\btea\b(?!time)|coffee|nescafe|ovaltine|\btang\b|kool-?aid/i, 'Drink Mixes'],
  [/chip|crackers?|cookie|biscuit|crix|dixee|bermudez|pringles|holiday|cej|curves|sunshine snacks|sunshine ole|chee ?zee|chipster|ripples|zoomers|sun mix|teatime|devon|charles nuggle|cheese balls|corn curls|choco gems|cashew|soldanza|snackers|shortcake|shirley|banderilla|khurma|picarindo|pulpito|wheat crisps|nibbles|rough tops|domino|grainz|stiks|big foot|flamin stik|wafer|candy|yum yum/i, 'Snacks & Confectionery'],
  [/anchor butter|blue band|\bbutter\b|margarine|country house|^imperial$|island pride|\beggs?\b|cheese(?! ?balls)/i, 'Dairy & Eggs'],
  [/corned beef|coconut milk|chicken franks|streaky bacon|\bbacon\b|sardine|\btuna\b|\bham\b/i, 'Canned & Packaged Goods'],
  [/pepper sauce|mustard|\bcurry\b|\bsauce\b|ketchup|seasoning|vinegar/i, 'Condiments & Sauces'],
  [/\bpasta\b|penne|shells|twists|rigate|farine|frosted flakes|froot|super shapes|granola|wheat flakes|cereal|\brice\b(?! paper)|\bflour\b|\boats\b/i, 'Grains & Cereals'],
  [/playtex|inhaler|spray alien|razor|tampon|minora/i, 'Personal Care'],
  [/insecticide|mosquito|disinfectant|snuggle|paper towel|napkin|\brolls?\b|candles?|foam cup|foam pac|party world|straws|\bcups?\b|container|termopac|termo|envases/i, 'Household & Cleaning'],
  [/water|fanta|coca.?cola|sprite|\bsolo\b|cream soda|minute maid|welch'?s|sch\w*ppes|ginger ale|tonic|ginseng up|kola champagne|malta|shandy|\bsoda\b|juice|cocktail|\bcola\b|angostura|grapefruit/i, 'Beverages'],
]
function categorize(name) {
  for (const [re, cat] of RULES) if (re.test(name)) return cat
  return 'REVIEW (no rule)'
}

;(async () => {
  const cats = (await dv('GET', 'sol_categorieses?$select=sol_categoriesid,sol_name&$filter=statecode eq 0')).value
  const byName = {}; cats.forEach((c) => { byName[c.sol_name] = c.sol_categoriesid })
  const prods = (await dv('GET', 'sol_productses?$select=sol_productsid,sol_name&$filter=statecode eq 0 and sol_isactive eq true and _sol_categoryid_value eq null&$top=500')).value

  const groups = {}
  for (const p of prods) {
    const cat = categorize(p.sol_name)
    ;(groups[cat] = groups[cat] || []).push(p)
  }

  for (const [cat, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${cat} (${list.length}):`)
    list.forEach((p) => console.log('  - ' + p.sol_name))
    if (APPLY && byName[cat]) {
      for (const p of list) await dv('PATCH', `sol_productses(${p.sol_productsid})`, { 'sol_CategoryID@odata.bind': `/sol_categorieses(${byName[cat]})` })
    }
  }
  const review = Object.entries(groups).filter(([c]) => c.startsWith('REVIEW')).reduce((n, [, l]) => n + l.length, 0)
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'} — ${prods.length} new products, ${review} need review/decision.`)
  if (!APPLY) console.log('Re-run with --apply to write the non-REVIEW assignments.')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
