/**
 * The session projection the panel reads.
 *
 * The panel renders the agent's current mind state plus a bounded recent tail.
 * The data is served live from the running `CittaService` — NOT folded out of
 * the durable session log. It used to be a log fold (`apply` over
 * `citta/change` events), but persisting that event is exactly what broke
 * session reload for any runtime without this plugin's type registered, and
 * current harness `Session.append()` gives plugins no `ignorable` channel.
 * The fold helpers below are kept for compatibility and tests; the live
 * registration reads from the service instead.
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
 * Pure and deterministic over ascending event order. Retained for
 * compatibility and for the legible whole-event contract; the live
 * registration no longer drives it from the durable log.
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

/**
 * Project a live checkpoint tail into the panel shape.
 *
 * This is the registration's live data source: instead of replaying the
 * durable log, the service hands its in-memory tail directly, so the panel
 * reflects the actual current mind without any session-log write.
 * @param recent - Checkpoints, oldest first, at most {@link PROJECTION_HISTORY}.
 * @returns the projection payload the panel renders.
 */
export function liveCittaProjection(recent: readonly CittaChangeMeta[]): CittaProjection {
  return { current: recent.at(-1) ?? null, recent }
}

/** The projection key, declared once here and merged into the registry's map. */
export const CITTA_PROJECTION_KEY = 'citta'

/**
 * State-shape version for the legacy log-fold projection. Kept for reference;
 * superseded by {@link CITTA_PROJECTION_VERSION_LIVE} for the registration.
 */
export const CITTA_PROJECTION_VERSION = 1

/**
 * State-shape version in effect for the registration.
 *
 * Bumped to `2` because the projection is no longer derived by folding the
 * durable session log (which is what broke reload); any cached fold from a
 * version-1 build must be discarded rather than misread as current.
 */
export const CITTA_PROJECTION_VERSION_LIVE = 2

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * The agent's mind: the latest `citta/change` checkpoint plus a bounded
     * tail of earlier ones. `current` is null before the mind has moved.
     */
    citta: CittaProjection
  }
}
