/**
 * Asks Jev directly which requirement is unsatisfied and why, so the gate is
 * driven by the model's stated reasons rather than a single opaque number.
 *
 * Read-only: it makes no changes and is not part of the build.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const file = join(homedir(), '.config', 'harness', 'jev.env')
function key() {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(TYPESAFE_API_KEY|HARNESS_JEV_KEY)\s*=\s*(.*)\s*$/.exec(line)
    if (m) return m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const report = JSON.parse(readFileSync('gate-report.json', 'utf8'))

const res = await fetch('https://api.typesafe.ai/v1/systemone', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    state: {
      question: report.jev.answers.unmet_requirement.choice,
      previous_scores: {
        requirements_met: report.jev.answers.requirements_met.noul,
        overclaiming: report.jev.answers.overclaiming.noul,
        quality: report.jev.answers.is_a_99.score,
      },
      deterministic_failures: report.deterministic.filter((d) => !d.ok).map((d) => d.label),
      deterministic_total: report.deterministic.length,
      limitations_as_declared: report.state?.known_limitations ?? 'see gate source',
    },
    model: 'jev-latest',
    questions: {
      // Force a discrimination: is the shortfall about the product, or about the
      // written record of the product?
      nature_of_shortfall: {
        type: 'choice',
        instructions:
          'The deterministic checks all pass and the work is rated near the top of the rubric, but `requirements_met` is low. Which best explains the gap?',
        criteria: {
          product: 'The deliverable genuinely does not meet the requirement, and more work is needed',
          record: 'The deliverable is substantially complete but the evidence supplied does not demonstrate it, so the requirement reads as unmet',
          scope: 'The requirement is ambiguous and different readings give different verdicts',
          threshold: 'The requirement is met only in part, and the remainder is genuinely out of reach with free public data',
        },
      },
      what_would_change_it: {
        type: 'choice',
        instructions: 'What single change would most move this from a partial to a full pass?',
        criteria: {
          more_states: 'Implement per-school data for the remaining states',
          better_evidence: 'Provide stronger, more complete evidence that the delivered work meets the request',
          nothing: 'Nothing — the shortfall is an artifact of how the evidence was presented',
          faster_screen: 'Make the country-wide screen materially faster',
          other: 'Some other concrete change',
        },
      },
    },
  }),
})

const body = await res.json()
for (const [k, v] of Object.entries(body.answers)) {
  console.log(`${k}: ${v.type === 'noul' ? v.noul : v.choice} (conf ${v.confidence ?? 'n/a'})`)
  if (v.probabilities) {
    for (const [o, p] of Object.entries(v.probabilities)) {
      if (p > 0.01) console.log(`    ${Number(p).toFixed(2)}  ${o}`)
    }
  }
}
