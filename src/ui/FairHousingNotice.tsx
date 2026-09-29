/**
 * Fair Housing notice.
 *
 * The Fair Housing Act makes *under*-disclosure a violation as well as
 * over-disclosure: 24 CFR 100.70(c)(2) reaches "failing to inform any person
 * of desirable features" of a community. So this notice is not a disclaimer
 * bolted on to cover us — completeness of the disclosure is itself the
 * mitigation, and hiding a data category is a worse posture than showing it
 * neutrally.
 *
 * The complaint links are deliberate and load-bearing. The single most useful
 * thing a displaced user can be given is a route to a housing provider or an
 * enforcement agency rather than another list of neighborhoods.
 */
export function FairHousingNotice() {
  return (
    <aside
      className="rounded-lg border border-slate-300 bg-white p-4 text-sm"
      aria-labelledby="fh-heading"
    >
      <h2 id="fh-heading" className="text-sm font-semibold text-slate-900">
        How to read this data
      </h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-700">
        <li>
          Every figure here describes a <strong>Census-defined area</strong> — a ZIP code tabulation area or
          census tract. It does not describe any individual, household, property, or its occupants.
        </li>
        <li>
          These are survey estimates with margins of error. Small areas are less reliable than large ones, and
          each figure shows its own uncertainty.
        </li>
        <li>
          We show what the data says and where it came from. We do not recommend neighborhoods, and we do not
          sell, broker, or refer listings.
        </li>
        <li>
          The Fair Housing Act prohibits steering and discrimination in housing. It is illegal to restrict
          anyone&rsquo;s choices in seeking housing because of race, colour, religion, sex, disability, familial
          status, or national origin.
        </li>
      </ul>
      <p className="mt-3 text-slate-700">
        If you believe you have experienced housing discrimination, you can file a complaint:
      </p>
      <ul className="mt-1 space-y-0.5 text-sm">
        <li>
          <a
            href="https://www.hud.gov/helping-americans/complaint-form"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-blue-800 underline hover:text-blue-950"
          >
            U.S. Department of Housing and Urban Development
          </a>
        </li>
        <li>
          <a
            href="https://www.justice.gov/crt/housing-and-civil-enforcement-section"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-blue-800 underline hover:text-blue-950"
          >
            U.S. Department of Justice, Civil Rights Division
          </a>
        </li>
        <li>
          <a
            href="https://www.nafcponline.org/about-us/housing-discrimination-complaints/"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-blue-800 underline hover:text-blue-950"
          >
            National Fair Housing Alliance
          </a>
        </li>
      </ul>
    </aside>
  )
}

/** A compact variant for pages that display only a narrow set of metrics. */
export function AreaScopeNotice({ source, vintage, geography }: { source: string; vintage: string; geography: string }) {
  return (
    <p className="text-xs italic text-slate-500">
      {geography} figures from {source}, {vintage} vintage. This describes an area, not any person or
      household, and is not a recommendation.
    </p>
  )
}
