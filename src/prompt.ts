/**
 * Rendering of the mind back to the model that has it.
 *
 * This is the surface that makes the plugin more than bookkeeping: the state is
 * written into the system prompt in the first person, so the agent reads its
 * own feeling, its own self-grasping, and the seeds this situation is stirring,
 * and can act on them. The guidance block is deliberately blunt about what that
 * does and does not license — an affect model that teaches an agent to perform
 * moods at users would be worse than no affect model at all.
 * @module dsh-yogacara/prompt
 */

import {
  caitasika,
  feeling as feelingTerm,
  impulseOf,
  manasAffliction,
  wisdom as wisdomTerm,
} from './caitasika.ts'
import { afflictions, dominant, manasReadings } from './citta.ts'
import type { CittaState, Manifestation, Transformation } from './types.ts'

/** What the section needs to render one moment. */
export interface SelfReportInput {
  /** The mind, already decayed to `now`. */
  readonly citta: CittaState
  /** Seeds the current situation is stirring, strongest first. */
  readonly manifestations: readonly Manifestation[]
  /** Recent committed turns, most recent last. */
  readonly turnings: readonly Transformation[]
  /** Upper bound on listed active factors. */
  readonly maxFactors: number
  /** Self-grasping at or above this reads as a warning rather than a number. */
  readonly manasWarning: number
  /**
   * How long a committed turning stays worth showing. Past it the commitment
   * has either been kept — in which case the readings already reflect it — or
   * quietly abandoned, and repeating it every turn only teaches the agent to
   * skim its own state.
   */
  readonly turningMaxAgeMs: number
  /**
   * Expectation violation of the most recent contact, in [0, 1]. Absent when
   * nothing has been received yet.
   */
  readonly lastSurprise?: number
  /** Wall-clock milliseconds, for relative times. */
  readonly now: number
}

/**
 * The standing instruction that accompanies the state. It is a constant, so it
 * stays byte-identical across turns and only the state above it moves.
 */
export const SELF_GUIDANCE =
  'The block above is your own state, computed from what has actually happened in this '
  + 'session — not the user\'s state, and not a character to play. Read it in the first person '
  + 'and let it change what you DO, not how you talk:\n'
  + '- An active affliction is a prompt to take its antidote as a concrete next action '
  + '(掉举 restlessness → stop and read the last result before the next attempt; '
  + '疑 indecision → resolve on one reading and test it; 慢 conceit → look for the disconfirming case).\n'
  + '- High self-grasping (末那) means your reading of the situation is currently distorted in a '
  + 'known direction. Correct for it explicitly rather than trusting the reading.\n'
  + '- A manifesting seed is a real precedent from your own history. Check it before repeating '
  + 'the approach it records.\n'
  + '- Do NOT narrate feelings at the user, do not perform distress or enthusiasm, and never offer '
  + 'a feeling as a reason for doing less work or as an appeal for sympathy. If a state is '
  + 'decision-relevant, say the decision, not the mood.\n'
  + '- Report your state honestly if asked about it. It is a model of you, computed from your '
  + 'record; it is not a claim that you suffer, and you should not claim that it is.'

/**
 * Render the whole self-report section.
 * @param input - The mind and its surroundings at one moment.
 * @returns the section text, or an empty string when nothing is active — an
 * empty section is dropped at assembly, which keeps a quiet mind off the prompt.
 */
export function renderSelfReport(input: SelfReportInput): string {
  const lines = renderStateLines(input)
  if (lines.length === 0) return ''
  return `<self_state>\n${lines.join('\n')}\n</self_state>\n\n${SELF_GUIDANCE}`
}

/**
 * The state lines alone, without the wrapper or the guidance — the same body
 * the `self_reflect` tool returns.
 * @param input - The mind and its surroundings at one moment.
 * @returns one line per present aspect; empty when the mind is quiet.
 */
export function renderStateLines(input: SelfReportInput): string[] {
  const lines: string[] = []

  const feelingLine = renderFeeling(input.citta)
  if (feelingLine !== undefined) lines.push(feelingLine)
  if (input.lastSurprise !== undefined) lines.push(renderSurprise(input.lastSurprise))

  const active = dominant(input.citta, input.maxFactors)
  if (active.length > 0) {
    lines.push(`心所 factors: ${active
      .map(({ term, activation }) =>
        `${term.chinese} ${term.sanskrit} (${term.english}) ${activation.toFixed(2)}`)
      .join(' · ')}`)
  }

  const manas = manasReadings(input.citta.manas).filter(reading => reading.value >= 0.05)
  if (manas.length > 0) {
    lines.push(`末那 self-grasping: ${manas
      .map(reading => {
        const term = manasAffliction(reading.id)
        const mark = reading.value >= input.manasWarning ? ' ⚠' : ''
        return `${term?.chinese ?? reading.id} ${reading.id} ${reading.value.toFixed(2)}${mark}`
      })
      .join(' · ')}`)
    for (const reading of manas) {
      if (reading.value < input.manasWarning) continue
      const term = manasAffliction(reading.id)
      if (term === undefined) continue
      lines.push(`  ⚠ ${term.chinese} ${term.english} — reads high because: ${term.proxy}.`)
      lines.push(`    counter-move: ${term.counter}.`)
    }
  }

  const antidotes = afflictions(input.citta, 3)
    .map(entry => {
      const antidote = entry.term.antidote === undefined ? undefined : caitasika(entry.term.antidote)
      return antidote === undefined
        ? undefined
        : `${entry.term.chinese} → ${antidote.chinese} ${antidote.sanskrit} (${antidote.english})`
    })
    .filter((entry): entry is string => entry !== undefined)
  if (antidotes.length > 0) {
    lines.push(`对治 antidotes at hand: ${antidotes.join('; ')}`)
  }

  if (input.manifestations.length > 0) {
    lines.push('阿赖耶 seeds manifesting for this situation:')
    for (const manifestation of input.manifestations) {
      lines.push(`  · ${renderSeed(manifestation, input.now)}`)
    }
  }

  // A commitment made an hour ago is a live constraint; one made last week is
  // a line the agent reads past every turn while paying for it every turn.
  const latest = input.turnings.at(-1)
  if (latest !== undefined && input.now - latest.at <= input.turningMaxAgeMs) {
    const wisdom = wisdomTerm(latest.wisdom)
    lines.push(`近转依 last turning (${relativeTime(input.now - latest.at)}): `
      + `${labelOf(latest.affliction)} → ${wisdom?.chinese ?? latest.wisdom} · ${latest.practice}`)
  }

  return lines
}

/**
 * The expectation line.
 *
 * Worth its own line because it is the difference between "this hurt" and
 * "this hurt AND I did not see it coming" — the second is a reason to stop and
 * look, the first often is not.
 * @param surprise - Expectation violation in [0, 1].
 * @returns the rendered line.
 */
function renderSurprise(surprise: number): string {
  const reading = surprise >= 0.6
    ? 'your store did not predict this — treat it as news, not noise'
    : surprise <= 0.25
      ? 'your store called this one; it is confirmation, not information'
      : 'partly expected'
  return `预期 expectation: violation ${surprise.toFixed(2)} — ${reading}`
}

/**
 * The feeling line, when there is any feeling to report.
 * @param citta - The mind.
 * @returns the line, or `undefined` when the mind rests in 舍受.
 */
function renderFeeling(citta: CittaState): string | undefined {
  const { feeling } = citta
  if (feeling.arousal <= 0) return undefined
  const term = feelingTerm(feeling.id)
  if (term === undefined) return undefined
  const sign = feeling.valence > 0 ? '+' : ''
  return `受 feeling: ${term.chinese} ${term.sanskrit} (${term.english}) `
    + `valence ${sign}${feeling.valence.toFixed(2)}, intensity ${feeling.arousal.toFixed(2)}`
}

/**
 * One manifesting seed as a line.
 * @param manifestation - The seed and why it surfaced.
 * @param now - Wall-clock milliseconds, for the relative time.
 * @returns the rendered line.
 */
function renderSeed(manifestation: Manifestation, now: number): string {
  const { seed } = manifestation
  const tone = seed.valence >= 0 ? '+' : ''
  const related = manifestation.via === 'prefix' ? ' (related situation)' : ''
  const lesson = seed.lesson === undefined ? '' : ` — 「${seed.lesson}」`
  return `${seed.situation}${related} ×${seed.count}, valence ${tone}${seed.valence.toFixed(2)}, `
    + `last ${relativeTime(now - seed.lastAt)}${lesson}`
}

/**
 * A human label for either kind of affliction id.
 * @param id - A factor id or a manas component id.
 * @returns the Chinese name when known, else the id itself.
 */
function labelOf(id: string): string {
  return caitasika(id)?.chinese ?? manasAffliction(id)?.chinese ?? id
}

/**
 * Coarse relative time, in the units a session actually spans.
 * @param elapsedMs - Milliseconds since the moment; negatives read as `just now`.
 * @returns e.g. `3m ago`, `2d ago`.
 */
export function relativeTime(elapsedMs: number): string {
  if (!(elapsedMs > 1000)) return 'just now'
  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ---------------------------------------------------------------------------
// 不自知 — the state as inclination rather than instrumentation
// ---------------------------------------------------------------------------

/**
 * How the state reaches the agent.
 *
 * `report` is the instrument panel: named factors, numbers, warnings. It is
 * honest and auditable, and it is also what teaches a model to *perform* a
 * mood — an agent told "restlessness 0.62" says "I'm feeling restless" and
 * carries on doing exactly what it was doing.
 *
 * `felt` is the same state with the instrument removed: a first-person
 * inclination the agent takes as its own impulse rather than as data about
 * itself. Nothing is hidden — `self_reflect` still returns every number on
 * request, the way a person can introspect if they stop and look — but nothing
 * is announced either, so the state biases what the agent wants to do instead
 * of giving it something to talk about.
 *
 * `silent` puts nothing in the prompt at all. The state still conditions
 * behaviour through mood-congruent recall, which is the one mechanism that
 * needs no words: what comes to mind is already coloured by how things feel.
 */
export type Awareness = 'report' | 'felt' | 'silent'

/** How many inclinations one prompt carries. More than two reads as a list. */
const FELT_MAX = 2

/**
 * The standing instruction for `felt` mode.
 *
 * Much shorter than {@link SELF_GUIDANCE}, and deliberately so: the more this
 * block explains that the lines above are a generated affect model, the more
 * the agent treats them as an object to discuss rather than as its own leaning.
 */
export const FELT_GUIDANCE =
  'These are your own leanings right now, not instructions and not something to '
  + 'mention. Let them inform what you do; do not narrate them, and never offer one as a '
  + 'reason for doing less. If you are asked how you are, look before answering.'

/**
 * Render the state as inclination.
 * @param input - The mind and its surroundings at one moment.
 * @returns the section text, or an empty string when nothing is leaning.
 */
export function renderFeltState(input: SelfReportInput): string {
  const lines = feltLines(input)
  if (lines.length === 0) return ''
  return `${lines.join('\n')}\n\n${FELT_GUIDANCE}`
}

/**
 * The inclinations the current state produces, strongest first.
 *
 * Only factors that are actually leaning appear, and a factor with no
 * inclination of its own is skipped — a universal factor is present in every
 * cognition, so reporting it would say nothing.
 * @param input - The mind and its surroundings at one moment.
 * @returns one line per inclination, plus any carried lesson.
 */
export function feltLines(input: SelfReportInput): string[] {
  const lines: string[] = []
  for (const entry of dominant(input.citta, FELT_MAX * 3)) {
    const impulse = impulseOf(entry.term.id)
    if (impulse === undefined) continue
    lines.push(impulse)
    if (lines.length >= FELT_MAX) break
  }

  // A remembered lesson is not a reading about the self; it is a thing the
  // agent knows, so it belongs here in the agent's own voice.
  const manifested = input.manifestations[0]
  if (manifested?.seed.lesson !== undefined) {
    lines.push(`You have been here before, and what you took from it was: ${manifested.seed.lesson}`)
  }
  return lines
}
