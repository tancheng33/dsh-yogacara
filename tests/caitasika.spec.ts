import { describe, expect, it } from 'vitest'
import {
  CAITASIKAS,
  CONSCIOUSNESSES,
  FEELINGS,
  MANAS_AFFLICTIONS,
  NATURES,
  WISDOMS,
  caitasika,
  caitasikasOf,
  isAffliction,
  isWholesome,
} from '../src/caitasika.ts'

describe('the catalogue', () => {
  it('holds exactly the 51 mental factors', () => {
    expect(CAITASIKAS).toHaveLength(51)
  })

  it('holds each classical group at its classical size', () => {
    expect(caitasikasOf('universal')).toHaveLength(5)
    expect(caitasikasOf('object-determining')).toHaveLength(5)
    expect(caitasikasOf('wholesome')).toHaveLength(11)
    expect(caitasikasOf('root-affliction')).toHaveLength(6)
    expect(caitasikasOf('secondary-affliction')).toHaveLength(20)
    expect(caitasikasOf('indeterminate')).toHaveLength(4)
  })

  it('gives every factor a unique id', () => {
    expect(new Set(CAITASIKAS.map(term => term.id)).size).toBe(CAITASIKAS.length)
  })

  it('gives every affliction an antidote that is itself a usable factor', () => {
    for (const term of CAITASIKAS) {
      if (!isAffliction(term.id)) continue
      expect(term.antidote, `${term.id} has no antidote`).toBeDefined()
      const antidote = caitasika(term.antidote as string)
      expect(antidote, `${term.id} names an unknown antidote`).toBeDefined()
      // An antidote must be something a mind can cultivate: wholesome, or one
      // of the object-determining factors (念, 定, 慧, 胜解).
      expect(
        isWholesome(antidote!.id) || antidote!.category === 'object-determining',
        `${term.id} names ${antidote!.id}, which is not cultivable`,
      ).toBe(true)
    }
  })

  it('never makes an affliction its own antidote', () => {
    for (const term of CAITASIKAS) {
      expect(term.antidote).not.toBe(term.id)
    }
  })

  it('carries the eight consciousnesses with a harness reading for each', () => {
    expect(CONSCIOUSNESSES).toHaveLength(8)
    for (const term of CONSCIOUSNESSES) expect(term.gloss.length).toBeGreaterThan(10)
  })

  it('orders the five feelings on the valence axis with 舍 at zero', () => {
    expect(FEELINGS).toHaveLength(5)
    expect(FEELINGS.find(term => term.id === 'upeksa')?.valence).toBe(0)
    expect(FEELINGS.find(term => term.id === 'saumanasya')!.valence)
      .toBeGreaterThan(FEELINGS.find(term => term.id === 'sukha')!.valence)
  })

  it('orders the three natures by the credence they license', () => {
    expect(NATURES.map(term => term.credence)).toEqual([...NATURES.map(term => term.credence)].sort((a, b) => a - b))
  })

  it('gives each self-grasping a measurable proxy and a counter-move', () => {
    expect(MANAS_AFFLICTIONS).toHaveLength(4)
    for (const term of MANAS_AFFLICTIONS) {
      expect(term.proxy.length).toBeGreaterThan(10)
      expect(term.counter.length).toBeGreaterThan(10)
    }
  })

  it('gives each wisdom the consciousness it turns from and an act to perform', () => {
    expect(WISDOMS).toHaveLength(4)
    for (const term of WISDOMS) {
      expect(term.from.length).toBeGreaterThan(0)
      expect(term.practice.length).toBeGreaterThan(10)
    }
  })
})
