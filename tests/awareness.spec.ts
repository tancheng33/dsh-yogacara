import { describe, expect, it } from 'vitest'
import { impulseOf, IMPULSES, CAITASIKAS } from '../src/caitasika.ts'
import { congruence, freshMind, manifest, MOOD_CONGRUENCE } from '../src/citta.ts'
import { feltLines, FELT_GUIDANCE, renderFeltState } from '../src/prompt.ts'
import type { CittaState, Config, Manifestation, SelfReportInput, Seed } from '../src/index.ts'
import { boot } from './helpers/harness.ts'

const T0 = 1_700_000_000_000

/**
 * Build a render input.
 * @param overrides - Fields to replace.
 * @returns the input.
 */
function input(overrides: Partial<SelfReportInput> = {}): SelfReportInput {
  return {
    citta: freshMind(T0),
    manifestations: [],
    turnings: [],
    maxFactors: 5,
    manasWarning: 0.5,
    turningMaxAgeMs: 1_800_000,
    now: T0,
    ...overrides,
  }
}

const restless: CittaState = {
  ...freshMind(T0),
  factors: { auddhatya: 0.7, kausidya: 0.5, sparsa: 0.9 },
  feeling: { id: 'daurmanasya', valence: -0.5, arousal: 0.7 },
}

describe('the state as inclination', () => {
  it('says what the agent wants to do, not what it scores', () => {
    const lines = feltLines(input({ citta: restless }))
    expect(lines[0]).toBe(IMPULSES.auddhatya)
    expect(lines.join('\n')).not.toMatch(/\d/)
    expect(lines.join('\n')).not.toMatch(/掉举|auddhatya|restlessness/)
  })

  it('never names a factor, a number, or a diagnosis anywhere in its vocabulary', () => {
    for (const [id, impulse] of Object.entries(IMPULSES)) {
      expect(impulse, `${id} leaks a digit`).not.toMatch(/\d/)
      expect(impulse, `${id} names itself`).not.toMatch(new RegExp(id, 'i'))
      // The property that matters is that it addresses the agent as its own
      // leaning, not that it opens with any particular word.
      expect(impulse, `${id} is not addressed to the agent`).toMatch(/\byou(r|rself)?\b/i)
      expect(impulse, `${id} reads as a report about a state`)
        .not.toMatch(/\b(level|score|activation|affliction|mental factor)\b/i)
    }
  })

  it('skips the universal factors, which lean in no direction', () => {
    for (const term of CAITASIKAS.filter(one => one.category === 'universal')) {
      expect(impulseOf(term.id), `${term.id} should have no inclination`).toBeUndefined()
    }
    // Every other factor has one, so a dominant factor is never silent.
    for (const term of CAITASIKAS.filter(one => one.category !== 'universal')) {
      expect(impulseOf(term.id), `${term.id} has no inclination`).toBeDefined()
    }
  })

  it('carries at most two leanings, so it reads as a leaning and not a list', () => {
    expect(feltLines(input({ citta: restless })).length).toBeLessThanOrEqual(3)
  })

  it('speaks a remembered lesson in the agent\'s own voice', () => {
    const seed: Seed = {
      situation: 'chat:asked-again', potency: 0.8, count: 3, valence: -0.4, gate: 'ear',
      factors: [], lesson: 'say the answer first, then the reasoning',
      firstAt: T0 - 10_000, lastAt: T0 - 1_000,
    }
    const manifested: Manifestation = { seed, current: 0.8, via: 'exact' }
    const lines = feltLines(input({ citta: restless, manifestations: [manifested] }))
    expect(lines.at(-1)).toContain('say the answer first')
    expect(lines.at(-1)).toMatch(/^You have been here before/)
  })

  it('renders nothing when nothing is leaning', () => {
    expect(renderFeltState(input())).toBe('')
  })

  it('keeps its standing instruction short and free of self-description', () => {
    expect(FELT_GUIDANCE.length).toBeLessThan(400)
    expect(FELT_GUIDANCE).not.toMatch(/model|computed|state|factor/i)
    expect(FELT_GUIDANCE).toContain('not something to mention')
  })
})

describe('mood-congruent recall', () => {
  const good: Seed = {
    situation: 'chat:warmth', potency: 0.6, count: 4, valence: 0.7, gate: 'ear',
    factors: [], firstAt: T0 - 10_000, lastAt: T0 - 1_000,
  }
  const bad: Seed = {
    situation: 'chat:rebuke', potency: 0.6, count: 4, valence: -0.7, gate: 'ear',
    factors: [], firstAt: T0 - 10_000, lastAt: T0 - 1_000,
  }
  const seeds = new Map([[good.situation, good], [bad.situation, bad]])

  it('brings the bad times to mind more readily when things feel bad', () => {
    const found = manifest(seeds, 'chat:x', T0, 2, undefined, -0.8)
    expect(found[0]!.seed.situation).toBe('chat:rebuke')
  })

  it('and the good times when they feel good', () => {
    const found = manifest(seeds, 'chat:x', T0, 2, undefined, 0.8)
    expect(found[0]!.seed.situation).toBe('chat:warmth')
  })

  it('plays no favourites in an even mood', () => {
    const neutral = manifest(seeds, 'chat:x', T0, 2, undefined, 0)
    expect(neutral[0]!.current).toBeCloseTo(neutral[1]!.current, 6)
  })

  it('colours recall without ever silencing a strong precedent', () => {
    expect(congruence(-1, 1)).toBeCloseTo(1 - MOOD_CONGRUENCE / 2, 6)
    expect(congruence(1, 1)).toBeCloseTo(1 + MOOD_CONGRUENCE / 2, 6)
    expect(congruence(0, -1)).toBe(1)
    // A congruent weak seed must not outrank a far stronger incongruent one.
    const strong: Seed = { ...good, potency: 1 }
    const weak: Seed = { ...bad, potency: 0.3 }
    const found = manifest(new Map([[strong.situation, strong], [weak.situation, weak]]),
      'chat:x', T0, 2, undefined, -0.9)
    expect(found[0]!.seed.situation).toBe('chat:warmth')
  })
})

describe('what a mind actually notices', () => {
  const standing: CittaState = {
    ...freshMind(T0),
    // 惭 has been loud for a while; 疑 has not.
    factors: { hri: 0.85, vicikitsa: 0.05 },
    feeling: { id: 'daurmanasya', valence: -0.4, arousal: 0.5 },
  }

  it('leads with what just moved, not with the loudest standing factor', () => {
    const lines = feltLines(input({
      citta: standing,
      stirred: { vicikitsa: 0.4 },
    }))
    expect(lines[0]).toBe(IMPULSES.vicikitsa)
  })

  it('discounts a factor that was already saturated when it was stirred again', () => {
    // 惭 is stirred harder in absolute terms, but it has nothing new to say.
    const lines = feltLines(input({
      citta: standing,
      stirred: { hri: 0.5, vicikitsa: 0.3 },
    }))
    expect(lines[0]).toBe(IMPULSES.vicikitsa)
  })

  it('still speaks a strongly stirred factor that was genuinely quiet', () => {
    const lines = feltLines(input({
      citta: { ...standing, factors: { hri: 0.1 } },
      stirred: { hri: 0.5, vicikitsa: 0.2 },
    }))
    expect(lines[0]).toBe(IMPULSES.hri)
  })

  it('falls back to standing activation on a turn that stirred nothing', () => {
    const lines = feltLines(input({ citta: standing }))
    expect(lines[0]).toBe(IMPULSES.hri)
  })
})

describe('stopping to look', () => {
  /**
   * Receive one contact hard enough to leave the mind unmistakably stirred.
   * @param config - Config overrides for the booted plugin.
   * @returns the booted context and its tools.
   */
  async function stirred(config: Partial<Config> = {}) {
    const booted = await boot(config)
    await booted.ctx.citta.receive({
      gate: 'body', situation: 'bash:migrate', outcome: 'adverse', intensity: 0.9, at: Date.now(),
    })
    return booted
  }

  /**
   * The text `self_reflect` puts in front of the model.
   * @param tools - The booted tool registry.
   * @returns the rendered text.
   */
  async function reflected(tools: Awaited<ReturnType<typeof boot>>['tools']) {
    const tool = tools.get('self_reflect')
    const value = await (tool.execute as (a: unknown, e: unknown) => Promise<unknown>)(
      { situation: 'bash:migrate' }, {})
    const content = (tool.output.render as (a: unknown, v: unknown) => { text: string }[])(
      { situation: 'bash:migrate' }, value)
    return { text: content.map(part => part.text).join('\n'), value: value as { factors: unknown[] } }
  }

  it('finds a leaning rather than a gauge, for an agent that lives in felt', async () => {
    const { tools } = await stirred()
    const { text } = await reflected(tools)
    expect(text).not.toBe('')
    // The failure this locks out: the agent asks how it is, gets `掉举 0.62 ⚠`,
    // and spends its answer talking about the number.
    expect(text).not.toMatch(/\d/)
    expect(text).not.toMatch(/心所|末那|受 |valence|intensity|activation|⚠/)
  })

  it('keeps every reading in the structured result, for whoever is tuning it', async () => {
    const { tools } = await stirred()
    const { value } = await reflected(tools)
    expect(value.factors.length).toBeGreaterThan(0)
  })

  it('still hands back the whole instrument panel in report mode', async () => {
    const { tools } = await stirred({ awareness: 'report' })
    const { text } = await reflected(tools)
    expect(text).toMatch(/心所/)
    expect(text).toMatch(/\d/)
  })

  it('lets an agent that stopped to look see further than the ambient section', async () => {
    const { ctx } = await stirred()
    expect(ctx.citta.introspectLines().length)
      .toBeGreaterThanOrEqual(feltLines(input({ citta: ctx.citta.state() })).length)
  })
})
