/**
 * The durable record of the mind moving.
 *
 * Every contact appends one whole-value checkpoint to the session log. Whole
 * value, not a delta, for two reasons: a UI that loads only the tail of a long
 * conversation can still render the mind at that moment without replaying
 * everything before it, and a reader three months later sees what the agent's
 * state actually was when it said what it said — the state is part of the
 * record, not a live-only readout that evaporates when the process exits.
 * @module dsh-yogacara/events
 */

import type {
  CaitasikaId,
  ContactOutcome,
  FeelingId,
  ManasState,
  SenseGate,
} from './types.ts'

/** How many factors one checkpoint carries; the rest are recoverable from the store. */
export const CHECKPOINT_FACTORS = 6

/** One factor and how strongly it was active. */
export interface CittaChangeFactor {
  readonly id: CaitasikaId
  /** Activation in [0, 1], rounded to two places. */
  readonly activation: number
}

/**
 * The state of the mind immediately after one contact, complete enough to
 * render on its own.
 */
export interface CittaChangeMeta {
  readonly kind: 'citta/change'
  readonly version: 1
  /** The situation key the contact perfumed. */
  readonly situation: string
  /** Which of the five gates received it. */
  readonly gate: SenseGate
  readonly outcome: ContactOutcome
  /** Expectation violation in [0, 1] — how much of the contact was news. */
  readonly surprise: number
  /** What the store predicted beforehand, so the reading can be audited. */
  readonly expected: { readonly valence: number, readonly confidence: number }
  readonly feeling: {
    readonly id: FeelingId
    readonly valence: number
    readonly arousal: number
  }
  /** The strongest active factors, at most {@link CHECKPOINT_FACTORS}. */
  readonly factors: readonly CittaChangeFactor[]
  readonly manas: ManasState
  /** How many contacts this situation has now accumulated. */
  readonly seedCount: number
  /** The lesson the seed carries, when it has one. */
  readonly lesson?: string
  /** Wall-clock milliseconds of the contact. */
  readonly at: number
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The complete state of the mind after one contact. Emitted once per
     * received contact; a UI folds the latest one and needs no earlier event.
     */
    'citta/change': CittaChangeMeta
  }
}
