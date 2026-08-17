import { describe, expect, it } from 'vitest'
import {
  cittaProjectionSchema,
  EMPTY_PROJECTION,
  foldCittaChange,
  PROJECTION_HISTORY,
} from '../src/projection.ts'
import type { CittaChangeMeta } from '../src/events.ts'

const T0 = 1_700_000_000_000

/**
 * Build a checkpoint.
 * @param overrides - Fields to replace.
 * @returns the checkpoint.
 */
function change(overrides: Partial<CittaChangeMeta> = {}): CittaChangeMeta {
  return {
    kind: 'citta/change',
    version: 1,
    situation: 'chat:warmth',
    gate: 'ear',
    outcome: 'favorable',
    surprise: 1,
    expected: { valence: 0, confidence: 0 },
    feeling: { id: 'saumanasya', valence: 0.48, arousal: 0.6 },
    factors: [{ id: 'sraddha', activation: 0.5 }],
    manas: { atmaMoha: 0, atmaDrsti: 0, atmaMana: 0.1, atmaSneha: 0 },
    seedCount: 1,
    at: T0,
    ...overrides,
  }
}

describe('the projection the panel reads', () => {
  it('starts with a mind that has not moved', () => {
    expect(EMPTY_PROJECTION.current).toBeNull()
    expect(EMPTY_PROJECTION.recent).toEqual([])
  })

  it('folds a checkpoint into the current reading and the tail', () => {
    const state = foldCittaChange(EMPTY_PROJECTION, change())
    expect(state.current?.situation).toBe('chat:warmth')
    expect(state.recent).toHaveLength(1)
  })

  it('keeps the tail bounded and ordered oldest first', () => {
    let state = EMPTY_PROJECTION
    for (let index = 0; index < PROJECTION_HISTORY + 15; index += 1) {
      state = foldCittaChange(state, change({ at: T0 + index, seedCount: index }))
    }
    expect(state.recent).toHaveLength(PROJECTION_HISTORY)
    expect(state.recent[0]!.at).toBeLessThan(state.recent.at(-1)!.at)
    expect(state.current?.at).toBe(state.recent.at(-1)?.at)
  })

  it('never mutates the state it was handed, so a cached fold stays valid', () => {
    const before = foldCittaChange(EMPTY_PROJECTION, change())
    const snapshot = JSON.stringify(before)
    foldCittaChange(before, change({ situation: 'chat:rebuke' }))
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('accepts what it produces, so the wire round-trips', () => {
    const state = foldCittaChange(EMPTY_PROJECTION, change())
    const wire: unknown = JSON.parse(JSON.stringify(state))
    expect(cittaProjectionSchema.safeParse(wire).success).toBe(true)
  })

  it('rejects a payload that is not a checkpoint', () => {
    expect(cittaProjectionSchema.safeParse({ current: { kind: 'nope' }, recent: [] }).success)
      .toBe(false)
  })
})
