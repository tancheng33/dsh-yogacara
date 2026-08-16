/**
 * The durable form of the store consciousness: one `alaya` domain holding the
 * seed table and, as its global singleton, the current mind plus the recent
 * transformations it committed to.
 *
 * Seeds are the part that must survive a restart — a mind that reboots into
 * 舍受 is fine and even correct (moods are momentary), but a mind that reboots
 * having forgotten that this migration script has failed three times before has
 * lost the only thing worth keeping.
 * @module dsh-yogacara/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type {
  CaitasikaId,
  CittaState,
  FeelingId,
  ManasAfflictionId,
  NatureId,
  Seed,
  SenseGate,
  Transformation,
  WisdomId,
} from './types.ts'

/** Milliseconds since the epoch, as stored. */
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

/** An activation, potency, or grip: a unit interval. */
const unit = z.number().min(0).max(1)

/** A signed hedonic tone. */
const signedUnit = z.number().min(-1).max(1)

/** The five gates. */
export const senseGateSchema = z.enum([
  'eye', 'ear', 'nose', 'tongue', 'body',
]) as unknown as z.ZodType<SenseGate>

/** The five feelings. */
export const feelingIdSchema = z.enum([
  'sukha', 'duhkha', 'saumanasya', 'daurmanasya', 'upeksa',
]) as unknown as z.ZodType<FeelingId>

/** The three natures. */
export const natureIdSchema = z.enum([
  'parikalpita', 'paratantra', 'parinispanna',
]) as unknown as z.ZodType<NatureId>

/** The four wisdoms. */
export const wisdomIdSchema = z.enum([
  'adarsa', 'samata', 'pratyaveksana', 'krtyanusthana',
]) as unknown as z.ZodType<WisdomId>

/** The four self-graspings. */
export const manasAfflictionIdSchema = z.enum([
  'atma-moha', 'atma-drsti', 'atma-mana', 'atma-sneha',
]) as unknown as z.ZodType<ManasAfflictionId>

/**
 * A factor id. Validated as a bare identifier rather than against the closed
 * enum of 51: a record written by a newer build must not make an older build
 * refuse to open its own store.
 */
export const caitasikaIdSchema = z.string().regex(/^[a-z]+$/) as unknown as z.ZodType<CaitasikaId>

/** The felt tone of one moment. */
export const feelingSchema = z.object({
  id: feelingIdSchema,
  valence: signedUnit,
  arousal: unit,
})

/** The four components of self-grasping. */
export const manasStateSchema = z.object({
  atmaMoha: unit,
  atmaDrsti: unit,
  atmaMana: unit,
  atmaSneha: unit,
})

/** The whole mind at one moment. */
export const cittaStateSchema = z.object({
  factors: z.record(caitasikaIdSchema, unit),
  feeling: feelingSchema,
  manas: manasStateSchema,
  contacts: z.number().int().nonnegative(),
  favorableStreak: z.number().int().nonnegative(),
  adverseStreak: z.number().int().nonnegative(),
  updatedAt: timestamp,
}) as unknown as z.ZodType<CittaState>

/** One seed in the store. */
export const seedSchema = z.object({
  situation: z.string().min(1).max(200),
  potency: unit,
  count: z.number().int().positive(),
  valence: signedUnit,
  gate: senseGateSchema,
  factors: z.array(caitasikaIdSchema).max(8),
  lesson: z.string().max(500).optional(),
  firstAt: timestamp,
  lastAt: timestamp,
}) as unknown as z.ZodType<Seed>

/** One committed turn of an affliction into its wisdom. */
export const transformationSchema = z.object({
  affliction: z.union([caitasikaIdSchema, manasAfflictionIdSchema]),
  antidote: caitasikaIdSchema,
  wisdom: wisdomIdSchema,
  practice: z.string().min(1).max(1000),
  at: timestamp,
}) as unknown as z.ZodType<Transformation>

/** How many recent turnings the global keeps; older ones fall away. */
export const MAX_TURNINGS = 32

/** The store's global singleton: the current mind and what it lately turned. */
export interface AlayaGlobal {
  /** Format marker for the global payload, independent of the domain version. */
  readonly version: 1
  readonly citta: CittaState
  /** Most recent last, bounded by {@link MAX_TURNINGS}. */
  readonly turnings: readonly Transformation[]
}

/** Runtime schema of the global singleton. */
export const alayaGlobalSchema = z.object({
  version: z.literal(1),
  citta: cittaStateSchema,
  turnings: z.array(transformationSchema).max(MAX_TURNINGS),
}) as unknown as z.ZodType<AlayaGlobal>

/**
 * The value served before the first write: a mind with no history. `updatedAt`
 * is 0 rather than "now" so the first real contact decays it from the epoch and
 * lands on an empty mind either way.
 */
export const INITIAL_GLOBAL: AlayaGlobal = {
  version: 1,
  citta: {
    factors: {},
    feeling: { id: 'upeksa', valence: 0, arousal: 0 },
    manas: { atmaMoha: 0, atmaDrsti: 0, atmaMana: 0, atmaSneha: 0 },
    contacts: 0,
    favorableStreak: 0,
    adverseStreak: 0,
    updatedAt: 0,
  },
  turnings: [],
}

/**
 * Domain-name syntax the storage layer accepts — the name doubles as a backend
 * unit name, so it must be safe as both a file name and a SQL identifier.
 */
export const DOMAIN_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * Validate a configured domain name at this plugin's own boundary.
 *
 * The storage layer rejects a bad name too, but only from inside `defineDomain`
 * during plugin load, where the failure surfaces as a loader stack trace naming
 * neither the offending setting nor the file it came from.
 * @param name - The configured domain name.
 * @returns the name, unchanged.
 * @throws TypeError when the name is not a legal domain name.
 */
export function assertDomainName(name: string): string {
  if (!DOMAIN_NAME_PATTERN.test(name)) {
    throw new TypeError(
      `dsh-yogacara: invalid "domain" setting ${JSON.stringify(name)} — a domain name must start `
      + 'with a lowercase letter and contain only lowercase letters, digits, and underscores '
      + '(e.g. "alaya", "alaya_review"). Fix it in the plugin row config.',
    )
  }
  return name
}

/**
 * Declare one store: a seed table keyed by situation, with the mind as the
 * domain's global singleton.
 *
 * The name is a parameter because one name is one store — two plugin rows with
 * different names give two agents genuinely separate histories, which is the
 * honest way to run a shared deployment.
 * @param name - Domain name; must match the storage hub's unit-name syntax.
 * @returns the domain declaration.
 */
export function defineAlayaDomain(name = 'alaya') {
  return defineDomain({
    name: assertDomainName(name),
    version: 0,
    global: { schema: alayaGlobalSchema, initial: INITIAL_GLOBAL },
    tables: {
      seeds: domainTable<string, Seed>(seedSchema),
    },
  })
}

/** The default store, under the domain name `alaya`. */
export const alayaDomainSpec = defineAlayaDomain()

/** The declaration type every store shares. */
export type AlayaDomainSpec = ReturnType<typeof defineAlayaDomain>
