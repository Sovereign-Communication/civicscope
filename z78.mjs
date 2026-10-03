const KEY = process.env.CENSUS_KEY
const V = "NAME,B25064_001E,B25077_001E,B19013_001E,B25001_001E,B25003_003E,B01003_001E"
const q = (label, geo) => fetch(
  "https://api.census.gov/data/2023/acs/acs5?get=" + V + "&for=" + encodeURIComponent(geo) + "&key=" + KEY
).then(async r => { const t = await r.text(); console.log(label, "HTTP", r.status, t.slice(0,240)) })
await q("20771 plain:      ", "zip code tabulation area:20771")
await q("20771 w/ state:   ", "zip code tabulation area:20771&in=state:23")
await q("20771 + 20692:    ", "zip code tabulation area:20771,20692")
