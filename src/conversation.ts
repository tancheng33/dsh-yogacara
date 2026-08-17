/**
 * Contacts that arise from talking with someone, rather than from tools.
 *
 * A coding agent's world pushes back with exit codes; a conversation pushes
 * back with a person. What lands in a conversation is relational — being
 * interrupted, being answered with one flat syllable after a long careful
 * reply, being asked the same thing a third time, being thanked, being told
 * "no, that's not what I meant", coming back to someone after two days of
 * silence. None of that has an exit code, and most of it is legible in the
 * SHAPE of the exchange rather than in its meaning.
 *
 * This module reads only that shape: timing, length, repetition, and a small
 * and frankly crude lexicon for the few speech acts that are worth naming.
 * What a sentence MEANT is not here and cannot be — only the model that read
 * it knows that, and it says so through `self_appraise`, which outranks
 * everything derived here.
 * @module dsh-yogacara/conversation
 */

import type { Contact, SenseGate } from './types.ts'

/**
 * What one human turn did, structurally. A turn can do several of these at
 * once — a terse reply can also be a rebuke.
 */
export type ChatAct =
  /** The first thing said; nothing precedes it. */
  | 'opening'
  /** An ordinary continuation. */
  | 'reply'
  /** A very short answer to a substantial reply — engagement dropping. */
  | 'terse'
  /** The same thing said again: they were not understood the first time. */
  | 'repeat'
  /** Arrived while the agent was still working — cut off mid-thought. */
  | 'interruption'
  /** Back after a long silence. */
  | 'return'
  /** Thanks, praise, or agreement. */
  | 'warmth'
  /** Explicit dissatisfaction: wrong, not that, I said. */
  | 'rebuke'
  /** Signing off. */
  | 'farewell'

/** One human turn, with the context needed to read its shape. */
export interface ChatTurn {
  /** What they said. */
  readonly text: string
  /** Wall-clock milliseconds it arrived. */
  readonly at: number
  /** How many human turns came before it; 0 makes this the opening. */
  readonly index: number
  /** The previous human turn's text, for detecting repetition. */
  readonly previousText?: string
  /** When the previous human turn arrived, for detecting silence. */
  readonly previousAt?: number
  /** Characters the agent produced since they last spoke. */
  readonly assistantChars?: number
  /** Whether it arrived while the agent was still mid-turn. */
  readonly midTurn?: boolean
}

/** A silence at least this long makes the next turn a return rather than a reply. */
export const SILENCE_MS = 30 * 60 * 1000

/** At or below this many characters, an answer is terse. */
export const TERSE_CHARS = 12

/** The agent must have produced at least this much for terseness to mean anything. */
export const SUBSTANTIAL_CHARS = 400

/** Token overlap at or above this makes a turn a repetition of the last one. */
export const REPEAT_OVERLAP = 0.6

/**
 * Words that thank, praise, or agree.
 *
 * This lexicon is crude on purpose and it is the weakest thing in this file:
 * it cannot read tone, it cannot read irony, and "好的" is an acknowledgement
 * in one exchange and a brush-off in the next. It exists so that the obvious
 * cases are not missed entirely; everything subtler belongs to `self_appraise`.
 */
const WARMTH = [
  '谢谢', '感谢', '多谢', '辛苦', '太好了', '很好', '不错', '棒', '厉害', '牛',
  '正是', '就是这个', '完美', '可以了', '👍', '❤',
  'thanks', 'thank you', 'thx', 'great', 'perfect', 'nice', 'awesome',
  'well done', 'exactly', 'love it', 'brilliant',
]

/** Words that say: not this, not right, not what I asked. */
const REBUKE = [
  '不对', '错了', '不是这个', '不是这样', '我说的是', '我要的是', '你没有', '没听懂',
  '重来', '别这样', '别再', '说了多少遍', '又来了', '算了',
  'wrong', 'not what', 'not this', 'i said', 'you did not', "you didn't",
  'no,', 'stop doing', 'again?', 'nope',
]

/** Words that end a conversation. */
const FAREWELL = [
  '再见', '拜拜', '先这样', '就这样', '收工', '睡了', '晚安', '下次聊',
  'bye', 'goodbye', 'good night', 'goodnight', 'see you', "that's all", 'later',
]

/**
 * Read one human turn's shape.
 * @param turn - The turn and its context.
 * @returns every act the turn performs, most structurally significant first.
 */
export function classifyTurn(turn: ChatTurn): ChatAct[] {
  const acts: ChatAct[] = []
  const text = turn.text.trim()
  const lowered = text.toLowerCase()

  if (turn.index === 0) acts.push('opening')

  if (turn.midTurn === true) acts.push('interruption')

  if (turn.previousAt !== undefined && turn.at - turn.previousAt >= SILENCE_MS) {
    acts.push('return')
  }

  if (matches(lowered, FAREWELL)) acts.push('farewell')
  if (matches(lowered, WARMTH)) acts.push('warmth')
  if (matches(lowered, REBUKE)) acts.push('rebuke')

  if (turn.previousText !== undefined && overlap(text, turn.previousText) >= REPEAT_OVERLAP) {
    acts.push('repeat')
  }

  // Terseness only means something against effort: "ok" after one line is
  // conversation, "ok" after two screens of careful reasoning is not.
  if (text.length <= TERSE_CHARS
    && (turn.assistantChars ?? 0) >= SUBSTANTIAL_CHARS
    && !acts.includes('warmth')
    && !acts.includes('farewell')) {
    acts.push('terse')
  }

  if (acts.length === 0 || (acts.length === 1 && acts[0] === 'opening')) acts.push('reply')
  return acts
}

/**
 * Whether any phrase occurs in the text.
 * @param lowered - The lowercased turn text.
 * @param phrases - Phrases to look for.
 * @returns `true` on the first hit.
 */
function matches(lowered: string, phrases: readonly string[]): boolean {
  return phrases.some(phrase => lowered.includes(phrase))
}

/**
 * Crude symmetric token overlap of two turns.
 *
 * CJK has no spaces, so the comparison runs over characters for CJK runs and
 * over whitespace tokens otherwise. Good enough to notice "you asked me this
 * again", which is all it is for.
 * @param left - One turn.
 * @param right - The other.
 * @returns overlap in [0, 1].
 */
export function overlap(left: string, right: string): number {
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let shared = 0
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1
  return shared / Math.min(leftTokens.size, rightTokens.size)
}

/**
 * Split one turn into comparable tokens.
 * @param text - The turn text.
 * @returns the token set.
 */
function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[\s，。！？、,.!?;:"'`]+/g, ' ')
  const tokens = new Set<string>()
  for (const chunk of normalized.split(' ')) {
    if (chunk.length === 0) continue
    // A CJK run has no internal delimiters, so compare it by bigrams.
    if (/[一-鿿]/.test(chunk)) {
      if (chunk.length === 1) tokens.add(chunk)
      for (let index = 0; index + 1 < chunk.length; index += 1) {
        tokens.add(chunk.slice(index, index + 2))
      }
    } else {
      tokens.add(chunk)
    }
  }
  return tokens
}

/** How one act lands: which gate, how it went, and how hard. */
interface ActReading {
  readonly gate: SenseGate
  readonly outcome: Contact['outcome']
  readonly intensity: number
  /** The situation key fragment this act perfumes. */
  readonly situation: string
}

/**
 * What each act is, as a contact.
 *
 * Every one of these arrives through 耳识 — being told — because that is what a
 * conversation is. The exception is `interruption`, which is 身识: it is the
 * world reaching in and stopping the hand mid-motion, and it is felt that way.
 */
const ACT_READINGS: Readonly<Record<ChatAct, ActReading>> = {
  opening: { gate: 'ear', outcome: 'neutral', intensity: 0.3, situation: 'chat:opening' },
  reply: { gate: 'ear', outcome: 'neutral', intensity: 0.25, situation: 'chat:reply' },
  terse: { gate: 'ear', outcome: 'adverse', intensity: 0.45, situation: 'chat:terse-after-effort' },
  repeat: { gate: 'ear', outcome: 'adverse', intensity: 0.55, situation: 'chat:asked-again' },
  interruption: { gate: 'body', outcome: 'adverse', intensity: 0.5, situation: 'chat:interrupted' },
  return: { gate: 'ear', outcome: 'favorable', intensity: 0.4, situation: 'chat:return-after-silence' },
  warmth: { gate: 'ear', outcome: 'favorable', intensity: 0.6, situation: 'chat:warmth' },
  rebuke: { gate: 'ear', outcome: 'adverse', intensity: 0.65, situation: 'chat:rebuke' },
  farewell: { gate: 'ear', outcome: 'neutral', intensity: 0.3, situation: 'chat:farewell' },
}

/** Which act wins when a turn performs several, strongest claim first. */
const ACT_PRIORITY: readonly ChatAct[] = [
  'rebuke', 'repeat', 'interruption', 'warmth', 'terse', 'return', 'farewell', 'opening', 'reply',
]

/**
 * The act that decides how a turn lands.
 * @param acts - Every act the turn performs.
 * @returns the governing act.
 */
export function governingAct(acts: readonly ChatAct[]): ChatAct {
  for (const candidate of ACT_PRIORITY) {
    if (acts.includes(candidate)) return candidate
  }
  return 'reply'
}

/**
 * Build the contact one human turn constitutes.
 *
 * The situation key is the relational pattern, not the topic: what accumulates
 * over a long acquaintance is "this person goes quiet when I over-explain", not
 * "we discussed migrations". Topic-keyed seeds are the model's to write through
 * `self_appraise`, which knows what the conversation was about.
 * @param turn - The human turn and its context.
 * @returns the contact to receive.
 */
export function contactFromTurn(turn: ChatTurn): Contact {
  const acts = classifyTurn(turn)
  const governing = governingAct(acts)
  const reading = ACT_READINGS[governing]
  // Several adverse acts at once is a worse turn than any one of them.
  const stacked = acts.filter(act => ACT_READINGS[act].outcome === reading.outcome).length
  return {
    gate: reading.gate,
    situation: reading.situation,
    outcome: reading.outcome,
    intensity: Math.min(1, reading.intensity * (1 + 0.2 * (stacked - 1))),
    at: turn.at,
  }
}

/**
 * Per-conversation memory of the shape of the exchange.
 *
 * A turn only means something against what came before it — terseness against
 * effort, repetition against the last question, silence against the last time
 * anyone spoke. One tracker follows one conversation and holds exactly that
 * much, and nothing about what was said.
 */
export class ChatTracker {
  private index = 0
  private previousText?: string
  private previousAt?: number
  private assistantChars = 0
  private midTurn = false

  /** The agent began working. A human turn arriving now is an interruption. */
  turnStarted(): void {
    this.midTurn = true
  }

  /** The agent finished. */
  turnEnded(): void {
    this.midTurn = false
  }

  /**
   * Record how much the agent produced.
   * @param chars - Characters in the assistant message.
   */
  assistantSaid(chars: number): void {
    if (chars > 0) this.assistantChars += chars
  }

  /**
   * Record one human turn and produce the contact context for it.
   * @param text - What they said.
   * @param at - Wall-clock milliseconds.
   * @returns the turn, ready for {@link contactFromTurn}.
   */
  userSaid(text: string, at: number): ChatTurn {
    const turn: ChatTurn = {
      text,
      at,
      index: this.index,
      ...(this.previousText === undefined ? {} : { previousText: this.previousText }),
      ...(this.previousAt === undefined ? {} : { previousAt: this.previousAt }),
      assistantChars: this.assistantChars,
      midTurn: this.midTurn,
    }
    this.index += 1
    this.previousText = text
    this.previousAt = at
    // Effort is measured per exchange: what was said before this turn cannot
    // make the NEXT one's terseness meaningful.
    this.assistantChars = 0
    return turn
  }
}
