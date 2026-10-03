# Worldwide data: plan only, no code

The product is currently United States only, and every layer reflects that:
Census ACS, TIGERweb ZIP geometry, NCES school districts. This is a plan for
what it would take to extend it, written before any of it is built, so the
shape is agreed before the work starts.

## What the app would need to stop assuming

- ZIP codes as the only geography. Canada and the UK use postal codes, most of
  the world uses nothing equivalent, and TIGERweb geometry has no non-US
  counterpart. Areas without a code would need a different address model.
- The 800-row chunk plan, which exists because the US Census API rejects long
  geography lists. Other publishers have different limits and different
  failure modes.
- A single "sweep" concept. National coverage is a Census affordance; other
  countries publish at different geographies and cadence.

## Sources worth evaluating, by licence reality

Keyless and CORS-enabled, so they work in a browser-only app:
- UK Office for National Statistics
- Statistics Canada
- Central Statistics Office of Ireland
- Statistics Netherlands (CBS)
- Most Nordic national statistical agencies
- Eurostat, subject to its rate and licence terms

Requires a registered key per user, which changes the product:
- France (INSEE), Spain (INE), Italy (ISTAT), Germany (Destatis)
- OECD and UNdata, with licence constraints that may not permit a
  redistributable static build

Not viable: most commercial property and rental platforms, whose terms do not
permit this use.

## Sequencing, if it is approved

1. A second country end to end, chosen because its data is keyless and its
   geography is well defined. Canada or Ireland are the strongest candidates:
   both publish openly, and both have stable postal geography.
2. Generalise the address model and the chunking so a country is a
   configuration rather than a fork.
3. Only then a third and fourth, by which point each is a data adapter rather
   than an architectural change.

## What this does not change

The fair-housing constraints do not become optional because the map covers more
countries. Steering law and protected-class handling are decided per
jurisdiction, and a tool that is careful in one country can be unlawful in
another. That work is not the same task as adding a data source and should not
be bundled with it.

## Decision needed

Whether to fund this at all, and if so which single country to build first.
Until that is decided no code should be written, because the address model is
the part that is expensive to get wrong.
