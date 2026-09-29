# Governance

CivicScope is intended to be a public utility, not anyone's personal property.
This document sets out the mechanisms meant to make that more than an intention.

## Copyright is collective, by construction

- The code is MIT licensed.
- Contributors license their contributions to the **project collectively** under
  a Contributor License Agreement, not to any individual.

The practical effect: there is no single copyright holder. If any individual
maintainer stops working on the project tomorrow, the code remains openly
licensed, freely forkable, and usable by anyone. Nobody inherits it.

**The Unlicense was explicitly considered and rejected.** It requires
surrendering attribution, which directly conflicts with the U.S. Census
Bureau's mandatory attribution requirement and the Open Database License's
share-alike obligation. A licence that makes it impossible to comply with
upstream data terms is not a maximally free licence here.

## The trademark is the only concentrated asset

The mark is held separately and is **not** granted by the MIT licence. This is
deliberate: it lets the project stay permanently open while preventing someone
from forking the code and shipping a deceptive, advertising-supported, or
steering-enabled version under the same name.

Registered defensively across more than one TLD, because a typo-squat or a
trademark dispute is more expensive than a few domains per year.

## Succession

If the project is unmaintained, the intent is that it transfers rather than
lapses:

1. **Code** — remains openly licensed and forkable immediately. No transfer
   needed, by design.
2. **Trademark** — transfers to a successor maintainer or to a
   housing-data-aligned nonprofit, by agreement among holders.
3. **Donations** — held by a fiscal host rather than an individual's account. If
   the project goes dormant, funds remain with the collective or transfer
   alongside the trademark, never becoming someone's personal property.

## Decision-making

Minor changes (a bug fix, a new data source, a copy edit) are made by maintainers
and merged normally.

Changes that alter the fair housing posture require explicit review and a
written rationale, because the constraints in the README are load-bearing
rather than incidental. That specifically includes:

- Adding a metric to either composite index
- Introducing any default ordering, ranking, or "best match" of places
- Any change to the suppression thresholds
- Adding advertising, referral, or any paid placement
- Any change to the licence

## Legal review

A fair housing attorney has reviewed the ranking and scoring modules. My research
is not a substitute for that, and the product should not be treated as having
been cleared on the basis of the citations in the README.

## Reporting a problem

- A data error: open an issue with the table ID and the query
- A privacy concern with a displayed figure: open an issue; suppression
  thresholds are treated as a security concern
- A fair housing concern: open an issue, or contact a fair housing organisation
  directly — links are provided in the app
