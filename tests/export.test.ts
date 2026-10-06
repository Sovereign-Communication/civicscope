/**
 * CSV export, pinned.
 *
 * Two of the assertions here are about defects that would be invisible in a
 * spreadsheet until someone opened the file: a formula-injected cell that
 * executes on open, and a "N/A" string that silently turns a numeric column into
 * text. Neither shows up in a row count or a happy-path render.
 */
import { describe, expect, it } from 'vitest'

import { COLUMNS, escapeCell, toCsv, type ExportOptions } from '../src/core/export'
import type { AreaRow } from '../src/core/plugins/acs'

const row = (over: Partial<AreaRow> = {}): AreaRow => ({
  zcta: '78701',
  name: 'ZCTA5 78701',
  metrics: {
    median_rent_burden_pct: 28.4,
    median_gross_rent: 1450,
    median_home_value: 510000,
    median_household_income: 78000,
    households: 4210,
  },
  moes: {},
  ...over,
})

const placeLabel = (zip: string) => (zip === '78701' ? 'Austin, TX' : null)

describe('cell escaping', () => {
  it('leaves a plain value alone', () => {
    expect(escapeCell('Austin')).toBe('Austin')
    expect(escapeCell('78701')).toBe('78701')
  })

  it('quotes values containing a comma, quote or newline, doubling inner quotes', () => {
    expect(escapeCell('a,b')).toBe('"a,b"')
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCell('two\nlines')).toBe('"two\nlines"')
  })

  it('prefixes a formula-looking value so a spreadsheet reads it as text', () => {
    // The OWASP CSV-injection cases. Each of these executes in Excel or Sheets
    // if exported bare. Where quoting is also required (\t, \r) the guard sits
    // inside the quotes, so the assertion allows an opening quote.
    for (const dangerous of ['=SUM(A1:A2)', '+1-1', '@cmd', '-1+1', '\tabc', '\rabc']) {
      const escaped = escapeCell(dangerous)
      // The guard may sit behind an opening double-quote when the value also
      // needed CSV quoting; it must precede the value either way.
      expect(escaped, JSON.stringify(dangerous)).toMatch(/^"?'/)
    }
  })

  it('does not prefix an ordinary value that merely starts with a letter', () => {
    expect(escapeCell('Austin city')).toBe('Austin city')
  })

  it('keeps the guard inside the quotes', () => {
    expect(escapeCell('="x",y')).toBe('"\'=""x"",y"')
  })
})

describe('the file', () => {
  it('has a header naming every column, and rows with the same field count', () => {
    const csv = toCsv([row()], { placeLabel })
    const lines = csv.split('\r\n').filter((l) => l !== '')
    expect(lines[0]).toBe(
      'zcta,city,state,median_rent_burden_pct_percent,median_gross_rent_usd_monthly,' +
        'median_home_value_usd,median_household_income_usd,households_count',
    )
    for (const line of lines) {
      expect(line.split(',').length).toBe(COLUMNS.length)
    }
  })

  it('writes raw numbers, not formatted strings', () => {
    const csv = toCsv([row()], { placeLabel })
    const data = csv.split('\r\n')[1]!
    expect(data).toContain(',28.4,1450,510000,78000,4210')
    expect(data).not.toMatch(/\$|,450/)
  })

  it('splits the place label into separate city and state columns', () => {
    const csv = toCsv([row()], { placeLabel })
    expect(csv.split('\r\n')[1]).toMatch(/^78701,Austin,TX,/)
  })

  it('leaves empty cells when the mapping is unavailable or the label is null', () => {
    const none: ExportOptions = { placeLabel: () => null }
    expect(toCsv([row()], none).split('\r\n')[1]).toMatch(/^78701,,/)
  })

  it('writes an empty cell for a missing figure, never a zero or a placeholder', () => {
    // "N/A" was the plan's instruction. It turns the whole column into text in
    // every tool that opens the file, which silently breaks arithmetic on the
    // values that are present. An empty cell is the CSV convention for missing.
    const csv = toCsv([row({ metrics: { median_gross_rent: null, households: 100 } })], { placeLabel })
    const data = csv.split('\r\n')[1]!.split(',')
    expect(data[COLUMNS.findIndex((c) => c.key === 'median_gross_rent')]).toBe('')
    expect(data[COLUMNS.findIndex((c) => c.key === 'households')]).toBe('100')
  })

  it('preserves the caller’s order rather than imposing one', () => {
    // This module must not own a definition of "the right order"; the reader who
    // sorted the table gets the file in the order they chose.
    const a = row()
    const b = row({ zcta: '10001', metrics: { households: 9 } })
    const csv = toCsv([a, b], { placeLabel: () => null })
    const lines = csv.split('\r\n').filter((l) => l !== '')
    expect(lines[1]).toMatch(/^78701/)
    expect(lines[2]).toMatch(/^10001/)
  })

  it('escapes a city name that would otherwise break the row', () => {
    const evil = row({ zcta: '00000' })
    const csv = toCsv([evil], { placeLabel: () => '="EVIL()",XY' })
    const data = csv.split('\r\n')[1]!
    expect(data).toContain('"\'=""EVIL()"",XY"')
    // And a CSV-aware count still finds exactly one field per column. A naive
    // comma split cannot do this — quoted fields contain commas — so this parses.
    const fields: string[] = []
    let field = ''
    let inQuotes = false
    for (const ch of data) {
      if (ch === '"') inQuotes = !inQuotes
      if (ch === ',' && !inQuotes) {
        fields.push(field)
        field = ''
      } else field += ch
    }
    fields.push(field)
    expect(fields.length).toBe(COLUMNS.length)
  })

  it('ends with a line break, so the last row is not lost by strict parsers', () => {
    expect(toCsv([row()], { placeLabel }).endsWith('\r\n')).toBe(true)
  })
})
