/**
 * The session projection the panel reads.
 *
 * A projection is a deterministic fold of the durable log, so the browser can
 * render the mind without calling the host and without holding the whole
 * conversation in memory — and so a replayed session shows the state it
 * actually had, not the state the process happens to be in now.
 *
 * The fold keeps the latest checkpoint plus a bounded tail. The tail is what
 * makes a panel worth opening: one reading tells you the agent is at 掉举 0.6,
 * a trend tells you it has been climbing for twenty minutes, which is the part
 * a person can act on.
 * @module dsh-yogacara/projection
 */

import { z } from 'zod'
// Type-only: the import is what lets the declaration below merge into the
// registry's key map.
import type {} from '@deepseek-ai/dsh-session-projection/types'
import type { CittaChangeMeta } from './events.ts'

/** How many checkpoints the tail carries. Enough for a trend, cheap to cache. */
export const PROJECTION_HISTORY = 40

/** The folded state the panel renders. */
export interface CittaProjection {
  /** The most recent checkpoint, or `null` before the mind has moved at all. */
  readonly current: CittaChangeMeta | null
  /** Recent checkpoints, oldest first, at most {@link PROJECTION_HISTORY}. */
  readonly recent: readonly CittaChangeMeta[]
}

/** Runtime schema of one durable checkpoint, as the wire carries it. */
export const cittaChangeSchema: z.ZodType<CittaChangeMeta> = z.object({
  kind: z.literal('citta/change'),
  version: z.literal(1),
  situation: z.string(),
  gate: z.enum(['eye', 'ear', 'nose', 'tongue', 'body']),
  outcome: z.enum(['favorable', 'adverse', 'neutral']),
  surprise: z.number(),
  expected: z.object({ valence: z.number(), confidence: z.number() }),
  feeling: z.object({
    id: z.enum(['sukha', 'duhkha', 'saumanasya', 'daurmanasya', 'upeksa']),
    valence: z.number(),
    arousal: z.number(),
  }),
  factors: z.array(z.object({ id: z.string(), activation: z.number() })),
  manas: z.object({
    atmaMoha: z.number(),
    atmaDrsti: z.number(),
    atmaMana: z.number(),
    atmaSneha: z.number(),
  }),
  seedCount: z.number(),
  lesson: z.string().optional(),
  at: z.number(),
}) as unknown as z.ZodType<CittaChangeMeta>

/** Runtime schema of the whole projection payload. */
export const cittaProjectionSchema: z.ZodType<CittaProjection> = z.object({
  current: z.union([cittaChangeSchema, z.null()]),
  recent: z.array(cittaChangeSchema).max(PROJECTION_HISTORY),
}) as unknown as z.ZodType<CittaProjection>

/** The state a session starts in: the mind has not moved yet. */
export const EMPTY_PROJECTION: CittaProjection = { current: null, recent: [] }

/**
 * Fold one checkpoint into the projection.
 *
 * Pure and deterministic over ascending log order, which is what makes the
 * cached state safe to reuse and the replay identical to the live run.
 * @param state - The state so far.
 * @param change - The checkpoint to fold in.
 * @returns the next state.
 */
export function foldCittaChange(
  state: CittaProjection,
  change: CittaChangeMeta,
): CittaProjection {
  const recent = [...state.recent, change]
  return {
    current: change,
    recent: recent.length > PROJECTION_HISTORY
      ? recent.slice(recent.length - PROJECTION_HISTORY)
      : recent,
  }
}

/** The projection key, declared once here and merged into the registry's map. */
export const CITTA_PROJECTION_KEY = 'citta'

/**
 * State-shape version. Bump when {@link CittaProjection} changes shape, so a
 * cached fold from an older build is discarded rather than misread.
 */
export const CITTA_PROJECTION_VERSION = 1

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * The agent's mind: the latest `citta/change` checkpoint plus a bounded
     * tail of earlier ones. `current` is null before the mind has moved.
     */
    citta: CittaProjection
  }
}
