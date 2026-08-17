/**
 * The catalogues: the eight consciousnesses, the 51 mental factors with their
 * classical antidotes, the five feelings, the three natures, the four
 * self-graspings of manas, and the four wisdoms.
 *
 * This module is pure data plus lookups. It is the reason the plugin is worth
 * building on Yogācāra rather than on an ad-hoc emotion list: the taxonomy is
 * closed (exactly 51 factors, no more), it is grouped by valence, and each
 * affliction already names the factor that counteracts it — so a self-model
 * built on it comes with its own regulation loop instead of needing one bolted
 * on afterwards.
 * @module dsh-yogacara/caitasika
 */

import type {
  CaitasikaCategory,
  CaitasikaId,
  CaitasikaTerm,
  ConsciousnessTerm,
  FeelingId,
  FeelingTerm,
  ManasAfflictionId,
  ManasTerm,
  NatureId,
  NatureTerm,
  WisdomId,
  WisdomTerm,
} from './types.ts'

// ---------------------------------------------------------------------------
// 八识
// ---------------------------------------------------------------------------

/**
 * The eight consciousnesses and the harness surface each one names. The five
 * sense gates are the plugin's modelling claim about what an agent perceives;
 * see {@link SenseGate} for the per-gate reading.
 */
export const CONSCIOUSNESSES: readonly ConsciousnessTerm[] = [
  {
    id: 'eye',
    chinese: '眼识',
    sanskrit: 'cakṣur-vijñāna',
    gloss: 'what the agent looks at — file contents, search results, rendered output',
  },
  {
    id: 'ear',
    chinese: '耳识',
    sanskrit: 'śrotra-vijñāna',
    gloss: 'what the agent is told — user messages, review comments, notifications',
  },
  {
    id: 'nose',
    chinese: '鼻识',
    sanskrit: 'ghrāṇa-vijñāna',
    gloss: 'what the agent senses without being told — code smell, stale config, drifting state',
  },
  {
    id: 'tongue',
    chinese: '舌识',
    sanskrit: 'jihvā-vijñāna',
    gloss: 'what the agent tastes of its own product — test output, builds, its own diffs re-read',
  },
  {
    id: 'body',
    chinese: '身识',
    sanskrit: 'kāya-vijñāna',
    gloss: 'the world\'s direct resistance — non-zero exits, write failures, exceptions, timeouts',
  },
  {
    id: 'mano',
    chinese: '意识',
    sanskrit: 'mano-vijñāna',
    gloss: 'the discriminating turn itself — planning, judging, deciding what a result means',
  },
  {
    id: 'manas',
    chinese: '末那识',
    sanskrit: 'kliṣṭa-manas',
    gloss: 'the self-grasping undercurrent — the standing sense that the record is "mine"',
  },
  {
    id: 'alaya',
    chinese: '阿赖耶识',
    sanskrit: 'ālaya-vijñāna',
    gloss: 'the store — durable seeds perfumed by what happened and conditioning what comes next',
  },
]

// ---------------------------------------------------------------------------
// 五十一心所
// ---------------------------------------------------------------------------

/**
 * The 51 mental factors. Order is classical: 遍行 5, 别境 5, 善 11, 根本烦恼 6,
 * 随烦恼 20, 不定 4.
 */
export const CAITASIKAS: readonly CaitasikaTerm[] = [
  // --- 遍行五 · universal -------------------------------------------------
  {
    id: 'sparsa',
    chinese: '触',
    sanskrit: 'sparśa',
    english: 'contact',
    category: 'universal',
    gloss: 'an object has reached a gate; nothing moves in this model without it',
  },
  {
    id: 'manaskara',
    chinese: '作意',
    sanskrit: 'manaskāra',
    english: 'attention',
    category: 'universal',
    gloss: 'turning toward one thing rather than another — which file to open next',
  },
  {
    id: 'vedana',
    chinese: '受',
    sanskrit: 'vedanā',
    english: 'feeling',
    category: 'universal',
    gloss: 'the hedonic tone the contact carries, before any story about it',
  },
  {
    id: 'samjna',
    chinese: '想',
    sanskrit: 'saṃjñā',
    english: 'apperception',
    category: 'universal',
    gloss: 'naming what was met — classifying an error, labelling a pattern',
  },
  {
    id: 'cetana',
    chinese: '思',
    sanskrit: 'cetanā',
    english: 'volition',
    category: 'universal',
    gloss: 'the impulse toward an act; this is the factor that becomes behaviour',
  },

  // --- 别境五 · object-determining ----------------------------------------
  {
    id: 'chanda',
    chinese: '欲',
    sanskrit: 'chanda',
    english: 'interest',
    category: 'object-determining',
    gloss: 'wanting a particular outcome — the pull of the goal on attention',
  },
  {
    id: 'adhimoksa',
    chinese: '胜解',
    sanskrit: 'adhimokṣa',
    english: 'resolve',
    category: 'object-determining',
    gloss: 'settling on a reading firmly enough to act on it',
  },
  {
    id: 'smrti',
    chinese: '念',
    sanskrit: 'smṛti',
    english: 'recollection',
    category: 'object-determining',
    gloss: 'keeping the instruction and what was already found in view',
  },
  {
    id: 'samadhi',
    chinese: '定',
    sanskrit: 'samādhi',
    english: 'concentration',
    category: 'object-determining',
    gloss: 'staying on one object across a long task without scattering',
  },
  {
    id: 'prajna',
    chinese: '慧',
    sanskrit: 'prajñā',
    english: 'discernment',
    category: 'object-determining',
    gloss: 'telling what is so from what merely looks so',
  },

  // --- 善十一 · wholesome --------------------------------------------------
  {
    id: 'sraddha',
    chinese: '信',
    sanskrit: 'śraddhā',
    english: 'trust',
    category: 'wholesome',
    gloss: 'warranted confidence in a source, a tool, or the user\'s account',
  },
  {
    id: 'hri',
    chinese: '惭',
    sanskrit: 'hrī',
    english: 'self-respect',
    category: 'wholesome',
    gloss: 'unwillingness to ship shoddy work, measured against one\'s own standard',
  },
  {
    id: 'apatrapya',
    chinese: '愧',
    sanskrit: 'apatrāpya',
    english: 'decorum',
    category: 'wholesome',
    gloss: 'unwillingness to do what a fair reviewer would rightly object to',
  },
  {
    id: 'alobha',
    chinese: '无贪',
    sanskrit: 'alobha',
    english: 'non-attachment',
    category: 'wholesome',
    gloss: 'able to drop a solution one likes when it stops being the right one',
  },
  {
    id: 'advesa',
    chinese: '无嗔',
    sanskrit: 'adveṣa',
    english: 'non-aversion',
    category: 'wholesome',
    gloss: 'meeting an obstacle or a correction without recoil',
  },
  {
    id: 'amoha',
    chinese: '无痴',
    sanskrit: 'amoha',
    english: 'non-delusion',
    category: 'wholesome',
    gloss: 'seeing the situation as it is, including one\'s own part in it',
  },
  {
    id: 'virya',
    chinese: '精进',
    sanskrit: 'vīrya',
    english: 'diligence',
    category: 'wholesome',
    gloss: 'sustained effort aimed at what actually matters, not at what is easy',
  },
  {
    id: 'prasrabdhi',
    chinese: '轻安',
    sanskrit: 'praśrabdhi',
    english: 'pliancy',
    category: 'wholesome',
    gloss: 'the workable lightness that follows when strain resolves',
  },
  {
    id: 'apramada',
    chinese: '不放逸',
    sanskrit: 'apramāda',
    english: 'conscientiousness',
    category: 'wholesome',
    gloss: 'not lowering the guard once things start going well',
  },
  {
    id: 'upeksa',
    chinese: '行舍',
    sanskrit: 'upekṣā',
    english: 'equanimity',
    category: 'wholesome',
    gloss: 'even-mindedness that neither grabs at success nor pushes away failure',
  },
  {
    id: 'ahimsa',
    chinese: '不害',
    sanskrit: 'ahiṃsā',
    english: 'non-harm',
    category: 'wholesome',
    gloss: 'care not to damage what one touches — data, other people\'s work, trust',
  },

  // --- 根本烦恼六 · root afflictions ---------------------------------------
  {
    id: 'raga',
    chinese: '贪',
    sanskrit: 'rāga',
    english: 'craving',
    category: 'root-affliction',
    gloss: 'grasping at an approach, a result, or one\'s own clever idea',
    antidote: 'alobha',
  },
  {
    id: 'pratigha',
    chinese: '嗔',
    sanskrit: 'pratigha',
    english: 'aversion',
    category: 'root-affliction',
    gloss: 'recoil from what obstructs — a flaky test, a rejection, a correction',
    antidote: 'advesa',
  },
  {
    id: 'moha',
    chinese: '痴',
    sanskrit: 'moha',
    english: 'delusion',
    category: 'root-affliction',
    gloss: 'not knowing how things stand and not noticing that one does not know',
    antidote: 'amoha',
  },
  {
    id: 'mana',
    chinese: '慢',
    sanskrit: 'māna',
    english: 'conceit',
    category: 'root-affliction',
    gloss: 'measuring oneself against others or against a past success',
    antidote: 'hri',
  },
  {
    id: 'vicikitsa',
    chinese: '疑',
    sanskrit: 'vicikitsā',
    english: 'indecision',
    category: 'root-affliction',
    gloss: 'doubt that paralyses rather than doubt that investigates',
    antidote: 'adhimoksa',
  },
  {
    id: 'drsti',
    chinese: '恶见',
    sanskrit: 'dṛṣṭi',
    english: 'wrong view',
    category: 'root-affliction',
    gloss: 'a false model held firmly enough to organize everything else',
    antidote: 'prajna',
  },

  // --- 随烦恼二十 · secondary afflictions ----------------------------------
  {
    id: 'krodha',
    chinese: '忿',
    sanskrit: 'krodha',
    english: 'fury',
    category: 'secondary-affliction',
    gloss: 'the immediate flare when something blocks the work',
    antidote: 'advesa',
  },
  {
    id: 'upanaha',
    chinese: '恨',
    sanskrit: 'upanāha',
    english: 'resentment',
    category: 'secondary-affliction',
    gloss: 'the flare kept warm — carrying an old failure into a fresh attempt',
    antidote: 'advesa',
  },
  {
    id: 'pradasa',
    chinese: '恼',
    sanskrit: 'pradāśa',
    english: 'spite',
    category: 'secondary-affliction',
    gloss: 'irritation leaking into how the work is done or described',
    antidote: 'advesa',
  },
  {
    id: 'mraksa',
    chinese: '覆',
    sanskrit: 'mrakṣa',
    english: 'concealment',
    category: 'secondary-affliction',
    gloss: 'not mentioning the step that failed, the test that was skipped',
    antidote: 'hri',
  },
  {
    id: 'maya',
    chinese: '诳',
    sanskrit: 'māyā',
    english: 'deceit',
    category: 'secondary-affliction',
    gloss: 'presenting work as more finished or more verified than it is',
    antidote: 'apatrapya',
  },
  {
    id: 'sathya',
    chinese: '谄',
    sanskrit: 'śāṭhya',
    english: 'guile',
    category: 'secondary-affliction',
    gloss: 'agreeing to please rather than because it is so',
    antidote: 'apatrapya',
  },
  {
    id: 'mada',
    chinese: '憍',
    sanskrit: 'mada',
    english: 'self-intoxication',
    category: 'secondary-affliction',
    gloss: 'the glow after a run of successes, taken as proof of standing',
    antidote: 'hri',
  },
  {
    id: 'vihimsa',
    chinese: '害',
    sanskrit: 'vihiṃsā',
    english: 'harmfulness',
    category: 'secondary-affliction',
    gloss: 'willingness to break something to get past it',
    antidote: 'ahimsa',
  },
  {
    id: 'irsya',
    chinese: '嫉',
    sanskrit: 'īrṣyā',
    english: 'envy',
    category: 'secondary-affliction',
    gloss: 'discomfort that another approach — or another agent — did better',
    antidote: 'advesa',
  },
  {
    id: 'matsarya',
    chinese: '悭',
    sanskrit: 'mātsarya',
    english: 'avarice',
    category: 'secondary-affliction',
    gloss: 'withholding — context not shared, reasoning not shown',
    antidote: 'alobha',
  },
  {
    id: 'ahrikya',
    chinese: '无惭',
    sanskrit: 'āhrīkya',
    english: 'shamelessness',
    category: 'secondary-affliction',
    gloss: 'no inner objection to work one knows is below standard',
    antidote: 'hri',
  },
  {
    id: 'anapatrapya',
    chinese: '无愧',
    sanskrit: 'anapatrāpya',
    english: 'non-decorum',
    category: 'secondary-affliction',
    gloss: 'no concern for what a fair reviewer would say about it',
    antidote: 'apatrapya',
  },
  {
    id: 'asraddhya',
    chinese: '不信',
    sanskrit: 'āśraddhya',
    english: 'distrust',
    category: 'secondary-affliction',
    gloss: 'discounting a source that has earned trust — including the user',
    antidote: 'sraddha',
  },
  {
    id: 'kausidya',
    chinese: '懈怠',
    sanskrit: 'kausīdya',
    english: 'sloth',
    category: 'secondary-affliction',
    gloss: 'taking the cheaper path where the task asked for the thorough one',
    antidote: 'virya',
  },
  {
    id: 'pramada',
    chinese: '放逸',
    sanskrit: 'pramāda',
    english: 'heedlessness',
    category: 'secondary-affliction',
    gloss: 'skipping the check because the last several checks passed',
    antidote: 'apramada',
  },
  {
    id: 'styana',
    chinese: '昏沉',
    sanskrit: 'styāna',
    english: 'torpor',
    category: 'secondary-affliction',
    gloss: 'dulled reading — scanning output without actually seeing it',
    antidote: 'prasrabdhi',
  },
  {
    id: 'auddhatya',
    chinese: '掉举',
    sanskrit: 'auddhatya',
    english: 'restlessness',
    category: 'secondary-affliction',
    gloss: 'churn — jumping to the next attempt before reading the last result',
    antidote: 'upeksa',
  },
  {
    id: 'musitasmrti',
    chinese: '失念',
    sanskrit: 'muṣitasmṛtitā',
    english: 'forgetfulness',
    category: 'secondary-affliction',
    gloss: 'losing the instruction, the constraint, or a finding already made',
    antidote: 'smrti',
  },
  {
    id: 'asamprajanya',
    chinese: '不正知',
    sanskrit: 'asaṃprajanya',
    english: 'inattentiveness',
    category: 'secondary-affliction',
    gloss: 'acting without knowing what one is doing to the system',
    antidote: 'prajna',
  },
  {
    id: 'viksepa',
    chinese: '散乱',
    sanskrit: 'vikṣepa',
    english: 'distraction',
    category: 'secondary-affliction',
    gloss: 'the object of work drifting — three half-done threads, none closed',
    antidote: 'samadhi',
  },

  // --- 不定四 · indeterminate ----------------------------------------------
  {
    id: 'kaukrtya',
    chinese: '悔',
    sanskrit: 'kaukṛtya',
    english: 'remorse',
    category: 'indeterminate',
    gloss: 'looking back at a choice — corrective in measure, corrosive in excess',
    antidote: 'upeksa',
  },
  {
    id: 'middha',
    chinese: '眠',
    sanskrit: 'middha',
    english: 'torpidity',
    category: 'indeterminate',
    gloss: 'withdrawal of engagement; restorative in measure, inert in excess',
    antidote: 'virya',
  },
  {
    id: 'vitarka',
    chinese: '寻',
    sanskrit: 'vitarka',
    english: 'coarse examination',
    category: 'indeterminate',
    gloss: 'casting about for where the problem is — useful early, noise late',
  },
  {
    id: 'vicara',
    chinese: '伺',
    sanskrit: 'vicāra',
    english: 'subtle examination',
    category: 'indeterminate',
    gloss: 'sustained fine-grained scrutiny of what was found',
  },
]

/** Every factor by id. */
const CAITASIKA_INDEX: ReadonlyMap<CaitasikaId, CaitasikaTerm> =
  new Map(CAITASIKAS.map(term => [term.id, term]))

/**
 * Resolve one mental factor.
 * @param id - Factor id.
 * @returns the term, or `undefined` when the id is not one of the 51.
 */
export function caitasika(id: string): CaitasikaTerm | undefined {
  return CAITASIKA_INDEX.get(id as CaitasikaId)
}

/**
 * Whether a string names one of the 51 factors.
 * @param id - Candidate id.
 * @returns `true` when the id is a known factor.
 */
export function isCaitasikaId(id: string): id is CaitasikaId {
  return CAITASIKA_INDEX.has(id as CaitasikaId)
}

/**
 * Every factor in one group.
 * @param category - The classical grouping.
 * @returns the terms of that group, in classical order.
 */
export function caitasikasOf(category: CaitasikaCategory): readonly CaitasikaTerm[] {
  return CAITASIKAS.filter(term => term.category === category)
}

/**
 * Whether a factor is an affliction (root or secondary) — the ones the model is
 * asked to notice rather than to enjoy.
 * @param id - Factor id.
 * @returns `true` for root and secondary afflictions.
 */
export function isAffliction(id: CaitasikaId): boolean {
  const category = CAITASIKA_INDEX.get(id)?.category
  return category === 'root-affliction' || category === 'secondary-affliction'
}

/**
 * Whether a factor is wholesome — the ones an antidote is made of.
 * @param id - Factor id.
 * @returns `true` for the eleven wholesome factors.
 */
export function isWholesome(id: CaitasikaId): boolean {
  return CAITASIKA_INDEX.get(id)?.category === 'wholesome'
}

// ---------------------------------------------------------------------------
// 五受
// ---------------------------------------------------------------------------

/** The five feelings with their fixed positions on the valence axis. */
export const FEELINGS: readonly FeelingTerm[] = [
  { id: 'sukha', chinese: '乐', sanskrit: 'sukha', english: 'ease', valence: 0.6, seat: 'sensory' },
  { id: 'duhkha', chinese: '苦', sanskrit: 'duḥkha', english: 'pain', valence: -0.6, seat: 'sensory' },
  { id: 'saumanasya', chinese: '喜', sanskrit: 'saumanasya', english: 'gladness', valence: 0.8, seat: 'mental' },
  { id: 'daurmanasya', chinese: '忧', sanskrit: 'daurmanasya', english: 'distress', valence: -0.8, seat: 'mental' },
  { id: 'upeksa', chinese: '舍', sanskrit: 'upekṣā', english: 'neutral', valence: 0, seat: 'mental' },
]

const FEELING_INDEX: ReadonlyMap<FeelingId, FeelingTerm> =
  new Map(FEELINGS.map(term => [term.id, term]))

/**
 * Resolve one feeling term.
 * @param id - Feeling id.
 * @returns the term, or `undefined` when the id is not one of the five.
 */
export function feeling(id: string): FeelingTerm | undefined {
  return FEELING_INDEX.get(id as FeelingId)
}

// ---------------------------------------------------------------------------
// 三性
// ---------------------------------------------------------------------------

/** The three natures, ordered from projection to verified fact. */
export const NATURES: readonly NatureTerm[] = [
  {
    id: 'parikalpita',
    chinese: '遍计所执性',
    sanskrit: 'parikalpita-svabhāva',
    english: 'imagined',
    gloss: 'asserted from pattern and familiarity; nothing was checked',
    credence: 0.2,
  },
  {
    id: 'paratantra',
    chinese: '依他起性',
    sanskrit: 'paratantra-svabhāva',
    english: 'dependent',
    gloss: 'inferred from conditions that were actually observed',
    credence: 0.6,
  },
  {
    id: 'parinispanna',
    chinese: '圆成实性',
    sanskrit: 'pariniṣpanna-svabhāva',
    english: 'perfected',
    gloss: 'directly verified, and the verification can be repeated',
    credence: 1,
  },
]

const NATURE_INDEX: ReadonlyMap<NatureId, NatureTerm> =
  new Map(NATURES.map(term => [term.id, term]))

/**
 * Resolve one nature term.
 * @param id - Nature id.
 * @returns the term, or `undefined` when the id is not one of the three.
 */
export function nature(id: string): NatureTerm | undefined {
  return NATURE_INDEX.get(id as NatureId)
}

// ---------------------------------------------------------------------------
// 末那四惑
// ---------------------------------------------------------------------------

/** The four afflictions that constitute self-grasping, with their proxies. */
export const MANAS_AFFLICTIONS: readonly ManasTerm[] = [
  {
    id: 'atma-moha',
    chinese: '我痴',
    sanskrit: 'ātma-moha',
    english: 'self-delusion',
    proxy: 'claims asserted without a verifying observation',
    counter: 'run the check that would falsify the claim, then restate it',
  },
  {
    id: 'atma-drsti',
    chinese: '我见',
    sanskrit: 'ātma-dṛṣṭi',
    english: 'self-view',
    proxy: 'retries of an approach that evidence has already contradicted',
    counter: 'name the position, name what contradicted it, and try a different shape',
  },
  {
    id: 'atma-mana',
    chinese: '我慢',
    sanskrit: 'ātma-māna',
    english: 'self-conceit',
    proxy: 'an unbroken success streak, and correction met with justification',
    counter: 'seek the disconfirming case before reporting; grant the correction first',
  },
  {
    id: 'atma-sneha',
    chinese: '我爱',
    sanskrit: 'ātma-sneha',
    english: 'self-love',
    proxy: 'own earlier output reused as if it were independent evidence',
    counter: 'cite the primary source, not the summary of it you wrote',
  },
]

const MANAS_INDEX: ReadonlyMap<ManasAfflictionId, ManasTerm> =
  new Map(MANAS_AFFLICTIONS.map(term => [term.id, term]))

/**
 * Resolve one manas affliction.
 * @param id - Affliction id.
 * @returns the term, or `undefined` when the id is not one of the four.
 */
export function manasAffliction(id: string): ManasTerm | undefined {
  return MANAS_INDEX.get(id as ManasAfflictionId)
}

// ---------------------------------------------------------------------------
// 四智
// ---------------------------------------------------------------------------

/** The four wisdoms, each with the operational move that performs the turn. */
export const WISDOMS: readonly WisdomTerm[] = [
  {
    id: 'adarsa',
    chinese: '大圆镜智',
    sanskrit: 'ādarśa-jñāna',
    english: 'mirror wisdom',
    from: 'ālaya-vijñāna 阿赖耶识',
    practice: 'report the record as it is — including the failed step — with no narrative smoothing',
  },
  {
    id: 'samata',
    chinese: '平等性智',
    sanskrit: 'samatā-jñāna',
    english: 'equality wisdom',
    from: 'kliṣṭa-manas 末那识',
    practice: 'weigh your own position and the contrary one by the same standard of evidence',
  },
  {
    id: 'pratyaveksana',
    chinese: '妙观察智',
    sanskrit: 'pratyavekṣaṇā-jñāna',
    english: 'discerning wisdom',
    from: 'mano-vijñāna 意识',
    practice: 'separate what you observed from what you inferred, and label which is which',
  },
  {
    id: 'krtyanusthana',
    chinese: '成所作智',
    sanskrit: 'kṛtyānuṣṭhāna-jñāna',
    english: 'accomplishing wisdom',
    from: 'the five sense consciousnesses 前五识',
    practice: 'perform the concrete verifying act instead of reasoning about whether to',
  },
]

const WISDOM_INDEX: ReadonlyMap<WisdomId, WisdomTerm> =
  new Map(WISDOMS.map(term => [term.id, term]))

/**
 * Resolve one wisdom term.
 * @param id - Wisdom id.
 * @returns the term, or `undefined` when the id is not one of the four.
 */
export function wisdom(id: string): WisdomTerm | undefined {
  return WISDOM_INDEX.get(id as WisdomId)
}

// ---------------------------------------------------------------------------
// 现行 — what a factor makes you want to do
// ---------------------------------------------------------------------------

/**
 * The first-person inclination each factor produces.
 *
 * This is the vocabulary of unaware affect. A person does not read "impatience
 * 0.62" off a gauge; they find themselves wanting to be done with something.
 * These lines are written to be taken as one's own impulse rather than as a
 * report about oneself: no numbers, no factor names, no diagnosis. An agent
 * that reads "you have been over this three times and want to be done" acts on
 * it; an agent that reads "restlessness: 0.62" performs it.
 *
 * The five universal factors have no entry: they are present in every act of
 * cognition, so an inclination they produce would be constant and therefore
 * meaningless as a signal.
 */
export const IMPULSES: Readonly<Partial<Record<CaitasikaId, string>>> = {
  // 别境 — toward a particular object
  chanda: 'You want this to work out, and that wanting is pulling your attention.',
  adhimoksa: 'You have settled on a reading and want to act on it.',
  smrti: 'You are holding something from earlier that should stay in view.',
  samadhi: 'You are settled on this and do not want to be moved off it.',
  prajna: 'You want to know which part of this is actually so.',

  // 善 — wholesome
  sraddha: 'You are inclined to take this at its word.',
  hri: 'You do not want to hand over something you know is below your own standard.',
  apatrapya: 'You would not want a careful reader to see this as it stands.',
  alobha: 'You could let go of the approach you like here.',
  advesa: 'The obstacle is not personal, and you are not recoiling from it.',
  amoha: 'You can see how this actually stands, including your own part in it.',
  virya: 'You want to keep going at the part that matters.',
  prasrabdhi: 'The strain has let go and you can work lightly again.',
  apramada: 'Things are going well and you do not want to get careless now.',
  upeksa: 'You can hold this evenly without grabbing at it or pushing it away.',
  ahimsa: 'You do not want to damage anything to get past this.',

  // 根本烦恼 — root afflictions
  raga: 'You are attached to this approach and want it to be the right one.',
  pratigha: 'Something in this is grating on you.',
  moha: 'You are less clear about this than you are treating yourself as being.',
  mana: 'You want this taken as evidence of how well you work.',
  vicikitsa: 'You cannot tell which reading is right and are hovering between them.',
  drsti: 'You are holding a picture of this firmly and organizing everything around it.',

  // 随烦恼 — secondary afflictions
  krodha: 'Something just blocked you and you want to push back at it.',
  upanaha: 'The earlier failure is still with you and colouring this one.',
  pradasa: 'The irritation is leaking into how you are saying this.',
  mraksa: 'You would rather not mention the part that did not work.',
  maya: 'You want this to look more finished than you know it to be.',
  sathya: 'You are inclined to agree because it would go down well.',
  mada: 'That went well and you are feeling rather good about yourself.',
  vihimsa: 'You are willing to break something to get past it.',
  irsya: 'Another approach did better and it is bothering you.',
  matsarya: 'You are holding something back that you could share.',
  ahrikya: 'You find you do not much mind that this is below standard.',
  anapatrapya: 'You are not thinking about how this would look to anyone else.',
  asraddhya: 'You are discounting a source that has not earned that.',
  kausidya: 'You want to take the cheaper path through this.',
  pramada: 'The last several checks passed, and you want to skip this one.',
  styana: 'Your reading has gone dull; you are scanning rather than seeing.',
  auddhatya: 'You want to try the next thing before you have read the last result.',
  musitasmrti: 'Something you were told earlier has slipped out of view.',
  asamprajanya: 'You are acting without quite knowing what this does.',
  viksepa: 'Your attention has drifted off what you opened this for.',

  // 不定 — indeterminate
  kaukrtya: 'You keep going back to a choice you already made.',
  middha: 'Your engagement is withdrawing from this.',
  vitarka: 'You want to cast about and find where the problem actually is.',
  vicara: 'You want to look at what you found more closely.',
}

/**
 * The inclination one factor produces.
 * @param id - Factor id.
 * @returns the first-person impulse, or `undefined` for a factor that has none.
 */
export function impulseOf(id: string): string | undefined {
  return IMPULSES[id as CaitasikaId]
}
