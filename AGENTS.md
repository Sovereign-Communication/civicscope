# AGENTS.md

Canonical working rules for coding agents on CivicScope.

Read this before changing anything. It is short on purpose — a long file of rules
is a file nobody follows. Where a rule exists because something here was measured
rather than believed, the measurement is stated, so the rule can be retired when
it stops being true.

The project's own position, from `GOVERNANCE.md`: claims here are enforced in code
rather than promised. A rule that is not checkable is not a rule, so most of what
follows is also a completion-gate check.

---

## 1. No weird characters

**Do not put emoji in shipped source.** `docs/` is exempt — planning documents are
agent-facing notes, and a checkmark in a status line there harms nobody.

Not a style preference. A screen reader announces `✅` as "white heavy check mark"
before it gets to the sentence, and this project treats WCAG 2.2 AA as a legal
requirement (ADA Title III), not a goal.

**Not emoji, and left alone:** `▲ ▼ ↕` (the sort indicators in
`src/ui/SweepTable.tsx`), arrows, and typographic characters like `± × § — ≥`.
`▲`/`▼`/`↕` are `aria-hidden` and paired with `aria-sort` on the header cell —
they are the only *visual* sort state a sighted reader gets. Do not delete them to
satisfy this rule.

**No mojibake and no byte-order marks, anywhere — including `docs/`.** On
2026-10-07 the maintainer found a broken middle dot on the live site: edits had
round-tripped source through a shell that decoded UTF-8 as Windows-1252, turning
every `·`, `—` and `±` in the affected files into two or three characters of
garbage, so the sort arrow drew as box-drawing noise where `▲` belongs. The same
round-trips left byte-order marks on eight files. Neither is emoji, so the emoji
check below saw nothing.

**The trap, so you can avoid it:** doing
`Get-Content -Raw | -replace ... | Set-Content -Encoding UTF8` in PowerShell 5.1
decodes UTF-8 as the local codepage and writes a BOM. Use the editor tools for
edits, or a Node script (`readFileSync(f, 'utf8')`) if a script is genuinely
needed — never a shell text pipeline.

**Enforced by:** `tools/completion-gate.mjs`, via `tools/emoji-scan.mjs` and
`tools/mojibake-scan.mjs`, pinned by `tests/emoji-scan.test.ts` and
`tests/mojibake-scan.test.ts`. Check your work with:

```
node tools/emoji-scan.mjs .
node tools/mojibake-scan.mjs .
```

The emoji scanner treats a pictograph as emoji only when it is actually rendered
as one — emoji presentation by default, or a following U+FE0F. That distinction is
deliberate and tested both ways; `↕️` (with the variation selector) is an emoji,
`↕` on its own is a sort indicator. The mojibake scanner is narrow in the same
spirit: it flags a UTF-8 lead byte decoded as cp1252 — `Â Ã â Å` immediately
followed by a cp1252 special — so a real `·` or `—` or a name like `Ângela` passes
- a double-encoded middle dot (a UTF-8 middle dot decoded as Windows-1252) does not. Both are pinned in both directions.

---

## 2. Traps that will silently waste your time

Each of these was verified against this tree, not inferred. None of them fail
loudly.

| Trap | What actually happens |
|---|---|
| `src/**/*.test.tsx` | **Never collected.** `vite.config.ts` includes `*.test.ts`, not `.tsx`. The file is not run, not failed, not reported. |
| Component unit tests | Impossible. Vitest `environment: 'node'`, and there is no jsdom, happy-dom or testing-library. Rendering assertions go in `src/e2e/*.e2e.ts` (Playwright). |
| `npm run test:a11y` | Does not exist. Accessibility is `npm run gate` against a served build. |
| `npm run verify` | Does not include E2E or accessibility. A green verify says nothing about either. |
| `npm run typecheck` | Writes 56 `.js` files next to every `.ts` source (`--noEmit false`), untracked and unignored. Delete them before committing. `npm run verify` does not have this problem. |
| Top-level `e2e/` | Never collected. Browser tests are `src/e2e/**/*.e2e.ts`. |
| `scripts/` | Does not exist. Generators live in `tools/` and are wired as npm scripts. |
| `ResolvedPlace` | Has `name` and `zip`, **not** `zcta` and `city`. See `src/core/types.ts`. |
| `selectPlace()` | Returns immediately without `zip` (`useHousingQuery.ts`). A suggestion with no ZIP is a silent no-op. |

## 3. Conventions

- **Comments explain why, and record what was measured.** The house style is a
  comment naming the measurement and the defect it prevents. A comment restating
  the code is noise.
- **Never let a placeholder reach a user.** Census missing-value encodings
  (`-666666666` and friends) must parse to null and render as a labelled absence.
  `npm run gate` checks this.
- **`docs/jev-roadmap.md` is the single source of truth for phase status.** It is
  edited only *after* the evidence exists. Never write a status row describing
  work that has not happened.
- **Do not add a phase row, or claim a UX score, without measuring it.** Several
  rows in that roadmap were closed by measuring rather than reviewing, and the
  difference is the point of the file.
