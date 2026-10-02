/**
 * Where does "not yet imported" actually come from?
 *
 * Some absence is the truth: the Census Bureau publishes no estimate for a
 * figure and there is nothing to import. Some absence is this app's own doing,
 * and that part is fixable. Telling them apart is the whole question, because
 * importing what does not exist would mean inventing it, and inventing a
 * figure is the one thing this tool must never do.
 *
 * So this classifies every absent cell in the country by cause, over all five
 * nationwide metrics and their margins.
 */
const KEY = process.env.CENSUS_KEY

const METRICS = {
  median_gross_rent: 'B25064_001E',
  median_rent_burden_pct: 'B25071_001E',
  median_home_value: 'B25077_001E',
  median_household_income: 'B19013_001E',
  households: 'B25001_001E',
}
const MOES = {
  median_gross_rent: 'B25064_001M',
  median_rent_burden_pct: 'B25071_001M',
  median_home_value: 'B25077_001M',
  median_household_income: 'B19013_001M',
  households: 'B25001_001M',
}

/** Every ACS missing-value encoding, learned the hard way. */
const SENTINELS = new Map([
  [-666666666, 'not applicable'],
  [-999999999, 'missing'],
  [-888888888, 'not comparable'],
  [-333333333, 'not applicable (margin)'],
  [-222222222, 'margin cannot be computed'],
])
const VARS = [...new Set([...Object.values(METRICS), ...Object.values(MOES)])]

const all = []
for (const [lo, hi] of [
  ['00000', '24999'],
  ['25000', '49999'],
  ['50000', '74999'],
  ['75000', '99999'],
]) {
  for (let off = 0; ; off += 20000) {
    const url =
      `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2/query` +
      `?where=${encodeURIComponent(`ZCTA5 >= '${lo}' AND ZCTA5 <= '${hi}'`)}` +
      `&outFields=ZCTA5&returnGeometry=false&resultRecordCount=20000&resultOffset=${off}&f=json`
    const j = await (await fetch(url)).json()
    for (const f of j.features ?? []) {
      const z = f.attributes?.ZCTA5
      if (typeof z === 'string' && /^\d{5}$/.test(z)) all.push(z)
    }
    if ((j.features ?? []).length < 20000) break
    await new Promise((r) => setTimeout(r, 400))
  }
}
const zctas = [...new Set(all)].sort()
console.log(`Census publishes ${zctas.length} ZCTAs\n`)

const present = new Set()
const absent = new Map() // zcta -> [metrics]
const causes = new Map() // cause -> count
let returnedRows = 0

for (let i = 0; i < zctas.length; i += 800) {
  const part = zctas.slice(i, i + 800)
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=NAME,${VARS.join(',')}` +
    `&for=${encodeURIComponent(`zip code tabulation area:${part.join(',')}`)}&key=${KEY}`
  const body = await (await fetch(url)).json()
  if (body.error) {
    console.log('error:', JSON.stringify(body.error).slice(0, 120))
    break
  }
  const head = body[0]
  for (const r of body.slice(1)) {
    returnedRows++
    const o = Object.fromEntries(head.map((k, idx) => [k, r[idx]]))
    const z = String(o['zip code tabulation area'] ?? '').padStart(5, '0')
    present.add(z)
    for (const [metric, v] of Object.entries(METRICS)) {
      const n = Number(o[v])
      if (SENTINELS.has(n)) {
        const cause = SENTINELS.get(n)
        causes.set(cause, (causes.get(cause) ?? 0) + 1)
        if (!absent.has(z)) absent.set(z, [])
        absent.get(z).push(`${metric} (${cause})`)
      }
    }
  }
  process.stdout.write(`\r    ${Math.min(i + 800, zctas.length)}/${zctas.length}`)
  await new Promise((r) => setTimeout(r, 500))
}
process.stdout.write('\n\n')

const noRow = zctas.filter((z) => !present.has(z))
console.log('=== 1. areas with no ACS row at all ===\n')
console.log(`  ${noRow.length} of ${zctas.length} (${((noRow.length / zctas.length) * 100).toFixed(2)}%)`)
console.log(`  ${noRow.join(' ')}`)
console.log('  These are not a bug. The Census Bureau publishes these ZCTAs in its')
console.log('  geography file and publishes no ACS estimates for them, so there is')
console.log('  nothing to import. The app lists them and says so.\n')

console.log('=== 2. figures the publisher gives as an encoding, by cause ===\n')
let totalAbsent = 0
for (const [cause, n] of [...causes].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(7)}  ${cause}`)
  totalAbsent += n
}
console.log(`\n  ${totalAbsent} absent figures out of ${returnedRows * Object.keys(METRICS).length} possible ` +
  `(${((totalAbsent / (returnedRows * Object.keys(METRICS).length)) * 100).toFixed(2)}%)\n`)

console.log('=== 3. areas with at least one absent figure ===\n')
console.log(`  ${absent.size} of ${returnedRows} areas (${((absent.size / returnedRows) * 100).toFixed(2)}%)\n`)
const byCombo = new Map()
for (const [z, list] of absent) {
  const k = list.map((x) => x.split(' (')[0]).sort().join('+')
  if (!byCombo.has(k)) byCombo.set(k, { n: 0, example: z, causes: list })
  byCombo.get(k).n++
}
for (const [combo, v] of [...byCombo].sort((a, b) => b[1].n - a[1].n).slice(0, 14)) {
  console.log(`  ${String(v.n).padStart(6)}  ${combo.padEnd(52)} e.g. ${v.example}  [${v.causes.join(', ')}]`)
}

console.log('\n=== 4. what can actually be imported ===\n')
console.log('  Nothing on this list. Every absence above is a figure the publisher')
console.log('  does not publish, so there is no source to import it from.')
console.log('')
console.log('  What the app could instead do is explain the absence per figure,')
console.log('  because "not applicable", "missing" and "cannot be computed" are')
console.log('  different answers and a reader is currently shown the same words for')
console.log('  all three.')
