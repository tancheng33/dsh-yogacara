import { describe, expect, it } from 'vitest'
import {
  ChatTracker,
  classifyTurn,
  contactFromTurn,
  governingAct,
  overlap,
  SILENCE_MS,
} from '../src/conversation.ts'
import type { ChatTurn } from '../src/conversation.ts'

const T0 = 1_700_000_000_000

/**
 * Build a human turn with ordinary defaults.
 * @param overrides - Fields to replace.
 * @returns the turn.
 */
function turn(overrides: Partial<ChatTurn> = {}): ChatTurn {
  return {
    text: 'can you also handle the retry case',
    at: T0,
    index: 3,
    previousAt: T0 - 60_000,
    assistantChars: 200,
    ...overrides,
  }
}

describe('reading the shape of a turn', () => {
  it('calls the first thing said an opening', () => {
    expect(classifyTurn(turn({ index: 0, previousAt: undefined }))).toContain('opening')
  })

  it('reads an ordinary continuation as nothing more than a reply', () => {
    expect(classifyTurn(turn())).toEqual(['reply'])
  })

  it('reads a turn that arrived mid-work as an interruption', () => {
    expect(classifyTurn(turn({ midTurn: true }))).toContain('interruption')
  })

  it('reads a long gap as a return, not a reply', () => {
    expect(classifyTurn(turn({ previousAt: T0 - SILENCE_MS - 1 }))).toContain('return')
    expect(classifyTurn(turn({ previousAt: T0 - SILENCE_MS + 1000 }))).not.toContain('return')
  })

  it('reads thanks and praise as warmth, in either language', () => {
    expect(classifyTurn(turn({ text: '谢谢，正是这个' }))).toContain('warmth')
    expect(classifyTurn(turn({ text: 'perfect, thanks' }))).toContain('warmth')
  })

  it('reads an explicit correction as a rebuke', () => {
    expect(classifyTurn(turn({ text: '不对，我说的是另一个' }))).toContain('rebuke')
    expect(classifyTurn(turn({ text: "no, that's not what I asked" }))).toContain('rebuke')
  })

  it('reads a sign-off as a farewell rather than a terse brush-off', () => {
    const acts = classifyTurn(turn({ text: '先这样', assistantChars: 2000 }))
    expect(acts).toContain('farewell')
    expect(acts).not.toContain('terse')
  })
})

describe('terseness only counts against effort', () => {
  it('reads a flat syllable after a long reply as terse', () => {
    expect(classifyTurn(turn({ text: '嗯', assistantChars: 2000 }))).toContain('terse')
  })

  it('leaves the same syllable alone after a short reply', () => {
    expect(classifyTurn(turn({ text: '嗯', assistantChars: 50 }))).not.toContain('terse')
  })

  it('never calls thanks terse, however short', () => {
    expect(classifyTurn(turn({ text: '谢谢', assistantChars: 3000 }))).not.toContain('terse')
  })
})

describe('being asked the same thing again', () => {
  it('notices a restatement in Chinese without word boundaries', () => {
    expect(overlap('这个接口怎么鉴权', '这个接口怎么鉴权的')).toBeGreaterThan(0.6)
    expect(classifyTurn(turn({
      text: '这个接口怎么鉴权的',
      previousText: '这个接口怎么鉴权',
    }))).toContain('repeat')
  })

  it('notices a restatement in English', () => {
    expect(classifyTurn(turn({
      text: 'how do I configure the retry limit',
      previousText: 'how do I configure the retry limit please',
    }))).toContain('repeat')
  })

  it('does not call a genuinely new question a repeat', () => {
    expect(classifyTurn(turn({
      text: 'what about the timeout',
      previousText: 'how do I configure the retry limit',
    }))).not.toContain('repeat')
  })

  it('scores nothing for an empty comparison', () => {
    expect(overlap('', 'anything')).toBe(0)
  })
})

describe('which act governs a turn that does several things', () => {
  it('lets a rebuke outrank the terseness it arrives in', () => {
    expect(governingAct(['terse', 'rebuke', 'reply'])).toBe('rebuke')
  })

  it('lets an interruption outrank warmth', () => {
    expect(governingAct(['warmth', 'interruption'])).toBe('interruption')
  })

  it('falls back to a plain reply', () => {
    expect(governingAct([])).toBe('reply')
  })
})

describe('the contact a turn constitutes', () => {
  it('arrives through 耳识, because that is what being talked to is', () => {
    expect(contactFromTurn(turn()).gate).toBe('ear')
    expect(contactFromTurn(turn({ text: '谢谢' })).gate).toBe('ear')
  })

  it('arrives through 身识 when it cut the agent off mid-motion', () => {
    expect(contactFromTurn(turn({ midTurn: true })).gate).toBe('body')
  })

  it('keys the situation by relational pattern, not by topic', () => {
    expect(contactFromTurn(turn({ text: '嗯', assistantChars: 2000 })).situation)
      .toBe('chat:terse-after-effort')
    expect(contactFromTurn(turn({ text: '谢谢' })).situation).toBe('chat:warmth')
  })

  it('lets warmth be favorable and a rebuke adverse', () => {
    expect(contactFromTurn(turn({ text: '太好了，谢谢' })).outcome).toBe('favorable')
    expect(contactFromTurn(turn({ text: '不对' })).outcome).toBe('adverse')
  })

  it('makes several adverse acts at once land harder than any one alone', () => {
    const single = contactFromTurn(turn({ text: '不对' }))
    const stacked = contactFromTurn(turn({
      text: '不对',
      previousText: '不对',
      midTurn: true,
      assistantChars: 2000,
    }))
    expect(stacked.intensity).toBeGreaterThan(single.intensity)
    expect(stacked.intensity).toBeLessThanOrEqual(1)
  })

  it('treats an ordinary reply as neither good nor bad', () => {
    expect(contactFromTurn(turn()).outcome).toBe('neutral')
  })
})

describe('following one conversation', () => {
  it('reads the first turn as an opening and the next as a reply', () => {
    const tracker = new ChatTracker()
    expect(classifyTurn(tracker.userSaid('hi', T0))).toContain('opening')
    expect(classifyTurn(tracker.userSaid('and another thing', T0 + 1000))).toEqual(['reply'])
  })

  it('measures terseness against what the agent said in that exchange only', () => {
    const tracker = new ChatTracker()
    tracker.userSaid('explain the whole design', T0)
    tracker.assistantSaid(2000)
    expect(classifyTurn(tracker.userSaid('嗯', T0 + 60_000))).toContain('terse')
    // The next short turn follows a short answer, so it is just a short turn.
    tracker.assistantSaid(30)
    expect(classifyTurn(tracker.userSaid('嗯', T0 + 120_000))).not.toContain('terse')
  })

  it('marks a turn that arrived while the agent was working', () => {
    const tracker = new ChatTracker()
    tracker.userSaid('go', T0)
    tracker.turnStarted()
    expect(classifyTurn(tracker.userSaid('wait, stop', T0 + 5_000))).toContain('interruption')
    tracker.turnEnded()
    expect(classifyTurn(tracker.userSaid('carry on', T0 + 6_000))).not.toContain('interruption')
  })

  it('carries the previous turn forward so a restatement is visible', () => {
    const tracker = new ChatTracker()
    tracker.userSaid('how does the retry limit work', T0)
    expect(classifyTurn(tracker.userSaid('how does the retry limit work again', T0 + 30_000)))
      .toContain('repeat')
  })

  it('notices the silence between two turns', () => {
    const tracker = new ChatTracker()
    tracker.userSaid('night', T0)
    expect(classifyTurn(tracker.userSaid('back', T0 + SILENCE_MS + 1))).toContain('return')
  })
})
