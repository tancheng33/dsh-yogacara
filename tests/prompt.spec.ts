import { describe, expect, it } from 'vitest'
import { freshMind } from '../src/citta.ts'
import { SELF_GUIDANCE, relativeTime, renderSelfReport, renderStateLines } from '../src/prompt.ts'
import type { CittaState, Manifestation, SelfReportInput, Transformation } from '../src/index.ts'

const T0 = 1_700_000_000_000

/**
 * Build a render input with quiet defaults.
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
    turningMaxAgeMs: 30 * 60_000,
    now: T0,
    ...overrides,
  }
}

const stirred: CittaState = {
  ...freshMind(T0),
  factors: { auddhatya: 0.62, vicikitsa: 0.41, virya: 0.33 },
  feeling: { id: 'daurmanasya', valence: -0.45, arousal: 0.71 },
}

const manifestation: Manifestation = {
  seed: {
    situation: 'bash:pytest',
    potency: 0.7,
    count: 4,
    valence: -0.55,
    gate: 'tongue',
    factors: ['pratigha'],
    lesson: 'run the baseline before touching the fixture',
    firstAt: T0 - 400_000,
    lastAt: T0 - 200_000,
  },
  current: 0.7,
  via: 'exact',
}

describe('the self-report', () => {
  it('renders nothing at all for a quiet mind, so the section drops', () => {
    expect(renderSelfReport(input())).toBe('')
    expect(renderStateLines(input())).toEqual([])
  })

  it('reports the feeling, the live factors, and the antidote for each affliction', () => {
    const text = renderSelfReport(input({ citta: stirred }))
    expect(text).toContain('受 feeling: 忧')
    expect(text).toContain('掉举')
    expect(text).toContain('对治 antidotes at hand')
    expect(text).toContain('行舍')
  })

  it('honours the factor bound', () => {
    const lines = renderStateLines(input({ citta: stirred, maxFactors: 1 }))
    const factorLine = lines.find(line => line.startsWith('心所'))!
    expect(factorLine).toContain('掉举')
    expect(factorLine).not.toContain('疑')
  })

  it('states a high self-grasping as a warning with its proxy and counter-move', () => {
    const lines = renderStateLines(input({
      citta: { ...stirred, manas: { atmaMoha: 0.1, atmaDrsti: 0, atmaMana: 0.61, atmaSneha: 0 } },
    }))
    expect(lines.some(line => line.includes('我慢') && line.includes('⚠'))).toBe(true)
    expect(lines.some(line => line.includes('counter-move'))).toBe(true)
  })

  it('leaves a low self-grasping as a bare number', () => {
    const lines = renderStateLines(input({
      citta: { ...stirred, manas: { atmaMoha: 0.1, atmaDrsti: 0, atmaMana: 0.2, atmaSneha: 0 } },
    }))
    expect(lines.some(line => line.includes('末那'))).toBe(true)
    expect(lines.some(line => line.includes('⚠'))).toBe(false)
  })

  it('surfaces a manifesting seed with its count and its carried lesson', () => {
    const lines = renderStateLines(input({ citta: stirred, manifestations: [manifestation] }))
    const seedLine = lines.find(line => line.includes('bash:pytest'))!
    expect(seedLine).toContain('×4')
    expect(seedLine).toContain('run the baseline')
    expect(seedLine).toContain('ago')
  })

  it('marks a related seed as related', () => {
    const lines = renderStateLines(input({
      citta: stirred,
      manifestations: [{ ...manifestation, via: 'prefix' }],
    }))
    expect(lines.some(line => line.includes('related situation'))).toBe(true)
  })

  it('reports the last turning as a commitment already made', () => {
    const turning: Transformation = {
      affliction: 'atma-mana',
      antidote: 'prajna',
      wisdom: 'samata',
      practice: 'grant the correction first',
      at: T0 - 60_000,
    }
    const lines = renderStateLines(input({ citta: stirred, turnings: [turning] }))
    expect(lines.some(line => line.includes('近转依') && line.includes('平等性智'))).toBe(true)
  })

  it('drops a turning old enough to have become furniture', () => {
    const stale: Transformation = {
      affliction: 'atma-mana',
      antidote: 'prajna',
      wisdom: 'samata',
      practice: 'grant the correction first',
      at: T0 - 5 * 60 * 60_000,
    }
    const lines = renderStateLines(input({ citta: stirred, turnings: [stale] }))
    expect(lines.some(line => line.includes('近转依'))).toBe(false)
  })

  it('carries the standing guidance whenever any state is reported', () => {
    const text = renderSelfReport(input({ citta: stirred }))
    expect(text).toContain('<self_state>')
    expect(text).toContain(SELF_GUIDANCE)
  })

  it('forbids performing the state at the user, in the guidance itself', () => {
    expect(SELF_GUIDANCE).toContain('Do NOT narrate feelings at the user')
    expect(SELF_GUIDANCE).toContain('not a claim that you suffer')
  })
})

describe('relative time', () => {
  it('reads sub-second as just now and scales up through days', () => {
    expect(relativeTime(0)).toBe('just now')
    expect(relativeTime(5_000)).toBe('5s ago')
    expect(relativeTime(120_000)).toBe('2m ago')
    expect(relativeTime(7_200_000)).toBe('2h ago')
    expect(relativeTime(3 * 86_400_000)).toBe('3d ago')
  })
})

describe('the expectation line', () => {
  it('tells the agent when something was genuinely news', () => {
    const lines = renderStateLines(input({ citta: stirred, lastSurprise: 0.85 }))
    expect(lines.some(line => line.includes('预期') && line.includes('news, not noise'))).toBe(true)
  })

  it('tells it when its own store already called this one', () => {
    const lines = renderStateLines(input({ citta: stirred, lastSurprise: 0.1 }))
    expect(lines.some(line => line.includes('confirmation, not information'))).toBe(true)
  })

  it('stays off the prompt before anything has been received', () => {
    const lines = renderStateLines(input({ citta: stirred }))
    expect(lines.some(line => line.includes('预期'))).toBe(false)
  })
})
