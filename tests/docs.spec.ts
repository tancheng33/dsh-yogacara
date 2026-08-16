import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — the generator is plain ESM with no declarations of its own.
import { APPRAISAL_DOC, renderAppraisalDoc } from '../scripts/generate-appraisal-doc.mjs'
import { DEFENSIVE_GRIP, GATE_RULES, SEED_ENTRENCHED, STREAK_CONCEIT } from '../src/citta.ts'
import { caitasika } from '../src/caitasika.ts'
import type { CaitasikaId, SenseGate } from '../src/types.ts'

const doc = (): string => readFileSync(APPRAISAL_DOC as string, 'utf8')

describe('the appraisal document', () => {
  it('is current — regenerate it with `pnpm docs` after changing the rules', () => {
    expect(doc()).toBe(renderAppraisalDoc())
  })

  it('states every gate rule the code actually applies', () => {
    const text = doc()
    for (const [gate, outcomes] of Object.entries(GATE_RULES) as [SenseGate, Record<'favorable' | 'adverse', Partial<Record<CaitasikaId, number>>>][]) {
      expect(text, `no row for ${gate}`).toContain(`\`${gate}\``)
      for (const weights of Object.values(outcomes)) {
        for (const [id, weight] of Object.entries(weights) as [CaitasikaId, number][]) {
          const term = caitasika(id)
          expect(text, `${gate} stirs ${id}, undocumented`)
            .toContain(`${term?.chinese ?? id} ${id} ${weight}`)
        }
      }
    }
  })

  it('states the thresholds with the values the code uses', () => {
    const text = doc()
    expect(text).toContain(`| \`STREAK_CONCEIT\` | ${STREAK_CONCEIT} |`)
    expect(text).toContain(`| \`SEED_ENTRENCHED\` | ${SEED_ENTRENCHED} |`)
    expect(text).toContain(`| \`DEFENSIVE_GRIP\` | ${DEFENSIVE_GRIP} |`)
  })

  it('keeps saying that the numbers are this project\'s and not doctrine', () => {
    expect(doc()).toMatch(/heuristics chosen by\nthis project, not doctrine/)
  })
})
