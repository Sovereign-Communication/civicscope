const KEY = process.env.CENSUS_KEY
const V = "NAME,B25064_001E,B25077_001E,B19013_001E,B25001_001E,B25003_003E,B01003_001E"
const r = await fetch("https://api.census.gov/data/2023/acs/acs5?get=" + V +
  "&for=" + encodeURIComponent("zip code tabulation area:20771") + "&key=" + KEY)
const j = await r.json()
console.log("header:", j[0].join(","))
console.log("row   :", j[1] ? j[1].join(",") : "(no data row at all)")
