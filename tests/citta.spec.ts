import { describe, expect, it } from 'vitest'
import {
  afflictions,
  appraise,
  decaySeed,
  decayTo,
  dominant,
  feelingOf,
  freshMind,
  graspStrength,
  manifest,
  perfume,
  receive,
  transform,
} from '../src/citta.ts'
import { DEFAULT_TUNING } from '../src/types.ts'
import type { CittaState, Contact, MindView, Seed } from '../src/types.ts'

const T0 = 1_700_000_000_000

/**
 * Build a contact with sensible defaults.
 * @param overrides - Fields to replace.
 * @returns the contact.
 */
function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    gate: 'body',
    situation: 'bash:pytest',
    outcome: 'adverse',
    intensity: 0.6,
    at: T0,
    ...overrides,
  }
}

/**
 * Build a view over a mind and an optional seed store.
 * @param citta - The mind.
 * @param seeds - Seeds, keyed by situation.
 * @returns the view.
 */
function view(citta: CittaState, seeds: readonly Seed[] = []): MindView {
  return { citta, seeds: new Map(seeds.map(seed => [seed.situation, seed])) }
}

describe('刹那 — decay', () => {
  it('halves an activation over one half-life', () => {
    const start: CittaState = { ...freshMind(T0), factors: { pratigha: 0.8 } }
    const later = decayTo(start, T0 + DEFAULT_TUNING.halfLifeMs)
    expect(later.factors.pratigha).toBeCloseTo(0.4, 5)
  })

  it('drops a factor once it falls under the floor', () => {
    const start: CittaState = { ...freshMind(T0), factors: { krodha: 0.1 } }
    const later = decayTo(start, T0 + DEFAULT_TUNING.halfLifeMs * 4)
    expect(later.factors.krodha).toBeUndefined()
  })

  it('returns to 舍受 once arousal falls away', () => {
    const start: CittaState = {
      ...freshMind(T0),
      feeling: { id: 'daurmanasya', valence: -0.8, arousal: 0.9 },
    }
    const later = decayTo(start, T0 + DEFAULT_TUNING.halfLifeMs * 8)
    expect(later.feeling.id).toBe('upeksa')
    expect(later.feeling.valence).toBe(0)
  })

  it('relaxes self-grasping far more slowly than a mood', () => {
    const start: CittaState = {
      ...freshMind(T0),
      factors: { pratigha: 0.8 },
      manas: { atmaMoha: 0, atmaDrsti: 0, atmaMana: 0.8, atmaSneha: 0 },
    }
    const later = decayTo(start, T0 + DEFAULT_TUNING.halfLifeMs)
    expect(later.manas.atmaMana).toBeGreaterThan(later.factors.pratigha!)
  })

  it('does not move backwards in time', () => {
    const start = freshMind(T0)
    expect(decayTo(start, T0 - 1000)).toBe(start)
  })
})

describe('受 — the feeling a contact carries', () => {
  it('reads the body and one\'s own product as bodily 苦/乐', () => {
    expect(feelingOf(contact({ gate: 'body', outcome: 'adverse' })).id).toBe('duhkha')
    expect(feelingOf(contact({ gate: 'tongue', outcome: 'favorable' })).id).toBe('sukha')
  })

  it('reads looking, being told, and sensing as mental 忧/喜', () => {
    expect(feelingOf(contact({ gate: 'ear', outcome: 'adverse' })).id).toBe('daurmanasya')
    expect(feelingOf(contact({ gate: 'eye', outcome: 'favorable' })).id).toBe('saumanasya')
  })

  it('rests in 舍 for a neutral or unfelt contact', () => {
    expect(feelingOf(contact({ outcome: 'neutral' })).id).toBe('upeksa')
    expect(feelingOf(contact({ intensity: 0 })).arousal).toBe(0)
  })

  it('scales arousal by intensity and never leaves the unit interval', () => {
    const strong = feelingOf(contact({ intensity: 5 }))
    expect(strong.arousal).toBe(1)
    expect(Math.abs(strong.valence)).toBeLessThanOrEqual(1)
  })
})

describe('触 — appraisal', () => {
  it('stirs the universal factors on every contact', () => {
    const impulse = appraise(contact({ outcome: 'neutral' }), freshMind(T0))
    expect(impulse.factors.sparsa).toBeGreaterThan(0)
    expect(impulse.factors.manaskara).toBeGreaterThan(0)
  })

  it('meets a correction with 惭 when self-grasping is loose', () => {
    const impulse = appraise(contact({ gate: 'ear', outcome: 'adverse' }), freshMind(T0))
    expect(impulse.factors.hri).toBeGreaterThan(0)
    expect(impulse.factors.mraksa).toBeUndefined()
    expect(impulse.manas.atmaMana!).toBeLessThan(0)
  })

  it('meets the same correction with 覆 and 嗔 when the grip is tight', () => {
    const gripped: CittaState = {
      ...freshMind(T0),
      manas: { atmaMoha: 0, atmaDrsti: 0, atmaMana: 0.7, atmaSneha: 0 },
    }
    const impulse = appraise(contact({ gate: 'ear', outcome: 'adverse' }), gripped)
    expect(impulse.factors.mraksa).toBeGreaterThan(0)
    expect(impulse.factors.pratigha).toBeGreaterThan(0)
    expect(impulse.manas.atmaMana!).toBeGreaterThan(0)
  })

  it('intoxicates on a success streak', () => {
    const winning: CittaState = { ...freshMind(T0), favorableStreak: 4 }
    const impulse = appraise(contact({ outcome: 'favorable' }), winning)
    expect(impulse.factors.mada).toBeGreaterThan(0)
    expect(impulse.factors.pramada).toBeGreaterThan(0)
    expect(impulse.manas.atmaMana!).toBeGreaterThan(0)
  })

  it('churns and then dulls on an adverse run', () => {
    const churning = appraise(contact(), { ...freshMind(T0), adverseStreak: 2 })
    expect(churning.factors.auddhatya).toBeGreaterThan(0)
    expect(churning.factors.styana).toBeUndefined()

    const dulled = appraise(contact(), { ...freshMind(T0), adverseStreak: 6 })
    expect(dulled.factors.styana).toBeGreaterThan(0)
    expect(dulled.factors.kausidya).toBeGreaterThan(0)
  })

  it('reads a repeatedly-failing situation as a position being defended', () => {
    const seed: Seed = {
      situation: 'bash:pytest',
      potency: 0.7,
      count: 4,
      valence: -0.5,
      gate: 'body',
      factors: ['pratigha'],
      firstAt: T0 - 10_000,
      lastAt: T0 - 1000,
    }
    const impulse = appraise(contact(), freshMind(T0), seed)
    expect(impulse.factors.drsti).toBeGreaterThan(0)
    expect(impulse.manas.atmaDrsti!).toBeGreaterThan(0)
  })

  it('grades an unchecked claim as 我痴 and a verified one as its opposite', () => {
    const guessed = appraise(contact({ nature: 'parikalpita' }), freshMind(T0))
    expect(guessed.manas.atmaMoha!).toBeGreaterThan(0)
    expect(guessed.factors.moha).toBeGreaterThan(0)

    const verified = appraise(contact({ nature: 'parinispanna' }), freshMind(T0))
    expect(verified.manas.atmaMoha!).toBeLessThan(0)
    expect(verified.factors.amoha).toBeGreaterThan(0)
  })

  it('grows self-love only when the object is the agent\'s own output', () => {
    expect(appraise(contact({ situation: 'self:earlier-summary' }), freshMind(T0)).manas.atmaSneha!)
      .toBeGreaterThan(0)
    expect(appraise(contact(), freshMind(T0)).manas.atmaSneha!).toBeLessThan(0)
  })
})

describe('现行熏种子 — receiving a contact', () => {
  it('moves the mind, counts the contact, and perfumes the seed', () => {
    const { citta, seed } = receive(view(freshMind(T0)), contact())
    expect(citta.contacts).toBe(1)
    expect(citta.adverseStreak).toBe(1)
    expect(citta.feeling.id).toBe('duhkha')
    expect(seed.situation).toBe('bash:pytest')
    expect(seed.count).toBe(1)
    expect(seed.potency).toBeGreaterThan(0)
  })

  it('resets the opposite streak', () => {
    const first = receive(view(freshMind(T0)), contact({ outcome: 'favorable' }))
    const second = receive(view(first.citta), contact({ at: T0 + 1000 }))
    expect(second.citta.favorableStreak).toBe(0)
    expect(second.citta.adverseStreak).toBe(1)
  })

  it('saturates an activation instead of accumulating past 1', () => {
    let state = freshMind(T0)
    for (let index = 0; index < 40; index += 1) {
      state = receive(view(state), contact({ at: T0 + index, intensity: 1 })).citta
    }
    for (const activation of Object.values(state.factors)) {
      expect(activation).toBeLessThanOrEqual(1)
    }
    expect(graspStrength(state.manas)).toBeLessThanOrEqual(1)
  })

  it('keeps the strongest feeling of the moment rather than the latest whisper', () => {
    const loud = receive(view(freshMind(T0)), contact({ intensity: 1 }))
    const quiet = receive(view(loud.citta), contact({ at: T0 + 1, intensity: 0.05 }))
    expect(quiet.citta.feeling.arousal).toBeCloseTo(loud.citta.feeling.arousal, 3)
  })
})

describe('熏习 — perfuming a seed', () => {
  it('averages valence across contacts instead of tracking only the last', () => {
    const first = perfume(undefined, contact({ outcome: 'favorable' }), {
      factors: {}, feeling: { id: 'sukha', valence: 0.6, arousal: 0.6 }, manas: {},
    })
    const second = perfume(first, contact({ at: T0 + 1000 }), {
      factors: {}, feeling: { id: 'duhkha', valence: -0.6, arousal: 0.6 }, manas: {},
    })
    expect(second.count).toBe(2)
    expect(second.valence).toBeCloseTo(0, 5)
  })

  it('carries the newest lesson and keeps the old one when none is given', () => {
    const first = perfume(undefined, contact({ note: 'run the baseline first' }), {
      factors: {}, feeling: { id: 'duhkha', valence: -0.6, arousal: 0.6 }, manas: {},
    })
    expect(first.lesson).toBe('run the baseline first')
    const second = perfume(first, contact({ at: T0 + 1000 }), {
      factors: {}, feeling: { id: 'duhkha', valence: -0.6, arousal: 0.6 }, manas: {},
    })
    expect(second.lesson).toBe('run the baseline first')
  })

  it('keeps the first-seen time and advances the last-seen time', () => {
    const first = perfume(undefined, contact(), {
      factors: {}, feeling: { id: 'duhkha', valence: -0.6, arousal: 0.6 }, manas: {},
    })
    const second = perfume(first, contact({ at: T0 + 5000 }), {
      factors: {}, feeling: { id: 'duhkha', valence: -0.6, arousal: 0.6 }, manas: {},
    })
    expect(second.firstAt).toBe(T0)
    expect(second.lastAt).toBe(T0 + 5000)
  })

  it('decays potency over the seed half-life, far slower than a mood', () => {
    const seed = perfume(undefined, contact(), {
      factors: {}, feeling: { id: 'duhkha', valence: -0.6, arousal: 0.6 }, manas: {},
    })
    const aged = decaySeed(seed, T0 + DEFAULT_TUNING.seedHalfLifeMs)
    expect(aged.potency).toBeCloseTo(seed.potency / 2, 5)
  })
})

describe('种子生现行 — manifestation', () => {
  const seeds = new Map<string, Seed>([
    ['bash:pytest', {
      situation: 'bash:pytest',
      potency: 0.8,
      count: 3,
      valence: -0.4,
      gate: 'body',
      factors: ['pratigha'],
      lesson: 'run the baseline first',
      firstAt: T0 - 20_000,
      lastAt: T0 - 1000,
    }],
    ['bash:ruff', {
      situation: 'bash:ruff',
      potency: 0.5,
      count: 2,
      valence: 0.2,
      gate: 'body',
      factors: [],
      firstAt: T0 - 20_000,
      lastAt: T0 - 1000,
    }],
    ['read:index.ts', {
      situation: 'read:index.ts',
      potency: 0.9,
      count: 5,
      valence: 0.1,
      gate: 'eye',
      factors: [],
      firstAt: T0 - 20_000,
      lastAt: T0 - 1000,
    }],
  ])

  it('prefers the exact situation and admits related ones at half weight', () => {
    const found = manifest(seeds, 'bash:pytest', T0)
    expect(found[0]!.seed.situation).toBe('bash:pytest')
    expect(found[0]!.via).toBe('exact')
    expect(found.some(entry => entry.seed.situation === 'bash:ruff' && entry.via === 'prefix')).toBe(true)
  })

  it('never crosses into an unrelated kind', () => {
    const found = manifest(seeds, 'bash:pytest', T0)
    expect(found.map(entry => entry.seed.situation)).not.toContain('read:index.ts')
  })

  it('leaves a seed dormant once its potency has decayed under the floor', () => {
    expect(manifest(seeds, 'bash:pytest', T0 + DEFAULT_TUNING.seedHalfLifeMs * 8)).toHaveLength(0)
  })

  it('honours the limit', () => {
    expect(manifest(seeds, 'bash:pytest', T0, 1)).toHaveLength(1)
  })
})

describe('转依 — transformation', () => {
  it('answers a factor with its classical antidote', () => {
    const turned = transform('auddhatya', T0)
    expect(turned?.antidote).toBe('upeksa')
    expect(turned?.practice).toContain('行舍')
  })

  it('answers every self-grasping with 平等性智 and its counter-move', () => {
    const turned = transform('atma-mana', T0)
    expect(turned?.wisdom).toBe('samata')
    expect(turned?.practice).toContain('disconfirming')
  })

  it('sends afflictions of not-seeing to 妙观察智 and of slackness to 成所作智', () => {
    expect(transform('drsti', T0)?.wisdom).toBe('pratyaveksana')
    expect(transform('kausidya', T0)?.wisdom).toBe('krtyanusthana')
    expect(transform('mraksa', T0)?.wisdom).toBe('adarsa')
  })

  it('refuses what is not an affliction and what is not a factor at all', () => {
    expect(transform('prajna', T0)).toBeUndefined()
    expect(transform('vitarka', T0)).toBeUndefined()
    expect(transform('not-a-factor', T0)).toBeUndefined()
  })
})

describe('reading the state', () => {
  it('orders factors by strength and afflictions separately', () => {
    const state: CittaState = {
      ...freshMind(T0),
      factors: { virya: 0.3, auddhatya: 0.7, prajna: 0.5 },
    }
    expect(dominant(state, 2).map(entry => entry.term.id)).toEqual(['auddhatya', 'prajna'])
    expect(afflictions(state).map(entry => entry.term.id)).toEqual(['auddhatya'])
  })

  it('reports the tightest component as the grip, not the average', () => {
    expect(graspStrength({ atmaMoha: 0.1, atmaDrsti: 0.9, atmaMana: 0, atmaSneha: 0 })).toBe(0.9)
  })
})
