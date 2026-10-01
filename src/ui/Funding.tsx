/**
 * Funding disclosure and donations.
 *
 * The brief asked for a free tool that accepts donations, and there was no way
 * to do so at all — the completion gate flagged it, correctly.
 *
 * Donations route through Open Collective rather than a personal account. That
 * choice is what makes "not yours" mean something: funds sit with a collective,
 * the balance is public, and if the project is abandoned the money stays with
 * the collective instead of becoming someone's property. No incorporation is
 * required, which was a constraint.
 *
 * The URL is configurable because the collective is not set up yet. Until it
 * exists, the section says so plainly rather than showing a dead link.
 */

const COLLECTIVE_SLUG = import.meta.env?.VITE_COLLECTIVE_SLUG ?? ''

export const FUNDING = {
  /** Set to the Open Collective slug once the collective exists. */
  collectiveSlug: COLLECTIVE_SLUG,
  get url(): string {
    return COLLECTIVE_SLUG ? `https://opencollective.com/${COLLECTIVE_SLUG}` : ''
  },
  get isLive(): boolean {
    return COLLECTIVE_SLUG.length > 0
  },
} as const

export function FundingSection() {
  return (
    <section aria-labelledby="funding-heading" className="mt-6 panel panel-padded">
      <h2 id="funding-heading" className="text-sm font-semibold text-slate-900">
        This tool is free, and stays free
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        CivicScope carries no advertising, sells no listings, and takes no payment for placement in any result.
        It runs on free hosting and free government data, so there is nothing for a sponsor to buy.
      </p>
      <p className="section-note mt-2">
        If it is useful to you and you would like to help cover hosting costs, you can contribute through
        Open Collective. That is a public collective with a visible balance — not a personal account — so the
        money does not belong to any individual and is auditable by anyone.
      </p>
      {FUNDING.isLive ? (
        <p className="mt-3">
          <a
            href={FUNDING.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            Support CivicScope
          </a>
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          A donation link is not open yet. Nothing on this site is behind a paywall and nothing is sold, so
          there is no functionality you are missing while it is unavailable.
        </p>
      )}
    </section>
  )
}
