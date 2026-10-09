# Change and incident record

`docs/governance.md` commits the project to publishing a history, so that
"verified" has a record rather than being a claim about the current state only.
This is that record. One entry per change that altered what a reader sees, what
a claim relied on, or what the gate enforces — with the finding that prompted it,
because the findings are the part a future maintainer cannot reconstruct from a
diff.

Ordered newest first. Commit hashes are the squash merges on `main`.

## 2026-10-08

**`2735a83` — Share exactly what you see: the comparison travels in the URL (#22).**
`?z=` carries the selected ZIP codes and nothing else — no sort, no preset —
because a link that encoded how to look at data would be a recommendation, not a
view. Hand-edited parameters are validated on arrival; malformed entries are
dropped silently. `history.replaceState`, so adding an area adds no back-button
entry.

**`d2820da` — Retry the SEO generator's TIGERweb pages (#23).**
A push-to-main run failed six gate checks; five were cascade from one dropped
TIGERweb connection in `gen-seo.mjs`. The map generator had retried that exact
documented failure mode since it was written; the SEO generator had not.

## 2026-10-07

**`ea7a11d` — Repair the mojibake I shipped, and prompt a first-time visitor for a key (#21).**
Two maintainer reports, both real. First: a broken middle dot on the live site —
my own edits had round-tripped source through a shell decoding UTF-8 as
Windows-1252; the emoji scanner could not see it, because mojibake is not emoji. Repaired by reversing the
double-encoding; `tools/mojibake-scan.mjs` now catches it in both directions, and
`AGENTS.md` documents the pipeline that caused it. Second: the site never asked a
new visitor for an API key — the mount effect only ran the load with a key already
present, so every `needs-key` branch was unreachable. The load now runs on arrival
and the prompt opens once, without stealing focus.

**`f911a1e` — Record the maintainer's stewardship decisions (#18).**
GitHub is where the project lives; personal payment routes are the chosen design.
Both were listed as open weaknesses; the maintainer reviewed and accepted both,
and the record now says decided rather than pending.

**`b249a52` — Fail the gate when production serves an older build than main (#20).**
The maintainer reported the site "regressed: no data, map not loading." Production
was serving a build from before ten merged PRs, and the gate reported it fresh:
the freshness layer checked for markers fixed in history, which a very old build
still contains. On push-to-main, the deployed bundle must now equal the bundle CI
just built. That day it failed in CI as designed, a deploy made it green, and a
docs-only merge after it passed without a deploy because its hash was unchanged —
the check demanding a deploy exactly when one is needed.

**`2425567` — An unreachable upstream is not a place with no district (#19).**
Three live-contract failures on a single NCES blip, each reading
`expected 'not-found' to be 'district'` — indistinguishable from drift. The
plugin folded every upstream error into `not-found`, for users and for the retry
wrapper, which had nothing to catch. `unavailable` is now its own kind, retried
in tests, and surfaced as a source failure rather than an absence.

## 2026-10-06

**`e09cd4d` — Similar-ZIP search: off by default, reader-weighted, alphabetical (#17, Phase 2B).**
Approved without legal review, by maintainer decision: the mitigation is the
default. A similarity result is a ranking, so it exists only when asked for;
weights are the reader's, drawn from the sortable allowlist so no
protected-class measure can be weighted; results are alphabetical with the
distance shown. The plan's 0.5-1 MB baked payload was dropped — the sweep is
already in memory, so the feature added zero bytes.

**`325561f` — Score the product, not its URL (#16).**
The original request asks for "a selected domain", and the selected domain is the
deployment address. The Jev layer's persistent `domain` flag (0.45, top unmet
requirement) was the repo's own evidence describing a met requirement as open.
Corrected in three places; the flag collapsed to 0.01. Nothing was claimed beyond
what is true.

**`a340507` — Let a reader keep the data: CSV export (#14).**
Raw numbers, not formatted strings; empty cells for missing figures, not "N/A"
(which would force the column to text in every tool); OWASP formula-injection
guarding, pinned by test — the kind of defence that gets removed as "unnecessary
quoting" by someone who never saw the attack.

**`ebd5f6a` — Figure filters, and school/health can never be filtered on (#15, closes #5).**
Rent, burden, home value, households — drawn from the same allowlist as the sort
columns, so a demographic filter is a compile error. Rows with no figure for an
active bound are excluded, visibly, because a bound is a question and an area
with no figure is not an answer to it.

**`66e37ef` — Make the protected-class rule mechanical (#13, closes #11).**
`types.ts` called it "the single most important rule in the codebase" while no
plugin set the flag and nothing read it — the guarantee held only because nobody
had wired a demographic metric into a column list yet. Now: the executor stamps
it centrally, CDC PLACES health measures carry it, the composite scorer refuses
it, and sort columns and filters are typed against one allowlist.

## 2026-10-04

**`8786052` — Wire the donation route, drop a false attorney claim, enforce no emoji (#10).**
Three claims that did not match reality. The funding section was built around a
collective slug that was never set — wired to the author's three direct routes,
with the weaker guarantee (funds reach an individual; the balance is not public)
disclosed on the page rather than glossed. `GOVERNANCE.md` claimed a fair-housing
attorney had reviewed the scoring modules; no attorney ever had, so the sentence
was deleted, not softened. And a checkmark in a status line is announced by a
screen reader as "white heavy check mark" before the sentence — the no-emoji rule,
now a scanner and a gate check.

**`b945d1c` — Phase 0: city search, and every ZIP code named with the place it is in (#12).**
Baked from the Census relationship files; a search contacts nothing off-origin.
Three data defects found by reading the publisher's files rather than the code:
`AREALAND_PART` is column 16, not 17 (17 is water, and measuring it implied
4,084 ambiguous ZIPs where the true count is zero); legal-type stripping is
case-sensitive (`Salt Lake City city`); and there are places genuinely named after
counties. A modal on first visit covered the search box — found by the browser
suite failing 22 tests, redesigned to a non-modal notice.

**`99624e7` — First-run orientation (#7, Phase 1).**
The plan's sample-data component was rejected by maintainer decision: the
platform ships no data, the visitor's key unlocks it. The tour states the limit
rather than hiding it. A focus-trap test failed on a WCAG rule that does not
exist — Tab passes through `<body>` at the wrap boundary; the test now asserts the
property that matters.

## Standing position

No attorney has reviewed this project and none is planned; `GOVERNANCE.md` says
so. Deployments are manual (`npm run deploy`), and the gate fails push-to-main CI
until one runs — the alarm that caught the ten-merge drift. The deterministic gate
is the completion contract: `npm run gate`, currently **89/89**.
