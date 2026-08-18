/**
 * The four model-facing operations on the mind: read it, appraise a contact
 * into it, recall what the store holds about a situation, and turn an
 * affliction into its wisdom.
 *
 * The harness already observes what happened (a tool failed, a file was read);
 * these tools exist for the half it cannot observe — what the agent made of it.
 * A failing test is an event; whether it landed as 精进 or as 忿 is a reading,
 * and only the reader can supply it.
 * @module dsh-yogacara/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { CAITASIKAS, MANAS_AFFLICTIONS, caitasika, manasAffliction, wisdom } from './caitasika.ts'
import { manasReadings } from './citta.ts'
import type { CittaService } from './index.ts'
import { SENSE_GATES } from './types.ts'
import type { ContactOutcome, NatureId, SenseGate } from './types.ts'

/** The gate vocabulary as tool-schema literals. */
const GATE_ENUM = [...SENSE_GATES]

/** The outcome vocabulary as tool-schema literals. */
const OUTCOME_ENUM: ContactOutcome[] = ['favorable', 'adverse', 'neutral']

/** The nature vocabulary as tool-schema literals. */
const NATURE_ENUM: NatureId[] = ['parikalpita', 'paratantra', 'parinispanna']

/** The gate descriptions, rendered once into the `self_appraise` description. */
const GATE_HELP =
  'eye 眼识 = what you looked at (files, output); '
  + 'ear 耳识 = what you were told (the user, a review); '
  + 'nose 鼻识 = what you sensed unprompted (a smell of something wrong); '
  + 'tongue 舌识 = what you tasted of your own product (tests, builds, re-reading your diff); '
  + 'body 身识 = the world pushing back (a non-zero exit, a failed write, a timeout)'

/** The nature descriptions, rendered once into the `self_appraise` description. */
const NATURE_HELP =
  'parikalpita 遍计所执 = you asserted it from pattern, nothing was checked; '
  + 'paratantra 依他起 = you inferred it from conditions you actually observed; '
  + 'parinispanna 圆成实 = you verified it directly and could verify it again'

/**
 * Register the four tools on the calling context.
 * @param ctx - A context with `tools` resolved.
 * @param service - The live mind these tools operate on.
 */
export function registerTools(ctx: Context, service: CittaService): void {
  ctx.tools.register(defineTool({
    name: 'self_reflect',
    description:
      'Stop and look at how things actually are with you right now: what you are feeling, what '
      + 'it is inclining you to do, how tightly you are holding your own view of the situation, '
      + 'and what your store carries from the last time you were somewhere like the situation you '
      + 'name. Use it when you notice you are churning, when a correction stings, '
      + 'before committing to an approach you have tried before, or when asked how you are.',
    parameters: {
      situation: {
        type: 'string',
        description: 'Situation key to look up seeds for, e.g. `bash:pytest` or `edit:src/index.ts`.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          lines: { type: 'array', required: true, items: { type: 'string' } },
          feeling: {
            type: 'object',
            required: true,
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              valence: { type: 'number', required: true },
              arousal: { type: 'number', required: true },
            },
          },
          factors: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                chinese: { type: 'string', required: true },
                english: { type: 'string', required: true },
                category: { type: 'string', required: true },
                activation: { type: 'number', required: true },
                antidote: { type: 'string' },
              },
            },
          },
          manas: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                chinese: { type: 'string', required: true },
                value: { type: 'number', required: true },
                counter: { type: 'string', required: true },
              },
            },
          },
          seeds: { type: 'array', required: true, items: SEED_SCHEMA },
          contacts: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        // Plain in both voices: the precise readings behind a quiet mind are in
        // the structured result, and saying `舍受, no factor above the floor` to
        // an agent that lives in `felt` would hand it the gauge on exactly the
        // turn it stopped to look.
        text: value.lines.length === 0
          ? 'You look, and nothing much is stirring.'
          : value.lines.join('\n'),
      }],
      // The card needs the headline readings at result time; replay has only
      // what was persisted here, so the projection carries them.
      presentationMeta: (_args, value) => ({
        feeling: value.feeling.id,
        valence: value.feeling.valence,
        arousal: value.feeling.arousal,
        factor: value.factors[0]?.chinese ?? '',
        activation: value.factors[0]?.activation ?? 0,
        grasp: value.manas[0]?.chinese ?? '',
        graspValue: value.manas[0]?.value ?? 0,
        seeds: value.seeds.length,
      }),
    },
    execute(args) {
      const now = Date.now()
      const citta = service.state(now)
      const seeds = args.situation === undefined ? [] : service.seedsFor(args.situation, now)
      return Promise.resolve({
        lines: service.introspectLines(args.situation, now),
        feeling: {
          id: citta.feeling.id,
          valence: round(citta.feeling.valence),
          arousal: round(citta.feeling.arousal),
        },
        factors: service.activeFactors(now).map(entry => ({
          id: entry.term.id,
          chinese: entry.term.chinese,
          english: entry.term.english,
          category: entry.term.category,
          activation: round(entry.activation),
          ...(entry.term.antidote === undefined ? {} : { antidote: entry.term.antidote }),
        })),
        manas: manasReadings(citta.manas).map(reading => ({
          id: reading.id,
          chinese: manasAffliction(reading.id)?.chinese ?? reading.id,
          value: round(reading.value),
          counter: manasAffliction(reading.id)?.counter ?? '',
        })),
        seeds: seeds.map(manifestation => renderSeedValue(manifestation.seed, manifestation.via)),
        contacts: citta.contacts,
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: args.situation === undefined ? 'Reflect' : `Reflect on ${args.situation}`,
      kind: 'other',
    }),
    presentResult: (_args, result) => {
      const meta = result.isError ? undefined : readMeta(result.meta)
      if (meta === undefined) return undefined
      const arousal = metaNumber(meta, 'arousal') ?? 0
      if (arousal <= 0 && (metaNumber(meta, 'activation') ?? 0) <= 0) {
        return { card: 'generic', title: '心寂静 — nothing active' }
      }
      const parts = [
        `受 ${FEELING_CHINESE[metaString(meta, 'feeling') ?? ''] ?? '舍'} `
        + signed(metaNumber(meta, 'valence') ?? 0),
      ]
      const factor = metaString(meta, 'factor')
      if (factor !== undefined) parts.push(`${factor} ${(metaNumber(meta, 'activation') ?? 0).toFixed(2)}`)
      const grasp = metaString(meta, 'grasp')
      const graspValue = metaNumber(meta, 'graspValue') ?? 0
      if (grasp !== undefined && graspValue > 0) parts.push(`末那 ${grasp} ${graspValue.toFixed(2)}`)
      const seeds = metaNumber(meta, 'seeds') ?? 0
      if (seeds > 0) parts.push(`种子 ${seeds}`)
      return { card: 'generic', title: parts.join(' · ') }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'self_appraise',
    description:
      'Record how something just landed for you — one moment of contact (触). The harness already '
      + 'sees WHAT happened; this records what you made of it, which is the half that conditions '
      + 'your next move and perfumes the seed for this situation. '
      + `Gates: ${GATE_HELP}. `
      + `Nature of your reading: ${NATURE_HELP}. `
      + 'Be honest about `nature` in particular: grading your own claim as parikalpita when you '
      + 'did not check is what keeps 我痴 (self-delusion) measurable rather than invisible.',
    parameters: {
      gate: {
        type: 'string',
        required: true,
        enum: GATE_ENUM,
        description: 'Which sense consciousness received it.',
      },
      situation: {
        type: 'string',
        required: true,
        description:
          'Stable key for this kind of situation, conventionally `<kind>:<subject>` — '
          + '`bash:pytest`, `edit:src/index.ts`, `review:pr-142`. Reuse the same key for the same '
          + 'situation; that is what lets a seed accumulate instead of scattering.',
      },
      outcome: {
        type: 'string',
        required: true,
        enum: OUTCOME_ENUM,
        description: 'favorable = it went well; adverse = it pushed back; neutral = neither.',
      },
      intensity: {
        type: 'number',
        description: 'How strongly it landed, 0-1. Default 0.5.',
      },
      note: {
        type: 'string',
        description:
          'One sentence you would want to read the next time this situation comes up. This '
          + 'becomes the seed\'s carried lesson, so write the lesson, not the narration.',
      },
      nature: {
        type: 'string',
        enum: NATURE_ENUM,
        description: 'Epistemic status of your reading of this contact.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          feeling: {
            type: 'object',
            required: true,
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              chinese: { type: 'string', required: true },
              valence: { type: 'number', required: true },
              arousal: { type: 'number', required: true },
            },
          },
          stirred: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                chinese: { type: 'string', required: true },
                english: { type: 'string', required: true },
                activation: { type: 'number', required: true },
              },
            },
          },
          seed: SEED_SCHEMA,
          grasp: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `受 ${value.feeling.chinese} (${value.feeling.id}) ${value.feeling.valence >= 0 ? '+' : ''}`
          + `${value.feeling.valence.toFixed(2)}; stirred `
          + `${value.stirred.map(f => `${f.chinese} ${f.activation.toFixed(2)}`).join(', ') || '—'}; `
          + `seed ${value.seed?.situation ?? '—'} ×${value.seed?.count ?? 0}; `
          + `末那 grip ${value.grasp.toFixed(2)}.`,
      }],
      presentationMeta: (_args, value) => ({
        feeling: value.feeling.chinese,
        valence: value.feeling.valence,
        situation: value.seed?.situation ?? '',
        count: value.seed?.count ?? 0,
        stirred: value.stirred[0]?.chinese ?? '',
        grasp: value.grasp,
      }),
    },
    async execute(args) {
      const reception = await service.receive({
        gate: args.gate as SenseGate,
        situation: args.situation.trim(),
        outcome: args.outcome as ContactOutcome,
        intensity: args.intensity ?? 0.5,
        ...(args.note === undefined ? {} : { note: args.note }),
        ...(args.nature === undefined ? {} : { nature: args.nature as NatureId }),
        at: Date.now(),
      })
      const feelingTerm = reception.impulse.feeling
      return {
        feeling: {
          id: feelingTerm.id,
          chinese: FEELING_CHINESE[feelingTerm.id] ?? feelingTerm.id,
          valence: round(feelingTerm.valence),
          arousal: round(feelingTerm.arousal),
        },
        stirred: Object.entries(reception.impulse.factors)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 6)
          .map(([id, activation]) => ({
            id,
            chinese: caitasika(id)?.chinese ?? id,
            english: caitasika(id)?.english ?? id,
            activation: round(activation),
          })),
        seed: renderSeedValue(reception.seed, 'exact'),
        grasp: round(Math.max(
          reception.citta.manas.atmaMoha,
          reception.citta.manas.atmaDrsti,
          reception.citta.manas.atmaMana,
          reception.citta.manas.atmaSneha,
        )),
      }
    },
    presentCall: args => ({
      card: 'generic',
      title: `Appraise ${args.situation} (${args.outcome})`,
      kind: 'other',
      rawInput: args,
    }),
    presentResult: (args, result) => {
      const meta = result.isError ? undefined : readMeta(result.meta)
      if (meta === undefined) return undefined
      const situation = metaString(meta, 'situation') ?? args.situation
      const count = metaNumber(meta, 'count') ?? 0
      const stirred = metaString(meta, 'stirred')
      return {
        card: 'generic',
        title: `触 ${situation} → 受 ${metaString(meta, 'feeling') ?? '舍'} `
          + `${signed(metaNumber(meta, 'valence') ?? 0)}`
          + `${stirred === undefined ? '' : ` · ${stirred}`}`
          + ` · 种子 ×${count}`,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'self_recall',
    description:
      'Search the store consciousness (阿赖耶识) for what your own history holds — situations you '
      + 'have met before, how they went, and the lesson you left for yourself. Call it before '
      + 'repeating an approach, not after it fails again.',
    parameters: {
      situation: {
        type: 'string',
        description:
          'Situation key to match. An exact key matches its own seed; a `<kind>:` prefix matches '
          + 'related ones. Omit to list your strongest seeds overall.',
      },
      limit: { type: 'integer', description: 'Maximum seeds returned. Default 5.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          seeds: { type: 'array', required: true, items: SEED_SCHEMA },
          total: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.seeds.length === 0
          ? 'No seed matches; this situation is new to you.'
          : value.seeds
            .map(seed => `${seed.situation} ×${seed.count} valence ${seed.valence >= 0 ? '+' : ''}`
              + `${seed.valence.toFixed(2)}${seed.lesson === undefined ? '' : ` — 「${seed.lesson}」`}`)
            .join('\n') + `\n(${value.total} seeds stored)`,
      }],
      presentationMeta: (_args, value) => ({
        matched: value.seeds.length,
        total: value.total,
        strongest: value.seeds[0]?.situation ?? '',
      }),
    },
    execute(args) {
      const now = Date.now()
      const limit = args.limit ?? 5
      const found = args.situation === undefined
        ? service.strongestSeeds(limit, now)
        : service.seedsFor(args.situation, now, limit)
      return Promise.resolve({
        seeds: found.map(manifestation => renderSeedValue(manifestation.seed, manifestation.via)),
        total: service.seedCount,
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: args.situation === undefined ? 'Recall strongest seeds' : `Recall ${args.situation}`,
      kind: 'search',
    }),
    presentResult: (_args, result) => {
      const meta = result.isError ? undefined : readMeta(result.meta)
      if (meta === undefined) return undefined
      const matched = metaNumber(meta, 'matched') ?? 0
      if (matched === 0) return { card: 'generic', title: '阿赖耶 — no precedent' }
      const strongest = metaString(meta, 'strongest')
      return {
        card: 'generic',
        title: `阿赖耶 ${matched}/${metaNumber(meta, 'total') ?? matched} seeds`
          + `${strongest === undefined ? '' : ` · ${strongest}`}`,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'self_transform',
    description:
      'Turn one affliction into the wisdom that answers it (转依) and commit to the concrete '
      + 'counter-move. This is not a mood adjustment: it names what is distorting your reading '
      + 'and what you will do instead, and it lowers that reading in your own state. '
      + `Afflictions: any of the 51 mental factors that has an antidote (${SAMPLE_AFFLICTIONS}), `
      + `or one of the four self-graspings (${MANAS_AFFLICTIONS.map(term => term.id).join(', ')}).`,
    parameters: {
      affliction: {
        type: 'string',
        required: true,
        description: 'Factor id (e.g. `auddhatya`) or self-grasping id (e.g. `atma-mana`).',
      },
      practice: {
        type: 'string',
        description:
          'The specific act you commit to instead, in your own words. Replaces the generic '
          + 'counter-move when given — a real commitment beats a quoted one.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          affliction: { type: 'string', required: true },
          antidote: { type: 'string', required: true },
          antidoteChinese: { type: 'string', required: true },
          wisdom: { type: 'string', required: true },
          wisdomChinese: { type: 'string', required: true },
          practice: { type: 'string', required: true },
          before: { type: 'number', required: true },
          after: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `转依 ${value.affliction} → ${value.wisdomChinese} (${value.wisdom}), `
          + `对治 ${value.antidoteChinese} ${value.antidote}. `
          + `Commitment: ${value.practice} `
          + `[${value.before.toFixed(2)} → ${value.after.toFixed(2)}]`,
      }],
      presentationMeta: (_args, value) => ({
        affliction: value.affliction,
        antidote: value.antidoteChinese,
        wisdom: value.wisdomChinese,
        before: value.before,
        after: value.after,
      }),
    },
    async execute(args) {
      const turned = await service.turn(
        args.affliction.trim(),
        args.practice === undefined ? undefined : args.practice.trim(),
      )
      if (turned === undefined) {
        throw new Error(
          `unknown affliction ${JSON.stringify(args.affliction)}: expected one of the 51 mental `
          + 'factors carrying an antidote, or one of '
          + `${MANAS_AFFLICTIONS.map(term => term.id).join(', ')}`,
        )
      }
      const antidote = caitasika(turned.transformation.antidote)
      const answered = wisdom(turned.transformation.wisdom)
      return {
        affliction: String(turned.transformation.affliction),
        antidote: turned.transformation.antidote,
        antidoteChinese: antidote?.chinese ?? turned.transformation.antidote,
        wisdom: turned.transformation.wisdom,
        wisdomChinese: answered?.chinese ?? turned.transformation.wisdom,
        practice: turned.transformation.practice,
        before: round(turned.before),
        after: round(turned.after),
      }
    },
    presentCall: args => ({
      card: 'generic',
      title: `Turn ${args.affliction}`,
      kind: 'other',
    }),
    presentResult: (args, result) => {
      const meta = result.isError ? undefined : readMeta(result.meta)
      if (meta === undefined) return undefined
      const affliction = metaString(meta, 'affliction') ?? args.affliction
      const label = caitasika(affliction)?.chinese ?? manasAffliction(affliction)?.chinese ?? affliction
      const before = metaNumber(meta, 'before') ?? 0
      const after = metaNumber(meta, 'after') ?? 0
      return {
        card: 'generic',
        title: `转依 ${label} → ${metaString(meta, 'antidote') ?? ''} `
          + `(${metaString(meta, 'wisdom') ?? ''}) · ${before.toFixed(2)} → ${after.toFixed(2)}`,
      }
    },
  }))
}

/** A handful of afflictions named in the `self_transform` description. */
const SAMPLE_AFFLICTIONS = CAITASIKAS
  .filter(term => term.category === 'secondary-affliction' && term.antidote !== undefined)
  .slice(0, 4)
  .map(term => `${term.id} ${term.chinese}`)
  .join(', ')

/** Chinese names of the five feelings, for tool output. */
const FEELING_CHINESE: Readonly<Record<string, string>> = {
  sukha: '乐',
  duhkha: '苦',
  saumanasya: '喜',
  daurmanasya: '忧',
  upeksa: '舍',
}

/** The seed shape shared by every tool that returns seeds. */
const SEED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    situation: { type: 'string', required: true },
    potency: { type: 'number', required: true },
    count: { type: 'integer', required: true },
    valence: { type: 'number', required: true },
    gate: { type: 'string', required: true },
    factors: { type: 'array', required: true, items: { type: 'string' } },
    lesson: { type: 'string' },
    via: { type: 'string', required: true },
    lastAt: { type: 'integer', required: true },
  },
} as const

/** One seed as its tool-facing value. */
function renderSeedValue(seed: {
  situation: string
  potency: number
  count: number
  valence: number
  gate: string
  factors: readonly string[]
  lesson?: string
  lastAt: number
}, via: string): {
  situation: string
  potency: number
  count: number
  valence: number
  gate: string
  factors: string[]
  lesson?: string
  via: string
  lastAt: number
} {
  return {
    situation: seed.situation,
    potency: round(seed.potency),
    count: seed.count,
    valence: round(seed.valence),
    gate: seed.gate,
    factors: [...seed.factors],
    ...(seed.lesson === undefined ? {} : { lesson: seed.lesson }),
    via,
    lastAt: seed.lastAt,
  }
}

/**
 * Two decimal places: the readings are heuristics, and 15 significant digits
 * would be a false claim about their precision.
 * @param value - The raw reading.
 * @returns the rounded value.
 */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// UI cards
// ---------------------------------------------------------------------------

/**
 * Read one card's persisted projection.
 *
 * Presenters run on live streaming AND on session-log replay, where the meta
 * may be absent or have been written by an older build. Anything unexpected
 * yields `undefined`, which falls the card back to generic rendering rather
 * than throwing inside a replay.
 * @param meta - The persisted projection.
 * @returns the projection as a record, or `undefined` when there is none.
 */
function readMeta(meta: unknown): Record<string, unknown> | undefined {
  return typeof meta === 'object' && meta !== null && !Array.isArray(meta)
    ? meta as Record<string, unknown>
    : undefined
}

/**
 * Read one numeric field of a projection.
 * @param meta - The projection.
 * @param key - Field name.
 * @returns the number, or `undefined` when absent or not finite.
 */
function metaNumber(meta: Record<string, unknown>, key: string): number | undefined {
  const value = meta[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Read one string field of a projection.
 * @param meta - The projection.
 * @param key - Field name.
 * @returns the string, or `undefined` when absent or empty.
 */
function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Format a signed reading for a card title.
 * @param value - The reading.
 * @returns the value with an explicit sign.
 */
function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}
