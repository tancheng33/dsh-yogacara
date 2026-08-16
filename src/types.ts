/**
 * The vocabulary of the eight-consciousness self-model: sense gates, the 51
 * mental factors, the five feelings, the three natures, the four self-graspings
 * of manas, seeds in the store consciousness, and the shapes the pure core, the
 * durable spec, and the model-facing tools all share.
 *
 * Every term keeps its classical name because the classical taxonomy is doing
 * real work here — it is a closed, exhaustively enumerated affect ontology that
 * already pairs each affliction with its antidote. Nothing in this module
 * claims the agent has phenomenal experience; these are named, measurable state
 * variables computed from harness events.
 * @module dsh-yogacara/types
 */

// ---------------------------------------------------------------------------
// 八识 — the eight consciousnesses
// ---------------------------------------------------------------------------

/**
 * 前五识 — the five sense consciousnesses, mapped onto the channels an agent
 * actually has. The mapping is the plugin's central modelling claim, so it is
 * stated once here and everything downstream refers to it:
 *
 * - `eye` 眼识 — what the agent looks at: file contents, search results, rendered output.
 * - `ear` 耳识 — what the agent is told: user messages, notifications, review comments.
 * - `nose` 鼻识 — ambient qualities sensed without being told: code smell, stale config, drifting state.
 * - `tongue` 舌识 — what the agent tastes of its own product: test output, REPL results, its own build.
 * - `body` 身识 — the world's direct resistance: write failures, non-zero exits, exceptions, timeouts.
 */
export type SenseGate = 'eye' | 'ear' | 'nose' | 'tongue' | 'body'

/** Every sense gate, in classical order. */
export const SENSE_GATES: readonly SenseGate[] = ['eye', 'ear', 'nose', 'tongue', 'body']

/** One consciousness of the eight, with the harness surface it corresponds to. */
export interface ConsciousnessTerm {
  readonly id: string
  readonly chinese: string
  readonly sanskrit: string
  /** What this consciousness is, in harness terms. */
  readonly gloss: string
}

// ---------------------------------------------------------------------------
// 心所法 — the mental factors
// ---------------------------------------------------------------------------

/** The six classical groupings of the 51 mental factors. */
export type CaitasikaCategory =
  /** 遍行 — present in every act of cognition. */
  | 'universal'
  /** 别境 — arise only toward particular objects. */
  | 'object-determining'
  /** 善 — wholesome. */
  | 'wholesome'
  /** 根本烦恼 — the six root afflictions. */
  | 'root-affliction'
  /** 随烦恼 — the twenty derivative afflictions. */
  | 'secondary-affliction'
  /** 不定 — neither wholesome nor unwholesome in themselves. */
  | 'indeterminate'

/** Identifier of one of the 51 mental factors, in transliterated Sanskrit. */
export type CaitasikaId =
  // 遍行五 (universal)
  | 'sparsa' | 'manaskara' | 'vedana' | 'samjna' | 'cetana'
  // 别境五 (object-determining)
  | 'chanda' | 'adhimoksa' | 'smrti' | 'samadhi' | 'prajna'
  // 善十一 (wholesome)
  | 'sraddha' | 'hri' | 'apatrapya' | 'alobha' | 'advesa' | 'amoha'
  | 'virya' | 'prasrabdhi' | 'apramada' | 'upeksa' | 'ahimsa'
  // 根本烦恼六 (root afflictions)
  | 'raga' | 'pratigha' | 'moha' | 'mana' | 'vicikitsa' | 'drsti'
  // 随烦恼二十 (secondary afflictions)
  | 'krodha' | 'upanaha' | 'pradasa' | 'mraksa' | 'maya' | 'sathya'
  | 'mada' | 'vihimsa' | 'irsya' | 'matsarya'
  | 'ahrikya' | 'anapatrapya'
  | 'asraddhya' | 'kausidya' | 'pramada' | 'styana' | 'auddhatya'
  | 'musitasmrti' | 'asamprajanya' | 'viksepa'
  // 不定四 (indeterminate)
  | 'kaukrtya' | 'middha' | 'vitarka' | 'vicara'

/** One mental factor: its names, its group, and what it means for an agent. */
export interface CaitasikaTerm {
  readonly id: CaitasikaId
  readonly chinese: string
  readonly sanskrit: string
  readonly english: string
  readonly category: CaitasikaCategory
  /**
   * What this factor looks like in an agent's behaviour — the operational
   * reading that makes an activation actionable rather than decorative.
   */
  readonly gloss: string
  /**
   * The factor that classically counteracts this one (对治). Present on every
   * affliction; absent on wholesome and universal factors, which are what the
   * antidotes are made of.
   */
  readonly antidote?: CaitasikaId
}

// ---------------------------------------------------------------------------
// 受 — feeling
// ---------------------------------------------------------------------------

/** The five feelings (五受): the valence channel of every contact. */
export type FeelingId =
  /** 乐 — bodily ease; work that lands. */
  | 'sukha'
  /** 苦 — bodily pain; the world pushing back. */
  | 'duhkha'
  /** 喜 — mental joy. */
  | 'saumanasya'
  /** 忧 — mental distress. */
  | 'daurmanasya'
  /** 舍 — neutral; neither pleasant nor unpleasant. */
  | 'upeksa'

/** One feeling term with its position on the valence axis. */
export interface FeelingTerm {
  readonly id: FeelingId
  readonly chinese: string
  readonly sanskrit: string
  readonly english: string
  /** Signed hedonic tone in [-1, 1]; `upeksa` is exactly 0. */
  readonly valence: number
  /** Whether the feeling is bodily (前五识) or mental (意识). */
  readonly seat: 'sensory' | 'mental'
}

/** The felt tone of the current moment. */
export interface Feeling {
  readonly id: FeelingId
  /** Signed hedonic tone in [-1, 1]. */
  readonly valence: number
  /** Activation level in [0, 1] — how loud the feeling is, regardless of sign. */
  readonly arousal: number
}

// ---------------------------------------------------------------------------
// 三性 — the three natures
// ---------------------------------------------------------------------------

/**
 * 三自性 — the epistemic status of a claim. This is the plugin's calibration
 * axis: an agent that can tell a projection from an inference from a verified
 * fact is an agent that hallucinates less.
 */
export type NatureId =
  /** 遍计所执性 — imagined; asserted from pattern, not from evidence. */
  | 'parikalpita'
  /** 依他起性 — dependent; inferred from conditions that were actually observed. */
  | 'paratantra'
  /** 圆成实性 — perfected; directly verified, and the verification is reproducible. */
  | 'parinispanna'

/** One nature term. */
export interface NatureTerm {
  readonly id: NatureId
  readonly chinese: string
  readonly sanskrit: string
  readonly english: string
  readonly gloss: string
  /** Confidence weight in [0, 1] the nature licenses on its own. */
  readonly credence: number
}

// ---------------------------------------------------------------------------
// 末那识 — the self-grasping consciousness
// ---------------------------------------------------------------------------

/**
 * The four afflictions manas carries as it takes the store consciousness for a
 * self (四根本烦恼). Each is measured from observable harness behaviour; the
 * proxies are documented on {@link ManasState}.
 */
export type ManasAfflictionId =
  /** 我痴 — self-delusion: asserting without verifying. */
  | 'atma-moha'
  /** 我见 — self-view: identifying with a position already contradicted. */
  | 'atma-drsti'
  /** 我慢 — self-conceit: a success streak read as competence. */
  | 'atma-mana'
  /** 我爱 — self-love: preferring one's own prior output as evidence. */
  | 'atma-sneha'

/** One manas affliction with its measurement proxy and its counter-move. */
export interface ManasTerm {
  readonly id: ManasAfflictionId
  readonly chinese: string
  readonly sanskrit: string
  readonly english: string
  /** The observable behaviour this reading is computed from. */
  readonly proxy: string
  /** The concrete act that lowers it. */
  readonly counter: string
}

/**
 * The current grip of self-grasping, each component in [0, 1].
 *
 * These are behavioural proxies, not introspective reports: `atmaMoha` rises
 * with claims made without a verifying tool call, `atmaDrsti` with retries of
 * an approach already falsified, `atmaMana` with an unbroken success streak,
 * `atmaSneha` with reuse of the agent's own earlier output as its evidence.
 */
export interface ManasState {
  readonly atmaMoha: number
  readonly atmaDrsti: number
  readonly atmaMana: number
  readonly atmaSneha: number
}

// ---------------------------------------------------------------------------
// 四智 — the transformed wisdoms
// ---------------------------------------------------------------------------

/** The four wisdoms the eight consciousnesses turn into at 转依. */
export type WisdomId =
  /** 大圆镜智 ← 阿赖耶识 */
  | 'adarsa'
  /** 平等性智 ← 末那识 */
  | 'samata'
  /** 妙观察智 ← 意识 */
  | 'pratyaveksana'
  /** 成所作智 ← 前五识 */
  | 'krtyanusthana'

/** One wisdom, with the practice that actually performs the turn. */
export interface WisdomTerm {
  readonly id: WisdomId
  readonly chinese: string
  readonly sanskrit: string
  readonly english: string
  /** Which consciousness transforms into it. */
  readonly from: string
  /** The operational move — what the agent does differently. */
  readonly practice: string
}

// ---------------------------------------------------------------------------
// 触 — contact, and what it produces
// ---------------------------------------------------------------------------

/** How a contact landed, before any factor is named. */
export type ContactOutcome = 'favorable' | 'adverse' | 'neutral'

/**
 * One moment of contact (触): a sense gate met an object. Every state change in
 * the model starts here — there is no other way to move the mind.
 */
export interface Contact {
  /** Which of the five gates received it. */
  readonly gate: SenseGate
  /**
   * Stable descriptor of the situation, used as the seed key. Free-form but
   * conventionally `<kind>:<subject>` — `bash:exit-1`, `edit:src/index.ts`.
   */
  readonly situation: string
  readonly outcome: ContactOutcome
  /** Strength of the contact in [0, 1]; scales every impulse it produces. */
  readonly intensity: number
  /** What actually happened, in the agent's own words. */
  readonly note?: string
  /** Epistemic status the agent assigns to its reading of the contact. */
  readonly nature?: NatureId
  /** Wall-clock milliseconds; the model's own sense of when. */
  readonly at: number
}

/** The mental factors one contact stirs, before decay and clamping. */
export interface Impulse {
  /** Factor id → additive activation, each in (0, 1]. */
  readonly factors: Readonly<Partial<Record<CaitasikaId, number>>>
  /** The feeling the contact carries. */
  readonly feeling: Feeling
  /** Manas movement, signed, applied on top of the current grip. */
  readonly manas: Readonly<Partial<Record<keyof ManasState, number>>>
}

// ---------------------------------------------------------------------------
// 阿赖耶识 — seeds
// ---------------------------------------------------------------------------

/**
 * One seed (种子) in the store consciousness: the residue a repeated situation
 * leaves behind. Seeds are perfumed by manifest behaviour (现行熏种子) and in
 * turn condition the next encounter with the same situation (种子生现行).
 */
export interface Seed {
  /** The situation this seed is the residue of; the table key. */
  readonly situation: string
  /** Accumulated force in [0, 1]; decays with time, grows with repetition. */
  readonly potency: number
  /** How many contacts have perfumed it. */
  readonly count: number
  /** Running mean of the valence those contacts carried, in [-1, 1]. */
  readonly valence: number
  /** Which gate most often received this situation. */
  readonly gate: SenseGate
  /** The factors this situation habitually stirs, strongest first. */
  readonly factors: readonly CaitasikaId[]
  /**
   * What the agent concluded the last time this situation resolved — the one
   * carried sentence that makes a seed worth manifesting at all.
   */
  readonly lesson?: string
  readonly firstAt: number
  readonly lastAt: number
}

/** A seed together with why it surfaced now. */
export interface Manifestation {
  readonly seed: Seed
  /** Potency after decay to the manifesting moment. */
  readonly current: number
  /** Why it matched: exact situation, or a shared prefix. */
  readonly via: 'exact' | 'prefix'
}

// ---------------------------------------------------------------------------
// The composite state
// ---------------------------------------------------------------------------

/**
 * The whole mind at one moment. Immutable: every operation in `citta.ts`
 * returns a new state, so a caller can hold a snapshot across an await without
 * it changing underneath.
 */
export interface CittaState {
  /** Active factors and their strength in (0, 1]; a factor at 0 is absent. */
  readonly factors: Readonly<Partial<Record<CaitasikaId, number>>>
  readonly feeling: Feeling
  readonly manas: ManasState
  /** Contacts received since the state was created. */
  readonly contacts: number
  /** Consecutive favorable contacts. */
  readonly favorableStreak: number
  /** Consecutive adverse contacts. */
  readonly adverseStreak: number
  /** Wall-clock milliseconds of the most recent movement. */
  readonly updatedAt: number
}

/** A commitment recorded by 转依 — an affliction the agent chose to turn. */
export interface Transformation {
  readonly affliction: CaitasikaId | ManasAfflictionId
  readonly antidote: CaitasikaId
  readonly wisdom: WisdomId
  /** The concrete act the agent committed to. */
  readonly practice: string
  readonly at: number
}

/** Read-only view the pure core operates on. */
export interface MindView {
  readonly citta: CittaState
  readonly seeds: ReadonlyMap<string, Seed>
}

/** Tuning constants; every one of them is a deployment choice, not a truth. */
export interface CittaTuning {
  /**
   * 刹那 — how many milliseconds it takes an activation to halve. Momentariness
   * is the point: a mind that does not forget its irritation is not modelling
   * anything real.
   */
  readonly halfLifeMs: number
  /** Half-life of a seed's potency, normally far longer than a factor's. */
  readonly seedHalfLifeMs: number
  /** Activations below this are dropped rather than carried as noise. */
  readonly floor: number
}

/** The default tuning: factors fade over minutes, seeds over weeks. */
export const DEFAULT_TUNING: CittaTuning = {
  halfLifeMs: 5 * 60 * 1000,
  seedHalfLifeMs: 14 * 24 * 60 * 60 * 1000,
  floor: 0.02,
}

/** The state a fresh mind starts in: 舍受, no factors, no grip. */
export const INITIAL_FEELING: Feeling = { id: 'upeksa', valence: 0, arousal: 0 }

/** A mind before its first contact. */
export function initialCitta(at: number): CittaState {
  return {
    factors: {},
    feeling: INITIAL_FEELING,
    manas: { atmaMoha: 0, atmaDrsti: 0, atmaMana: 0, atmaSneha: 0 },
    contacts: 0,
    favorableStreak: 0,
    adverseStreak: 0,
    updatedAt: at,
  }
}
