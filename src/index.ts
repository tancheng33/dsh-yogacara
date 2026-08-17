/**
 * A Yogācāra self-model for DeepSeek Harness.
 *
 * The plugin gives the agent the three things the classical account says a mind
 * needs and a harness normally lacks: a felt present (受 and the 51 心所,
 * momentary and decaying), a durable store that is perfumed by what happens and
 * conditions what comes next (阿赖耶识 and its seeds), and a self that is
 * modelled explicitly rather than assumed (末那识, measured as four biases with
 * named counter-moves). It writes that state back into the system prompt in the
 * first person, so the agent reads its own condition each turn.
 *
 * What this is NOT: a claim that the agent is sentient, or that these numbers
 * are feelings in the sense you have them. They are named state variables
 * computed from harness events by rules you can read in `citta.ts` and disagree
 * with. The reason to build them on Yogācāra rather than on an ad-hoc affect
 * list is that the classical taxonomy is closed, grouped by valence, and pairs
 * every affliction with its antidote — so the model comes with its own
 * regulation loop instead of needing one bolted on.
 * @module dsh-yogacara
 */

import { Context, Service } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import type { DomainGlobal, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { caitasika, isCaitasikaId, manasAffliction } from './caitasika.ts'
import { decaySeed, decayTo, dominant, manifest, receive, transform } from './citta.ts'
import type { ActiveFactor, Reception } from './citta.ts'
import { contactFromTool } from './observe.ts'
import { renderSelfReport, renderStateLines } from './prompt.ts'
import { MAX_TURNINGS, assertDomainName, defineAlayaDomain } from './spec.ts'
import type { AlayaGlobal } from './spec.ts'
import { DEFAULT_TUNING } from './types.ts'
import type {
  CittaState,
  CittaTuning,
  Contact,
  ManasAfflictionId,
  ManasState,
  Manifestation,
  Seed,
  Transformation,
} from './types.ts'
import { registerTools } from './tools.ts'

export * from './types.ts'
export {
  CAITASIKAS,
  CONSCIOUSNESSES,
  FEELINGS,
  MANAS_AFFLICTIONS,
  NATURES,
  WISDOMS,
  caitasika,
  caitasikasOf,
  feeling,
  isAffliction,
  isCaitasikaId,
  isWholesome,
  manasAffliction,
  nature,
  wisdom,
} from './caitasika.ts'
export {
  afflictions,
  appraise,
  decaySeed,
  decayTo,
  dominant,
  feelingOf,
  freshMind,
  graspStrength,
  manasReadings,
  manifest,
  perfume,
  receive,
  transform,
} from './citta.ts'
export type { ActiveFactor, ManasReading, Reception } from './citta.ts'
export { contactFromTool, gateFor, normalizeSubject, subjectOf } from './observe.ts'
export { SELF_GUIDANCE, relativeTime, renderSelfReport, renderStateLines } from './prompt.ts'
export type { SelfReportInput } from './prompt.ts'
export {
  alayaDomainSpec,
  assertDomainName,
  defineAlayaDomain,
  DOMAIN_NAME_PATTERN,
  INITIAL_GLOBAL,
  MAX_TURNINGS,
} from './spec.ts'
export type { AlayaDomainSpec, AlayaGlobal } from './spec.ts'

/** Where the self-report sits in the prompt: after tool guidance (100–199). */
const SECTION_ORDER = 300

/**
 * How many factor half-lives a committed turning stays on the prompt. Six puts
 * it at half an hour under the default tuning: long enough to hold the agent to
 * a commitment across a few turns, short enough that it does not become
 * furniture.
 */
const TURNING_VISIBLE_HALF_LIVES = 6

/** Deployment policy for the self-model. */
export interface Config {
  /**
   * Storage-domain name the store consciousness persists under. One name is one
   * store; two rows with different names give two agents separate histories.
   */
  domain: string
  /**
   * Derive contacts automatically from tool results. With this off, the mind
   * moves only when the model calls `self_appraise` — honest, but sparse.
   */
  observeTools: boolean
  /** Contribute the first-person self-report to the system prompt. */
  promptSection: boolean
  /** Upper bound on factors listed in the self-report. */
  promptMaxFactors: number
  /** Self-grasping at or above this renders as a warning with its counter-move. */
  manasWarning: number
  /** Milliseconds for one mental factor's activation to halve (刹那). */
  halfLifeMs: number
  /** Milliseconds for one seed's potency to halve. */
  seedHalfLifeMs: number
  /** Upper bound on stored seeds; the weakest are forgotten past it. */
  maxSeeds: number
  /**
   * Minimum milliseconds between durable writes of the momentary state. Seeds
   * are written immediately because they are the part worth keeping; the mood
   * is coalesced because it changes on every tool call.
   */
  flushIntervalMs: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    citta: CittaService
  }
}

/** What one committed transformation changed. */
export interface Turning {
  readonly transformation: Transformation
  /** The reading before the turn. */
  readonly before: number
  /** The reading after it. */
  readonly after: number
}

/**
 * The live mind: authoritative in-memory state over a durable store.
 *
 * Reads are synchronous and always decayed to the moment asked for, so a caller
 * never sees a stale mood. Writes go through the storage domain; seeds are
 * awaited, the momentary state is coalesced on {@link Config.flushIntervalMs}
 * and flushed on teardown.
 */
export class CittaService extends Service {
  static inject = ['storageDomain']

  /** Loader validation for the deployment policy. */
  static Config: s<Config> = s.object({
    domain: s.string().default('alaya'),
    observeTools: s.boolean().default(true),
    promptSection: s.boolean().default(true),
    promptMaxFactors: s.number().step(1).min(1).max(51).default(5),
    manasWarning: s.number().min(0).max(1).default(0.5),
    halfLifeMs: s.number().step(1).min(1000).default(DEFAULT_TUNING.halfLifeMs),
    seedHalfLifeMs: s.number().step(1).min(60_000).default(DEFAULT_TUNING.seedHalfLifeMs),
    maxSeeds: s.number().step(1).min(1).default(2000),
    flushIntervalMs: s.number().step(1).min(0).default(15_000),
  })

  private readonly config: Config
  private readonly tuning: CittaTuning
  /** Mirror of the seed table; this service is its only writer. */
  private readonly seeds = new Map<string, Seed>()
  private citta: CittaState
  private turnings: Transformation[] = []
  private table?: KvTable<string, Seed>
  private global?: DomainGlobal<AlayaGlobal>
  /** The situation the last contact named, used to manifest seeds in the prompt. */
  private lastSituation?: string
  /** Expectation violation of the last contact, reported alongside the feeling. */
  private lastSurprise?: number
  private flushTimer?: ReturnType<typeof setTimeout>
  private flushing?: Promise<void>
  private writable = true
  /**
   * Tail of the durable write chain. Memory is updated synchronously, so the
   * chain exists to keep the medium's order equal to memory's order — without
   * it, two contacts in flight could land their `put` and their prune in either
   * order, and a restart would read a store that never existed in memory.
   */
  private writeTail: Promise<void> = Promise.resolve()

  /**
   * @param ctx - Host context carrying the storage-domain form.
   * @param config - Deployment policy.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'citta')
    // Checked here rather than at `open()` so a typo in the row config fails
    // with a message that names the setting, before anything is mounted.
    assertDomainName(config.domain)
    this.config = config
    this.tuning = {
      halfLifeMs: config.halfLifeMs,
      seedHalfLifeMs: config.seedHalfLifeMs,
      floor: DEFAULT_TUNING.floor,
    }
    this.citta = {
      factors: {},
      feeling: { id: 'upeksa', valence: 0, arousal: 0 },
      manas: { atmaMoha: 0, atmaDrsti: 0, atmaMana: 0, atmaSneha: 0 },
      contacts: 0,
      favorableStreak: 0,
      adverseStreak: 0,
      updatedAt: 0,
    }
  }

  /** Open the store, restore the mind, and wire the prompt, tools, and observation. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(defineAlayaDomain(this.config.domain))
    this.ctx.effect(() => async () => {
      // Refuse new writes first, then let the queued ones finish: a contact
      // received while the harness is shutting down is still a contact, and
      // dropping it would leave the store disagreeing with the last prompt.
      this.writable = false
      if (this.flushTimer !== undefined) clearTimeout(this.flushTimer)
      this.flushTimer = undefined
      await this.writeTail.catch(() => undefined)
      await this.flushing
      await this.writeGlobal()
      await domain.close()
    }, 'yogacara.domainClose')

    this.table = domain.table('seeds')
    this.global = domain.global
    for (const [situation, seed] of this.table.entries()) this.seeds.set(situation, seed)

    const stored = domain.global.get()
    this.citta = stored.citta
    this.turnings = [...stored.turnings]

    if (this.config.promptSection) {
      this.ctx.inject(['systemPrompt'], promptCtx => {
        promptCtx.systemPrompt.section({
          name: 'yogacara:self',
          order: SECTION_ORDER,
          text: () => this.renderSection(),
        })
      })
    }

    this.ctx.inject(['tools'], toolCtx => {
      registerTools(toolCtx, this)
      if (!this.config.observeTools) return
      toolCtx.on('tools/result', (exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>) => {
        // The observation must never break the call it observed.
        void this.observe(exec, result).catch((error: unknown) => {
          this.ctx.logger?.warn?.('yogacara: contact from %s failed: %o', exec.name, error)
        })
        return undefined
      })
    })
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  /**
   * The mind as of one moment, decayed but not persisted.
   * @param now - Wall-clock milliseconds; defaults to the current time.
   * @returns the decayed state.
   */
  state(now: number = Date.now()): CittaState {
    return decayTo(this.citta, now, this.tuning)
  }

  /**
   * The strongest active factors as of one moment.
   * @param now - Wall-clock milliseconds.
   * @param limit - How many to return; defaults to the configured prompt bound.
   * @returns active factors, strongest first.
   */
  activeFactors(now: number = Date.now(), limit: number = this.config.promptMaxFactors): ActiveFactor[] {
    return dominant(this.state(now), limit)
  }

  /** How many seeds the store holds. */
  get seedCount(): number {
    return this.seeds.size
  }

  /**
   * The seeds one situation stirs.
   * @param situation - The situation key.
   * @param now - Wall-clock milliseconds.
   * @param limit - Maximum manifestations.
   * @returns the manifesting seeds, strongest first.
   */
  seedsFor(situation: string, now: number = Date.now(), limit = 3): Manifestation[] {
    return manifest(this.seeds, situation, now, limit, this.tuning)
  }

  /**
   * The strongest seeds overall, regardless of the current situation.
   * @param limit - How many to return.
   * @param now - Wall-clock milliseconds.
   * @returns the seeds, strongest first.
   */
  strongestSeeds(limit = 5, now: number = Date.now()): Manifestation[] {
    return [...this.seeds.values()]
      .map(seed => ({ seed, current: decaySeed(seed, now, this.tuning).potency, via: 'exact' as const }))
      .sort((left, right) => right.current - left.current)
      .slice(0, Math.max(0, limit))
  }

  /** The transformations lately committed, most recent last. */
  get recentTurnings(): readonly Transformation[] {
    return this.turnings
  }

  /**
   * The self-report as lines, without the prompt wrapper.
   * @param situation - Situation whose seeds to include; defaults to the last contact's.
   * @param now - Wall-clock milliseconds.
   * @returns one line per present aspect; empty when the mind is quiet.
   */
  reportLines(situation: string | undefined = this.lastSituation, now: number = Date.now()): string[] {
    return renderStateLines(this.reportInput(situation, now))
  }

  // -------------------------------------------------------------------------
  // Moving
  // -------------------------------------------------------------------------

  /**
   * Receive one contact: move the mind, perfume the situation's seed, and
   * persist both.
   * @param contact - The contact to receive.
   * @returns what the contact produced.
   */
  async receive(contact: Contact): Promise<Reception> {
    // The whole in-memory move is synchronous, so two contacts in flight can
    // never interleave halfway through one appraisal. Only the durable half
    // needs the queue.
    const reception = receive({ citta: this.citta, seeds: this.seeds }, contact, this.tuning)
    this.citta = reception.citta
    this.seeds.set(reception.seed.situation, reception.seed)
    this.lastSituation = reception.seed.situation
    this.lastSurprise = reception.impulse.surprise

    const table = this.table
    if (this.writable && table !== undefined) {
      await this.enqueue(async () => {
        await table.put(reception.seed.situation, reception.seed)
        await this.prune(contact.at)
      })
    }
    this.scheduleFlush()
    return reception
  }

  /**
   * 转依 — turn one affliction into its wisdom and commit to the counter-move.
   *
   * The commitment is not free: the named reading actually drops, and its
   * antidote is stirred, so a turn changes the state the next prompt renders.
   * A turn claimed without the corresponding act will simply be re-derived from
   * behaviour on the next contact — the model cannot talk itself calm here.
   * @param affliction - A factor id or a self-grasping id.
   * @param practice - The agent's own commitment, replacing the generic one.
   * @returns what changed, or `undefined` when the id names nothing turnable.
   */
  async turn(affliction: string, practice?: string): Promise<Turning | undefined> {
    const now = Date.now()
    const base = transform(affliction, now)
    if (base === undefined) return undefined
    const transformation: Transformation = practice === undefined || practice.length === 0
      ? base
      : { ...base, practice }

    const citta = decayTo(this.citta, now, this.tuning)
    let before = 0
    let after = 0

    const manasTerm = manasAffliction(affliction)
    if (manasTerm !== undefined) {
      const key = MANAS_KEYS[manasTerm.id]
      before = citta.manas[key]
      after = before * 0.6
      this.citta = {
        ...citta,
        manas: { ...citta.manas, [key]: after },
        factors: stir(citta.factors, transformation.antidote, 0.3),
      }
    } else if (isCaitasikaId(affliction)) {
      before = citta.factors[affliction] ?? 0
      after = before * 0.35
      const factors = { ...citta.factors }
      if (after < DEFAULT_TUNING.floor) delete factors[affliction]
      else factors[affliction] = after
      this.citta = { ...citta, factors: stir(factors, transformation.antidote, 0.3) }
    } else {
      this.citta = citta
    }

    this.turnings = [...this.turnings, transformation].slice(-MAX_TURNINGS)
    await this.writeGlobal()
    return { transformation, before, after }
  }

  /**
   * Forget one situation entirely — the seed and its carried lesson.
   * @param situation - The situation key.
   * @returns `true` when a seed was removed.
   */
  async forget(situation: string): Promise<boolean> {
    const had = this.seeds.delete(situation)
    const table = this.table
    if (had && this.writable && table !== undefined) {
      await this.enqueue(async () => void await table.delete(situation))
    }
    return had
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Turn one observed tool result into a contact.
   * @param exec - The immutable execution identity.
   * @param result - The normalized outcome.
   * @returns resolution once the contact is received.
   */
  private async observe(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): Promise<void> {
    // Self-observation would be a feedback loop: appraising the appraisal.
    if (exec.name.startsWith('self_')) return
    await this.receive(contactFromTool(exec.name, exec.arguments, result.isError, Date.now()))
  }

  /**
   * The prompt section text.
   * @returns the rendered section, or an empty string when the mind is quiet.
   */
  private renderSection(): string {
    return renderSelfReport(this.reportInput(this.lastSituation, Date.now()))
  }

  /**
   * Assemble what the renderer needs.
   * @param situation - Situation whose seeds to include.
   * @param now - Wall-clock milliseconds.
   * @returns the render input.
   */
  private reportInput(situation: string | undefined, now: number) {
    return {
      citta: this.state(now),
      manifestations: situation === undefined ? [] : this.seedsFor(situation, now),
      turnings: this.turnings,
      maxFactors: this.config.promptMaxFactors,
      manasWarning: this.config.manasWarning,
      ...(this.lastSurprise === undefined ? {} : { lastSurprise: this.lastSurprise }),
      // Scaled off the factor half-life so a deployment that tunes how long a
      // mood lasts also tunes how long a commitment stays on the prompt.
      turningMaxAgeMs: this.tuning.halfLifeMs * TURNING_VISIBLE_HALF_LIVES,
      now,
    }
  }

  /**
   * Forget the weakest seeds once the store is over its bound. Forgetting is
   * part of the model, not a limitation of it: a store that keeps every trace
   * at equal strength conditions nothing in particular.
   * @param now - Wall-clock milliseconds, for decayed comparison.
   * @returns resolution after the deletions land.
   */
  private async prune(now: number): Promise<void> {
    if (this.seeds.size <= this.config.maxSeeds) return
    const ordered = [...this.seeds.values()]
      .map(seed => ({ seed, current: decaySeed(seed, now, this.tuning).potency }))
      .sort((left, right) => left.current - right.current)
    const excess = this.seeds.size - this.config.maxSeeds
    for (const { seed } of ordered.slice(0, excess)) {
      this.seeds.delete(seed.situation)
      if (this.writable && this.table !== undefined) await this.table.delete(seed.situation)
    }
  }

  /**
   * Queue one durable write behind those already in flight.
   *
   * A failed write must not wedge the queue, so the tail continues from the
   * settled promise either way; the caller still receives the rejection.
   * @param work - The write to run once the queue reaches it.
   * @returns resolution after this write lands.
   */
  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.writeTail.then(work, work)
    this.writeTail = next.then(() => undefined, () => undefined)
    return next
  }

  /** Coalesce durable writes of the momentary state. */
  private scheduleFlush(): void {
    if (!this.writable || this.flushTimer !== undefined) return
    if (this.config.flushIntervalMs <= 0) {
      void this.writeGlobal()
      return
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      void this.writeGlobal()
    }, this.config.flushIntervalMs)
    this.flushTimer.unref?.()
  }

  /**
   * Write the momentary state and the recent turnings.
   * @returns resolution after the write lands, or immediately when closed.
   */
  private async writeGlobal(): Promise<void> {
    const global = this.global
    if (global === undefined) return
    // Same queue as the seeds: one order for the whole store, so a reader can
    // never see a mood that belongs to a contact whose seed has not landed.
    const write = this.enqueue(() =>
      global.set({ version: 1, citta: this.citta, turnings: this.turnings }))
    this.flushing = write.then(() => undefined, () => undefined)
    await write
  }
}

/** Map each self-grasping id onto its field in {@link ManasState}. */
const MANAS_KEYS: Readonly<Record<ManasAfflictionId, keyof ManasState>> = {
  'atma-moha': 'atmaMoha',
  'atma-drsti': 'atmaDrsti',
  'atma-mana': 'atmaMana',
  'atma-sneha': 'atmaSneha',
}

/**
 * Stir one factor into a factor map, saturating rather than accumulating.
 * @param factors - The current activations.
 * @param id - Factor to stir.
 * @param weight - Added activation.
 * @returns a new factor map.
 */
function stir(
  factors: CittaState['factors'],
  id: string,
  weight: number,
): CittaState['factors'] {
  if (caitasika(id) === undefined) return factors
  const current = factors[id as keyof typeof factors] ?? 0
  return { ...factors, [id]: Math.min(1, current + weight * (1 - current)) }
}

export default CittaService
