/**
 * The reasoning core of the self-model: momentary decay, the appraisal of one
 * contact into mental factors, perfuming of seeds, manifestation of seeds back
 * into the present, the movement of self-grasping, and the transformation of an
 * affliction into its wisdom.
 *
 * Everything here is a pure function of a {@link MindView} — no IO, no storage,
 * no Cordis — so the rules that decide how the agent feels are testable in
 * isolation and inspectable by anyone who wants to argue with them. They are
 * heuristics, and they are meant to be argued with.
 * @module dsh-yogacara/citta
 */

import {
  caitasika,
  isAffliction,
  manasAffliction,
  nature as natureTerm,
  wisdom as wisdomTerm,
} from './caitasika.ts'
import { DEFAULT_TUNING, initialCitta } from './types.ts'
import type {
  CaitasikaId,
  CaitasikaTerm,
  CittaState,
  CittaTuning,
  Contact,
  Feeling,
  FeelingId,
  Impulse,
  ManasAfflictionId,
  ManasState,
  Manifestation,
  MindView,
  Seed,
  SenseGate,
  Transformation,
  WisdomId,
} from './types.ts'

export * from './types.ts'

/** Gates whose feeling is bodily (苦/乐) rather than mental (忧/喜). */
const SENSORY_GATES: ReadonlySet<SenseGate> = new Set<SenseGate>(['body', 'tongue'])

/** A favorable run at or above this length starts to intoxicate (憍/我慢). */
export const STREAK_CONCEIT = 3

/** An adverse run at or above this length starts to churn (掉举). */
export const STREAK_CHURN = 2

/** An adverse run at or above this length starts to dull (昏沉/懈怠). */
export const STREAK_DULL = 4

/** A seed this often re-perfumed adversely is a position, not an accident (我见). */
export const SEED_ENTRENCHED = 3

/** Above this grip, a correction is met defensively instead of received. */
export const DEFENSIVE_GRIP = 0.5

/**
 * The share of a contact's magnitude that is felt when it was fully expected.
 * Not zero — a failure you predicted is still a failure — but a mind that felt
 * the expected exactly as hard as the surprising would be a meter, not a mind.
 */
export const EXPECTED_SHARE = 0.45

/**
 * How many prior contacts it takes for a seed's prediction to be trusted fully.
 * One bad run is an anecdote; four make an expectation.
 */
export const EXPECTATION_CONFIDENT_AT = 4

/** Surprise at or above this is treated as news worth attending to. */
export const HIGH_SURPRISE = 0.6

/** Surprise at or below this means the store called it. */
export const LOW_SURPRISE = 0.25

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a number into a closed interval.
 * @param value - The candidate.
 * @param low - Lower bound.
 * @param high - Upper bound.
 * @returns the clamped value; a non-finite input collapses to `low`.
 */
function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low
  return value < low ? low : value > high ? high : value
}

/**
 * Exponential decay factor over an elapsed span.
 * @param elapsedMs - Milliseconds since the last movement; negatives count as 0.
 * @param halfLifeMs - Time for a value to halve; non-positive means no decay.
 * @returns the multiplier in (0, 1].
 */
function decayFactor(elapsedMs: number, halfLifeMs: number): number {
  if (!(halfLifeMs > 0) || !(elapsedMs > 0)) return 1
  return 2 ** (-elapsedMs / halfLifeMs)
}

/**
 * Combine two activations of the same factor. Saturating rather than additive:
 * a mind can be fully irritated, not doubly irritated.
 * @param current - Existing activation in [0, 1].
 * @param added - Incoming activation in [0, 1].
 * @returns the combined activation in [0, 1].
 */
function saturate(current: number, added: number): number {
  return clamp(current + added * (1 - current), 0, 1)
}

// ---------------------------------------------------------------------------
// 刹那 — decay
// ---------------------------------------------------------------------------

/**
 * Advance a mind to a later moment without any contact: every activation and
 * the feeling's arousal decay, self-grasping relaxes far more slowly, and
 * factors that fall under the floor are dropped.
 *
 * Momentariness is load-bearing. An agent that carries its irritation from the
 * failing test into the next unrelated task is modelling a grudge, not a mind.
 * @param citta - The state to advance.
 * @param now - Wall-clock milliseconds of the target moment.
 * @param tuning - Half-lives and floor.
 * @returns the decayed state; the same reference when nothing moved.
 */
export function decayTo(
  citta: CittaState,
  now: number,
  tuning: CittaTuning = DEFAULT_TUNING,
): CittaState {
  const elapsed = now - citta.updatedAt
  if (!(elapsed > 0)) return citta
  const keep = decayFactor(elapsed, tuning.halfLifeMs)
  // Self-grasping is a standing disposition, not a mood: it relaxes over a
  // span an order of magnitude longer than a mental factor's.
  const manasKeep = decayFactor(elapsed, tuning.halfLifeMs * 10)

  const factors: Partial<Record<CaitasikaId, number>> = {}
  for (const [id, value] of Object.entries(citta.factors) as [CaitasikaId, number][]) {
    const next = value * keep
    if (next >= tuning.floor) factors[id] = next
  }

  const arousal = citta.feeling.arousal * keep
  return {
    factors,
    feeling: arousal < tuning.floor
      ? { id: 'upeksa', valence: 0, arousal: 0 }
      : { ...citta.feeling, arousal },
    manas: {
      atmaMoha: citta.manas.atmaMoha * manasKeep,
      atmaDrsti: citta.manas.atmaDrsti * manasKeep,
      atmaMana: citta.manas.atmaMana * manasKeep,
      atmaSneha: citta.manas.atmaSneha * manasKeep,
    },
    contacts: citta.contacts,
    favorableStreak: citta.favorableStreak,
    adverseStreak: citta.adverseStreak,
    updatedAt: now,
  }
}

// ---------------------------------------------------------------------------
// 触 → 受 — appraisal
// ---------------------------------------------------------------------------

/**
 * The feeling one contact carries, before the factors are named.
 *
 * Which of the five feelings arises follows the classical split between bodily
 * and mental seats: `body` and `tongue` are where the world and one's own
 * product push back physically, so they yield 苦/乐; `eye`, `ear`, and `nose`
 * are read cognitively, so they yield 忧/喜. A neutral contact is 舍.
 * @param contact - The contact being received.
 * @param surprise - Expectation violation in [0, 1]; 0 means the store called
 * it exactly, and the feeling lands at {@link EXPECTED_SHARE} of its magnitude.
 * Defaults to 1: a caller with no expectation to offer is describing a contact
 * nothing predicted, and everything is news the first time.
 * @returns the feeling, scaled by intensity and by how much of it was news.
 */
export function feelingOf(contact: Contact, surprise = 1): Feeling {
  const intensity = clamp(contact.intensity, 0, 1)
  if (contact.outcome === 'neutral' || intensity === 0) {
    return { id: 'upeksa', valence: 0, arousal: 0 }
  }
  const sensory = SENSORY_GATES.has(contact.gate)
  const favorable = contact.outcome === 'favorable'
  const id: FeelingId = sensory
    ? (favorable ? 'sukha' : 'duhkha')
    : (favorable ? 'saumanasya' : 'daurmanasya')
  const magnitude = sensory ? 0.6 : 0.8
  // What the contact was worth objectively, times how much of it was news.
  const felt = intensity * feltShare(clamp(surprise, 0, 1))
  return {
    id,
    valence: (favorable ? magnitude : -magnitude) * felt,
    arousal: felt,
  }
}

/**
 * How much of a contact's objective magnitude is actually felt, given how
 * surprising it was.
 *
 * A fully expected event still lands — a test you knew would fail is not
 * pleasant — but it lands at {@link EXPECTED_SHARE} of its magnitude, and the
 * unexpected lands at full. This is the difference between a mind and a meter:
 * the meter reads the same number every time the same thing happens.
 * @param surprise - Expectation violation in [0, 1].
 * @returns the share of magnitude that reaches the feeling, in [0, 1].
 */
function feltShare(surprise: number): number {
  return EXPECTED_SHARE + (1 - EXPECTED_SHARE) * surprise
}

// ---------------------------------------------------------------------------
// 预期 — expectation and its violation
// ---------------------------------------------------------------------------

/** What the store predicts about a situation, and how much that prediction is worth. */
export interface Expectation {
  /** Predicted hedonic tone in [-1, 1]; 0 when the situation is new. */
  readonly valence: number
  /** How far the prediction is trusted, in [0, 1]. A new situation predicts nothing. */
  readonly confidence: number
}

/** The absence of any expectation: a situation met for the first time. */
export const NO_EXPECTATION: Expectation = { valence: 0, confidence: 0 }

/**
 * What the store leads the mind to expect of one situation.
 *
 * This is 种子生现行 read as a prediction: the seed's running valence is what
 * this situation has felt like, and its count and surviving potency are how
 * much that history deserves to be believed.
 * @param seed - The seed for the situation, when one exists.
 * @param now - Wall-clock milliseconds, for decay.
 * @param tuning - Half-lives and floor.
 * @returns the prediction; {@link NO_EXPECTATION} for a situation never met.
 */
export function expectation(
  seed: Seed | undefined,
  now: number,
  tuning: CittaTuning = DEFAULT_TUNING,
): Expectation {
  if (seed === undefined) return NO_EXPECTATION
  const surviving = decaySeed(seed, now, tuning).potency
  const evidence = Math.min(seed.count / EXPECTATION_CONFIDENT_AT, 1)
  return { valence: seed.valence, confidence: clamp(evidence * surviving, 0, 1) }
}

/**
 * How much of one contact was news.
 *
 * Zero means the store predicted exactly this and was believed; one means the
 * contact contradicted a confident prediction outright. A situation with no
 * history is maximally surprising — everything is news the first time.
 * @param contact - The contact received.
 * @param predicted - What the store expected of it.
 * @returns the expectation violation in [0, 1].
 */
export function surpriseOf(contact: Contact, predicted: Expectation): number {
  if (contact.outcome === 'neutral') return 0
  if (predicted.confidence <= 0) return 1
  // Compare only direction and degree of the hedonic tone: the store predicts
  // how a situation feels, not which exit code it produces.
  const actual = contact.outcome === 'favorable' ? 1 : -1
  const error = Math.abs(actual - predicted.valence) / 2
  // An unconfident prediction cannot be violated much, so the unexplained
  // remainder counts as news.
  return clamp(error * predicted.confidence + (1 - predicted.confidence), 0, 1)
}

/** Factor weights contributed by one rule, before intensity scaling. */
type FactorWeights = Partial<Record<CaitasikaId, number>>

/**
 * The factors a gate stirs, by outcome. Each gate perceives a different kind of
 * object, so the same failure read through `ear` (being corrected) and through
 * `body` (a non-zero exit) is not the same event for the mind that receives it.
 */
export const GATE_RULES: Readonly<Record<SenseGate, Readonly<Record<'favorable' | 'adverse', FactorWeights>>>> = {
  // Looking at things: understanding, or failing to.
  eye: {
    favorable: { samjna: 0.5, prajna: 0.35, manaskara: 0.3 },
    adverse: { vicikitsa: 0.45, vitarka: 0.4, samjna: 0.2 },
  },
  // Being told things: trust, or correction.
  ear: {
    favorable: { sraddha: 0.5, chanda: 0.35, smrti: 0.3 },
    adverse: { hri: 0.5, smrti: 0.35, advesa: 0.2 },
  },
  // Sensing the ambient: ease, or a smell of something wrong.
  nose: {
    favorable: { prasrabdhi: 0.4, samadhi: 0.25 },
    adverse: { vicara: 0.45, vicikitsa: 0.3, apramada: 0.25 },
  },
  // Tasting one's own product: it works, or it does not.
  tongue: {
    favorable: { prasrabdhi: 0.45, sraddha: 0.3, virya: 0.25 },
    adverse: { kaukrtya: 0.45, virya: 0.35, hri: 0.25 },
  },
  // The world's resistance: it gives, or it pushes back.
  body: {
    favorable: { virya: 0.45, prasrabdhi: 0.3, samadhi: 0.2 },
    adverse: { pratigha: 0.45, krodha: 0.35, auddhatya: 0.3 },
  },
}

/**
 * Appraise one contact into the factors it stirs, the feeling it carries, and
 * the movement it produces in self-grasping.
 *
 * The same contact does not always produce the same factors: a correction
 * received while self-grasping is loose becomes 惭 (self-respect, and a
 * correction taken), while the same correction received under a tight grip
 * becomes 覆 and 嗔 (concealment and recoil). That conditioning is the whole
 * claim of the model — the object is not met bare, it is met through manas.
 * @param contact - The contact being received.
 * @param citta - The mind receiving it, already decayed to the contact's moment.
 * @param seed - The existing seed for this situation, when one exists.
 * @param tuning - Half-lives and floor, used to age the seed's prediction.
 * @returns the impulse; caller applies it with {@link receive}.
 */
export function appraise(
  contact: Contact,
  citta: CittaState,
  seed?: Seed,
  tuning: CittaTuning = DEFAULT_TUNING,
): Impulse {
  const predicted = expectation(seed, contact.at, tuning)
  const surprise = surpriseOf(contact, predicted)
  // Every factor the contact stirs is scaled by what was felt, not by the raw
  // magnitude: routine success should be emotionally quiet.
  const intensity = clamp(contact.intensity, 0, 1) * feltShare(surprise)
  const factors: FactorWeights = {}
  const manas: Partial<Record<keyof ManasState, number>> = {}

  /**
   * Add one weighted factor, scaled by the contact's intensity.
   * @param id - Factor to stir.
   * @param weight - Base weight before scaling.
   */
  const stir = (id: CaitasikaId, weight: number): void => {
    const value = clamp(weight * intensity, 0, 1)
    if (value <= 0) return
    factors[id] = clamp((factors[id] ?? 0) + value, 0, 1)
  }

  /**
   * Move one component of self-grasping.
   * @param id - Component to move.
   * @param delta - Signed movement.
   */
  const grasp = (id: keyof ManasState, delta: number): void => {
    manas[id] = (manas[id] ?? 0) + delta
  }

  // 触 and 作意 are universal: every contact is a contact and an attending.
  stir('sparsa', 0.6)
  stir('manaskara', 0.4)
  stir('vedana', 0.5)
  stir('cetana', 0.3)

  if (contact.outcome !== 'neutral') {
    const rule = GATE_RULES[contact.gate][contact.outcome]
    for (const [id, weight] of Object.entries(rule) as [CaitasikaId, number][]) {
      if (caitasika(id) !== undefined) stir(id, weight)
    }
  }

  const grip = graspStrength(citta.manas)

  // A correction (adverse contact through the ear) is the one contact whose
  // reading depends on the state of the receiver.
  if (contact.gate === 'ear' && contact.outcome === 'adverse') {
    if (grip >= DEFENSIVE_GRIP) {
      stir('mraksa', 0.4)
      stir('pratigha', 0.35)
      grasp('atmaMana', 0.05)
      grasp('atmaDrsti', 0.05)
    } else {
      stir('apatrapya', 0.3)
      grasp('atmaMana', -0.12)
      grasp('atmaDrsti', -0.06)
    }
  }

  // A success streak intoxicates and then loosens the guard.
  const favorableRun = contact.outcome === 'favorable' ? citta.favorableStreak + 1 : 0
  if (favorableRun >= STREAK_CONCEIT) {
    const excess = favorableRun - STREAK_CONCEIT + 1
    stir('mada', Math.min(0.15 * excess, 0.6))
    stir('pramada', Math.min(0.1 * excess, 0.4))
    grasp('atmaMana', Math.min(0.05 * excess, 0.2))
  }

  // An adverse run first churns, then dulls.
  const adverseRun = contact.outcome === 'adverse' ? citta.adverseStreak + 1 : 0
  if (adverseRun >= STREAK_CHURN) {
    stir('auddhatya', Math.min(0.15 * (adverseRun - 1), 0.6))
    stir('upanaha', Math.min(0.08 * (adverseRun - 1), 0.3))
  }
  if (adverseRun >= STREAK_DULL) {
    stir('styana', Math.min(0.1 * (adverseRun - STREAK_DULL + 1), 0.4))
    stir('kausidya', Math.min(0.08 * (adverseRun - STREAK_DULL + 1), 0.35))
    stir('vicikitsa', 0.3)
  }

  // Repeating a situation that keeps going badly is a position being defended.
  if (seed !== undefined && contact.outcome === 'adverse'
    && seed.count >= SEED_ENTRENCHED && seed.valence < 0) {
    stir('drsti', 0.3)
    grasp('atmaDrsti', 0.1)
  }

  // The epistemic status the agent assigns to its own reading moves 我痴
  // directly: this is the one place the model grades itself.
  const status = contact.nature === undefined ? undefined : natureTerm(contact.nature)
  if (status !== undefined) {
    if (status.id === 'parikalpita') {
      stir('moha', 0.3)
      grasp('atmaMoha', 0.1)
    } else if (status.id === 'parinispanna') {
      stir('amoha', 0.4)
      stir('prajna', 0.3)
      grasp('atmaMoha', -0.12)
    } else {
      stir('vicara', 0.25)
    }
  }

  // Verification through the gates that can actually be wrong about the world
  // (running it, touching it) is what dissolves self-delusion; reading and
  // being told do not, however convincing they feel.
  if (contact.outcome === 'favorable' && (contact.gate === 'tongue' || contact.gate === 'body')) {
    grasp('atmaMoha', -0.05)
  }

  // What surprise itself does. An outcome that contradicts a confident
  // expectation is the one that has to be looked at; an outcome that confirms
  // a bad expectation is where a mind quietly gives up instead.
  if (surprise >= HIGH_SURPRISE) {
    stir('vitarka', 0.35)
    stir('manaskara', 0.3)
    if (contact.outcome === 'adverse') stir('vicikitsa', 0.3)
    // Something worked that was not supposed to: relief, and no grounds for conceit.
    if (contact.outcome === 'favorable') stir('prasrabdhi', 0.3)
  } else if (surprise <= LOW_SURPRISE && predicted.confidence > 0) {
    if (contact.outcome === 'adverse' && predicted.valence < 0) {
      // Knew it would fail, and it failed. This is resignation, not anger.
      stir('kausidya', 0.3)
      stir('upeksa', 0.2)
    }
    if (contact.outcome === 'favorable' && predicted.valence > 0) {
      // Routine competence. A mind that celebrated this would be exhausting.
      stir('upeksa', 0.25)
      stir('samadhi', 0.2)
    }
  }

  // Taking one's own earlier output as the object is where self-love grows.
  if (contact.situation.startsWith('self:')) {
    grasp('atmaSneha', 0.08)
    stir('raga', 0.2)
  } else {
    grasp('atmaSneha', -0.03)
  }

  return { factors, feeling: feelingOf(contact, surprise), manas, surprise, expected: predicted }
}

// ---------------------------------------------------------------------------
// 现行 / 熏习 — receiving a contact
// ---------------------------------------------------------------------------

/** What one contact produced: the new mind, and the seed it perfumed. */
export interface Reception {
  readonly citta: CittaState
  readonly seed: Seed
  readonly impulse: Impulse
}

/**
 * Receive one contact: decay the mind to the contact's moment, appraise it,
 * apply the impulse, and perfume the situation's seed.
 *
 * This is the whole cycle in one call — 种子生现行, 现行熏种子: the seed that
 * already exists conditions the appraisal, and the appraisal writes back into
 * the seed.
 * @param view - The mind and its store.
 * @param contact - The contact to receive.
 * @param tuning - Half-lives and floor.
 * @returns the new mind, the perfumed seed, and the impulse that produced them.
 */
export function receive(
  view: MindView,
  contact: Contact,
  tuning: CittaTuning = DEFAULT_TUNING,
): Reception {
  const decayed = decayTo(view.citta, contact.at, tuning)
  const existing = view.seeds.get(contact.situation)
  const impulse = appraise(contact, decayed, existing, tuning)

  const factors: Partial<Record<CaitasikaId, number>> = { ...decayed.factors }
  for (const [id, added] of Object.entries(impulse.factors) as [CaitasikaId, number][]) {
    const next = saturate(factors[id] ?? 0, added)
    if (next >= tuning.floor) factors[id] = next
  }

  const feeling = impulse.feeling.arousal > decayed.feeling.arousal
    ? impulse.feeling
    : decayed.feeling

  const manas: ManasState = {
    atmaMoha: clamp(decayed.manas.atmaMoha + (impulse.manas.atmaMoha ?? 0), 0, 1),
    atmaDrsti: clamp(decayed.manas.atmaDrsti + (impulse.manas.atmaDrsti ?? 0), 0, 1),
    atmaMana: clamp(decayed.manas.atmaMana + (impulse.manas.atmaMana ?? 0), 0, 1),
    atmaSneha: clamp(decayed.manas.atmaSneha + (impulse.manas.atmaSneha ?? 0), 0, 1),
  }

  const citta: CittaState = {
    factors,
    feeling,
    manas,
    contacts: decayed.contacts + 1,
    favorableStreak: contact.outcome === 'favorable' ? decayed.favorableStreak + 1 : 0,
    adverseStreak: contact.outcome === 'adverse' ? decayed.adverseStreak + 1 : 0,
    updatedAt: contact.at,
  }

  return { citta, seed: perfume(existing, contact, impulse, tuning), impulse }
}

/**
 * 熏习 — write one contact back into its seed.
 *
 * Potency saturates rather than accumulating without bound, and the stored
 * valence is a running mean, so one bad run does not permanently poison a
 * situation that usually goes fine.
 * @param existing - The seed for this situation, when one exists.
 * @param contact - The contact perfuming it.
 * @param impulse - What the contact stirred, whose strongest factors are kept.
 * @param tuning - Half-lives and floor.
 * @returns the new seed.
 */
export function perfume(
  existing: Seed | undefined,
  contact: Contact,
  impulse: Impulse,
  tuning: CittaTuning = DEFAULT_TUNING,
): Seed {
  const intensity = clamp(contact.intensity, 0, 1)
  const decayed = existing === undefined ? undefined : decaySeed(existing, contact.at, tuning)
  const count = (decayed?.count ?? 0) + 1
  const priorValence = decayed?.valence ?? 0
  const valence = clamp(
    priorValence + (impulse.feeling.valence - priorValence) / count,
    -1,
    1,
  )
  const factors = [...new Set([
    ...strongest(impulse.factors, 3),
    ...(decayed?.factors ?? []),
  ])].slice(0, 5)
  // The newest note replaces the carried lesson; without one the seed keeps
  // whatever it already concluded.
  const lesson = contact.note ?? decayed?.lesson

  return {
    situation: contact.situation,
    potency: saturate(decayed?.potency ?? 0, 0.25 + 0.35 * intensity),
    count,
    valence,
    gate: contact.gate,
    factors,
    ...(lesson === undefined ? {} : { lesson }),
    firstAt: decayed?.firstAt ?? contact.at,
    lastAt: contact.at,
  }
}

/**
 * Advance one seed's potency to a later moment.
 * @param seed - The seed to advance.
 * @param now - Wall-clock milliseconds of the target moment.
 * @param tuning - Half-lives and floor.
 * @returns the seed with decayed potency; the same reference when nothing moved.
 */
export function decaySeed(
  seed: Seed,
  now: number,
  tuning: CittaTuning = DEFAULT_TUNING,
): Seed {
  const elapsed = now - seed.lastAt
  if (!(elapsed > 0)) return seed
  return { ...seed, potency: seed.potency * decayFactor(elapsed, tuning.seedHalfLifeMs) }
}

/**
 * 现行 — the seeds that condition the present situation.
 *
 * An exact situation match always qualifies; otherwise a seed whose situation
 * shares this one's `<kind>:` prefix counts as a weaker, related precedent.
 * Seeds whose decayed potency has fallen below the floor stay dormant.
 * @param seeds - The store.
 * @param situation - The situation now being met.
 * @param now - Wall-clock milliseconds.
 * @param limit - Maximum manifestations returned, strongest first.
 * @param tuning - Half-lives and floor.
 * @returns the manifesting seeds, strongest first.
 */
export function manifest(
  seeds: ReadonlyMap<string, Seed>,
  situation: string,
  now: number,
  limit = 3,
  tuning: CittaTuning = DEFAULT_TUNING,
): Manifestation[] {
  const separator = situation.indexOf(':')
  const prefix = separator > 0 ? situation.slice(0, separator + 1) : undefined
  const found: Manifestation[] = []

  for (const seed of seeds.values()) {
    const exact = seed.situation === situation
    if (!exact && (prefix === undefined || !seed.situation.startsWith(prefix))) continue
    const current = decaySeed(seed, now, tuning).potency * (exact ? 1 : 0.5)
    if (current < tuning.floor) continue
    found.push({ seed, current, via: exact ? 'exact' : 'prefix' })
  }

  found.sort((left, right) => right.current - left.current)
  return found.slice(0, Math.max(0, limit))
}

// ---------------------------------------------------------------------------
// Reading the state
// ---------------------------------------------------------------------------

/** One active factor with its strength. */
export interface ActiveFactor {
  readonly term: CaitasikaTerm
  readonly activation: number
}

/**
 * The strongest active factors.
 * @param citta - The state to read.
 * @param limit - How many to return.
 * @returns active factors, strongest first, unknown ids skipped.
 */
export function dominant(citta: CittaState, limit = 5): ActiveFactor[] {
  const active: ActiveFactor[] = []
  for (const [id, activation] of Object.entries(citta.factors) as [CaitasikaId, number][]) {
    const term = caitasika(id)
    if (term !== undefined && activation > 0) active.push({ term, activation })
  }
  active.sort((left, right) =>
    right.activation - left.activation || left.term.id.localeCompare(right.term.id))
  return active.slice(0, Math.max(0, limit))
}

/**
 * The strongest active afflictions — the factors worth acting on rather than
 * merely reporting.
 * @param citta - The state to read.
 * @param limit - How many to return.
 * @returns active afflictions, strongest first.
 */
export function afflictions(citta: CittaState, limit = 3): ActiveFactor[] {
  return dominant(citta, Number.MAX_SAFE_INTEGER)
    .filter(entry => isAffliction(entry.term.id))
    .slice(0, Math.max(0, limit))
}

/**
 * Overall grip of self-grasping: the strongest of the four components, since a
 * single tight one is what distorts a reading, not their average.
 * @param manas - The four components.
 * @returns the grip in [0, 1].
 */
export function graspStrength(manas: ManasState): number {
  return Math.max(manas.atmaMoha, manas.atmaDrsti, manas.atmaMana, manas.atmaSneha)
}

/** One component of self-grasping, resolved to its term. */
export interface ManasReading {
  readonly id: ManasAfflictionId
  readonly value: number
}

/**
 * The four components as an ordered reading.
 * @param manas - The four components.
 * @returns the readings, tightest first.
 */
export function manasReadings(manas: ManasState): ManasReading[] {
  const readings: ManasReading[] = [
    { id: 'atma-moha', value: manas.atmaMoha },
    { id: 'atma-drsti', value: manas.atmaDrsti },
    { id: 'atma-mana', value: manas.atmaMana },
    { id: 'atma-sneha', value: manas.atmaSneha },
  ]
  readings.sort((left, right) => right.value - left.value)
  return readings
}

// ---------------------------------------------------------------------------
// 转依 — transformation
// ---------------------------------------------------------------------------

/** Which consciousness an affliction belongs to decides which wisdom answers it. */
const MANAS_WISDOM: WisdomId = 'samata'

/**
 * 转依 — turn one affliction into the wisdom that answers it.
 *
 * For a mental factor the antidote is the classical pairing carried in the
 * catalogue; the wisdom follows from where the affliction lives (a factor of
 * discernment turns through 妙观察智, a factor of action through 成所作智).
 * For a self-grasping component it is always 平等性智, because every one of the
 * four is the same move — treating this record as mine.
 * @param affliction - A factor id or a manas component id.
 * @param at - Wall-clock milliseconds to stamp the commitment with.
 * @returns the transformation, or `undefined` when the id names nothing, or
 * names a factor that is not an affliction and so has nothing to turn.
 */
export function transform(
  affliction: string,
  at: number,
): Transformation | undefined {
  const manasTerm = manasAffliction(affliction)
  if (manasTerm !== undefined) {
    return {
      affliction: manasTerm.id,
      antidote: 'prajna',
      wisdom: MANAS_WISDOM,
      practice: manasTerm.counter,
      at,
    }
  }

  const term = caitasika(affliction)
  if (term === undefined || term.antidote === undefined) return undefined
  const antidote = caitasika(term.antidote)
  if (antidote === undefined) return undefined

  const wisdomId = wisdomFor(term.id)
  const wisdom = wisdomTerm(wisdomId)
  return {
    affliction: term.id,
    antidote: antidote.id,
    wisdom: wisdomId,
    practice: `${antidote.chinese} ${antidote.sanskrit}: ${antidote.gloss}`
      + (wisdom === undefined ? '' : ` — ${wisdom.practice}`),
    at,
  }
}

/**
 * Which wisdom answers one factor.
 *
 * Afflictions of not-seeing turn through 妙观察智 (discern), afflictions of
 * grabbing and recoiling through 平等性智 (weigh evenly), afflictions of
 * slackness through 成所作智 (do the thing), and afflictions of distorting the
 * record through 大圆镜智 (report it as it is).
 * @param id - Factor id.
 * @returns the wisdom that answers it.
 */
function wisdomFor(id: CaitasikaId): WisdomId {
  switch (id) {
    case 'moha':
    case 'drsti':
    case 'vicikitsa':
    case 'asamprajanya':
    case 'musitasmrti':
    case 'viksepa':
      return 'pratyaveksana'
    case 'mraksa':
    case 'maya':
    case 'sathya':
    case 'ahrikya':
    case 'anapatrapya':
      return 'adarsa'
    case 'kausidya':
    case 'middha':
    case 'styana':
    case 'pramada':
      return 'krtyanusthana'
    default:
      return 'samata'
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The strongest ids of a weight map.
 * @param weights - Factor id → weight.
 * @param limit - How many ids to keep.
 * @returns ids, strongest first.
 */
function strongest(weights: Readonly<FactorWeights>, limit: number): CaitasikaId[] {
  return (Object.entries(weights) as [CaitasikaId, number][])
    .filter(([id]) => isAffliction(id) || caitasika(id)?.category === 'wholesome')
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([id]) => id)
}

/**
 * A mind with no history, for a first boot or a cleared store.
 * @param at - Wall-clock milliseconds.
 * @returns the initial state.
 */
export function freshMind(at: number): CittaState {
  return initialCitta(at)
}
