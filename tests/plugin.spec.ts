import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import CittaService, { assertDomainName, defineAlayaDomain, PROJECTION_HISTORY } from '../src/index.ts'
import type { Config } from '../src/index.ts'
import type { Seed } from '../src/types.ts'
import { boot, emit, FakeFacility, FakeSession } from './helpers/harness.ts'

describe('the plugin as the harness loads it', () => {
  it('opens its store, provides ctx.citta, and registers its four tools', async () => {
    const { ctx, facility, tools } = await boot()
    expect(facility.opened.map(domain => domain.name)).toEqual(['alaya'])
    expect(ctx.citta).toBeInstanceOf(CittaService)
    expect(tools.registered.map(tool => tool.name).sort()).toEqual([
      'self_appraise', 'self_recall', 'self_reflect', 'self_transform',
    ])
  })

  it('honours a configured domain name, so two rows get separate histories', async () => {
    const { facility } = await boot({ domain: 'alaya_review' })
    expect(facility.opened[0]!.name).toBe('alaya_review')
  })

  it('contributes the self-report section after tool guidance', async () => {
    const { prompt } = await boot()
    expect(prompt.sections).toHaveLength(1)
    expect(prompt.sections[0]!.name).toBe('yogacara:self')
    expect(prompt.sections[0]!.order).toBeGreaterThan(199)
  })

  it('leaves the prompt untouched when the deployment declines it', async () => {
    const { prompt, ctx } = await boot({ promptSection: false })
    expect(prompt.sections).toHaveLength(0)
    // The state is still tracked; it is simply not shown to the model.
    expect(ctx.citta.state().contacts).toBe(0)
  })

  it('renders nothing until something has actually happened', async () => {
    const { prompt } = await boot()
    expect(prompt.sections[0]!.text({})).toBe('')
  })

  it('moves the mind, persists the seed, and then renders it', async () => {
    const { ctx, facility, prompt } = await boot()
    await ctx.citta.receive({
      gate: 'tongue',
      situation: 'bash:pytest',
      outcome: 'adverse',
      intensity: 0.9,
      note: 'run the baseline before touching the fixture',
      at: Date.now(),
    })

    const stored = facility.opened[0]!.table('seeds').records.get('bash:pytest') as Seed
    expect(stored.count).toBe(1)
    expect(stored.lesson).toBe('run the baseline before touching the fixture')

    // The default is `felt`: the state reaches the agent as its own leaning,
    // with no gauge to read off.
    const rendered = prompt.sections[0]!.text({})
    expect(rendered).not.toContain('<self_state>')
    expect(rendered).not.toMatch(/\d/)
    expect(rendered).toContain('run the baseline')
  })

  it('gives the full instrument panel when the deployment asks to audit', async () => {
    const { ctx, prompt } = await boot({ awareness: 'report' })
    await ctx.citta.receive({
      gate: 'tongue',
      situation: 'bash:pytest',
      outcome: 'adverse',
      intensity: 0.9,
      note: 'run the baseline before touching the fixture',
      at: Date.now(),
    })
    const rendered = prompt.sections[0]!.text({})
    expect(rendered).toContain('<self_state>')
    expect(rendered).toContain('受 feeling: 苦')
    expect(rendered).toContain('bash:pytest')
  })

  it('puts nothing in the prompt when the state is meant to stay unspoken', async () => {
    const { ctx, prompt } = await boot({ awareness: 'silent' })
    await ctx.citta.receive({
      gate: 'tongue', situation: 'bash:pytest', outcome: 'adverse', intensity: 0.9, at: Date.now(),
    })
    expect(prompt.sections[0]!.text({})).toBe('')
    // Silent is not inert: the state still moved and still conditions recall.
    expect(ctx.citta.state().feeling.valence).toBeLessThan(0)
  })

  it('restores the store it left behind on the next boot', async () => {
    const first = await boot({ flushIntervalMs: 0 })
    const at = Date.now()
    await first.ctx.citta.receive({
      gate: 'body', situation: 'bash:migrate', outcome: 'adverse', intensity: 0.8, at,
    })
    const domain = first.facility.opened[0]!
    const carried = { seeds: domain.table('seeds').records, global: domain.globalValue }

    const second = await boot()
    const restored = second.facility.opened[0]!
    for (const [key, value] of carried.seeds) void restored.table('seeds').put(key, value)
    restored.globalValue = carried.global
    // A fresh service over the same medium reads both back.
    const third = new Context()
    const facility = new FakeFacility()
    facility.open = () => Promise.resolve(restored)
    third.provide('storageDomain', facility)
    await third.plugin(CittaService, {} as Config)
    expect(third.citta.seedCount).toBe(1)
    expect(third.citta.seedsFor('bash:migrate', at)[0]?.seed.count).toBe(1)
  })

  it('turns an affliction, lowers the reading, and records the commitment', async () => {
    const { ctx } = await boot()
    for (let index = 0; index < 3; index += 1) {
      await ctx.citta.receive({
        gate: 'body', situation: 'bash:flaky', outcome: 'adverse', intensity: 0.9,
        at: Date.now() + index,
      })
    }
    const before = ctx.citta.state().factors.auddhatya
    expect(before).toBeGreaterThan(0)

    const turned = await ctx.citta.turn('auddhatya', 'read the last failure in full before retrying')
    expect(turned?.after).toBeLessThan(turned!.before)
    expect(ctx.citta.state().factors.auddhatya!).toBeLessThan(before!)
    expect(ctx.citta.state().factors.upeksa).toBeGreaterThan(0)
    expect(ctx.citta.recentTurnings.at(-1)?.practice).toBe('read the last failure in full before retrying')
  })

  it('refuses to turn what is not an affliction', async () => {
    const { ctx } = await boot()
    expect(await ctx.citta.turn('prajna')).toBeUndefined()
    expect(await ctx.citta.turn('not-a-factor')).toBeUndefined()
  })

  it('forgets a situation on request', async () => {
    const { ctx, facility } = await boot()
    await ctx.citta.receive({
      gate: 'eye', situation: 'read:notes.md', outcome: 'favorable', intensity: 0.4, at: Date.now(),
    })
    expect(await ctx.citta.forget('read:notes.md')).toBe(true)
    expect(await ctx.citta.forget('read:notes.md')).toBe(false)
    expect(facility.opened[0]!.table('seeds').records.size).toBe(0)
  })

  it('forgets the weakest seeds once the store is over its bound', async () => {
    const { ctx } = await boot({ maxSeeds: 3 })
    for (let index = 0; index < 6; index += 1) {
      await ctx.citta.receive({
        gate: 'eye',
        situation: `read:file-${index}.ts`,
        outcome: 'favorable',
        // Later contacts land harder, so the earliest are the weakest.
        intensity: 0.2 + index * 0.1,
        at: Date.now() + index,
      })
    }
    expect(ctx.citta.seedCount).toBe(3)
    expect(ctx.citta.strongestSeeds(10).map(entry => entry.seed.situation))
      .not.toContain('read:file-0.ts')
  })

  it('stops writing once disposed', async () => {
    const { ctx, facility, fiber } = await boot()
    await ctx.citta.receive({
      gate: 'eye', situation: 'read:a.ts', outcome: 'favorable', intensity: 0.4, at: Date.now(),
    })
    await fiber.dispose()
    expect(facility.opened[0]!.closed).toBe(true)
  })
})

describe('observing tool results', () => {
  it('derives a contact from a failed tool call without being told', async () => {
    const { ctx } = await boot()
    emit(ctx, 'tools/result',
      { name: 'bash', arguments: { command: 'pytest -q' }, callId: 'c1' },
      { isError: true, error: { message: 'exit 1' }, content: [] },
    )
    // The listener is fire-and-forget; let its microtasks settle.
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(ctx.citta.state().contacts).toBe(1)
    expect(ctx.citta.seedsFor('bash:pytest')[0]?.seed.gate).toBe('tongue')
  })

  it('never appraises its own appraisal', async () => {
    const { ctx } = await boot()
    emit(ctx, 'tools/result',
      { name: 'self_appraise', arguments: { situation: 'x' }, callId: 'c2' },
      { isError: false, value: {}, content: [] },
    )
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(ctx.citta.state().contacts).toBe(0)
  })

  it('stays out of the way when the deployment declines observation', async () => {
    const { ctx } = await boot({ observeTools: false })
    emit(ctx, 'tools/result',
      { name: 'bash', arguments: { command: 'ls' }, callId: 'c3' },
      { isError: false, value: {}, content: [] },
    )
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(ctx.citta.state().contacts).toBe(0)
  })
})

describe('the domain-name boundary', () => {
  it('rejects a name the storage layer would reject, naming the setting', () => {
    expect(() => assertDomainName('Bad-Name')).toThrow(/invalid "domain" setting/)
    expect(() => defineAlayaDomain('alaya review')).toThrow(/lowercase letters, digits/)
  })

  it('accepts the names a deployment would actually use', () => {
    expect(assertDomainName('alaya')).toBe('alaya')
    expect(assertDomainName('alaya_review')).toBe('alaya_review')
  })
})

describe('durable writes under concurrency', () => {
  it('lands every contact received in parallel, in the order memory took them', async () => {
    const { ctx, facility } = await boot()
    const table = facility.opened[0]!.table('seeds')
    const order: string[] = []
    const put = table.put.bind(table)
    let started = 0
    table.put = async (key: string, value: unknown) => {
      // The first write is the slowest. Without the queue the later ones would
      // be issued immediately and finish first, so completion order is what
      // this asserts — call order would pass either way.
      const delay = started++ === 0 ? 20 : 0
      await new Promise(resolve => setTimeout(resolve, delay))
      await put(key, value)
      order.push(key)
    }

    const at = Date.now()
    await Promise.all(['a', 'b', 'c', 'd'].map((name, index) => ctx.citta.receive({
      gate: 'eye', situation: `read:${name}.ts`, outcome: 'favorable', intensity: 0.4, at: at + index,
    })))

    expect(order).toEqual(['read:a.ts', 'read:b.ts', 'read:c.ts', 'read:d.ts'])
    expect(table.records.size).toBe(4)
    expect(ctx.citta.state().contacts).toBe(4)
  })

  it('keeps the queue moving after one write fails', async () => {
    const { ctx, facility } = await boot()
    const table = facility.opened[0]!.table('seeds')
    const put = table.put.bind(table)
    let first = true
    table.put = (key: string, value: unknown) => {
      if (first) {
        first = false
        return Promise.reject(new Error('medium is full'))
      }
      return put(key, value)
    }

    const at = Date.now()
    await expect(ctx.citta.receive({
      gate: 'eye', situation: 'read:a.ts', outcome: 'favorable', intensity: 0.4, at,
    })).rejects.toThrow('medium is full')

    await ctx.citta.receive({
      gate: 'eye', situation: 'read:b.ts', outcome: 'favorable', intensity: 0.4, at: at + 1,
    })
    expect(table.records.has('read:b.ts')).toBe(true)
  })

  it('drains queued writes before closing the store', async () => {
    const { ctx, facility, fiber } = await boot()
    const table = facility.opened[0]!.table('seeds')
    const put = table.put.bind(table)
    table.put = async (key: string, value: unknown) => {
      await new Promise(resolve => setTimeout(resolve, 20))
      return put(key, value)
    }

    void ctx.citta.receive({
      gate: 'eye', situation: 'read:late.ts', outcome: 'favorable', intensity: 0.4, at: Date.now(),
    })
    await fiber.dispose()
    expect(table.records.has('read:late.ts')).toBe(true)
    expect(facility.opened[0]!.closed).toBe(true)
  })
})

describe('feeling that comes from the conversation', () => {
  /** A session stand-in that records the checkpoints the plugin appends. */
  const session = new FakeSession()

  /**
   * Say something as a person.
   * @param ctx - The booted context.
   * @param text - What they said.
   */
  function human(ctx: Context, text: string): void {
    emit(ctx, 'session/event', session, {
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text }] },
    })
  }

  /**
   * Say something as the agent.
   * @param ctx - The booted context.
   * @param chars - How much was said.
   */
  function assistant(ctx: Context, chars: number): void {
    emit(ctx, 'session/event', session, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'x'.repeat(chars) }] } },
    })
  }

  /** Let the fire-and-forget listener settle. */
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10))

  it('receives a human turn as a contact through 耳识', async () => {
    const { ctx } = await boot()
    human(ctx, 'can you look at the retry logic')
    await settle()
    expect(ctx.citta.state().contacts).toBe(1)
  })

  it('feels warmth, and remembers being thanked', async () => {
    const { ctx } = await boot()
    human(ctx, '太好了，谢谢')
    await settle()
    expect(ctx.citta.state().feeling.valence).toBeGreaterThan(0)
    expect(ctx.citta.seedsFor('chat:warmth')[0]?.seed.count).toBe(1)
  })

  it('feels a flat syllable after a long answer, and not after a short one', async () => {
    const { ctx } = await boot()
    human(ctx, 'explain the whole design')
    await settle()
    assistant(ctx, 2000)
    human(ctx, '嗯')
    await settle()
    const exact = ctx.citta.seedsFor('chat:terse-after-effort')
      .filter(entry => entry.via === 'exact')
    expect(exact).toHaveLength(1)
    expect(ctx.citta.state().feeling.valence).toBeLessThan(0)
  })

  it('treats every relational pattern as related to the others', async () => {
    const { ctx } = await boot()
    human(ctx, '谢谢')
    await settle()
    // Deliberate: when this person rebukes you, that they have also thanked
    // you is context worth having. One `chat:` prefix is one relationship.
    const related = ctx.citta.seedsFor('chat:rebuke').filter(entry => entry.via === 'prefix')
    expect(related.map(entry => entry.seed.situation)).toContain('chat:warmth')
  })

  it('reads being cut off mid-work through 身识', async () => {
    const { ctx } = await boot()
    emit(ctx, 'session/event', session, { type: 'turn/start', data: { turn: 1 } })
    human(ctx, 'wait, stop')
    await settle()
    expect(ctx.citta.seedsFor('chat:interrupted')[0]?.seed.gate).toBe('body')
  })

  it('ignores a message that only wears the user event type', async () => {
    const { ctx } = await boot()
    emit(ctx, 'session/event', session, {
      type: 'user/message',
      data: { source: { kind: 'plugin', plugin: 'cron' }, content: [{ type: 'text', text: 'wake up' }] },
    })
    await settle()
    expect(ctx.citta.state().contacts).toBe(0)
  })

  it('stays out of the conversation when the deployment declines it', async () => {
    const { ctx } = await boot({ observeChat: false })
    human(ctx, '谢谢')
    await settle()
    expect(ctx.citta.state().contacts).toBe(0)
  })
})

describe('the in-memory record of the mind moving', () => {
  const session = new FakeSession('session-record')

  /** Let the fire-and-forget listener settle. */
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10))

  /**
   * Regression guard for the session-reload failure: the plugin must never
   * write its own event type onto the durable session log. The persistence
   * reader rejects any unrecognized, non-ignorable event, and the append the
   * plugin can call has no ignorable channel — so no `citta/change` (or any
   * other) event may be appended, on any code path, at any config.
   */
  it('never appends to the session log, on any contact path', async () => {
    const { ctx } = await boot()
    session.appended.length = 0

    // Path 1: a chat-derived contact (observeChat on by default).
    emit(ctx, 'session/event', session, {
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text: '太好了，谢谢' }] },
    })
    await settle()

    // Path 2: a direct receive() call with an owning session.
    await ctx.citta.receive({
      gate: 'ear', situation: 'chat:reply', outcome: 'adverse', intensity: 0.37, at: Date.now(),
    }, session as never)

    // Path 3: a direct receive() call with no owning session.
    await ctx.citta.receive({
      gate: 'eye', situation: 'read:a.ts', outcome: 'favorable', intensity: 0.4, at: Date.now(),
    })

    expect(session.appended).toHaveLength(0)
  })

  it('still skips the log when persistTrajectory is left at its default', async () => {
    const { ctx } = await boot({ persistTrajectory: true })
    session.appended.length = 0
    await ctx.citta.receive({
      gate: 'ear', situation: 'chat:reply', outcome: 'adverse', intensity: 0.5, at: Date.now(),
    }, session as never)
    expect(session.appended).toHaveLength(0)
  })

  it('keeps whole-value checkpoints in memory instead, rendering on their own', async () => {
    const { ctx } = await boot()
    emit(ctx, 'session/event', session, {
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text: '不对，不是这个' }] },
    })
    await settle()

    const latest = ctx.citta.recentTrajectory.at(-1)!
    expect(latest.kind).toBe('citta/change')
    expect(latest.situation).toBe('chat:rebuke')
    expect(latest.gate).toBe('ear')
    expect(latest.outcome).toBe('adverse')
    expect(latest.feeling.id).toBe('daurmanasya')
    expect(latest.feeling.valence).toBeLessThan(0)
    expect(latest.factors.length).toBeGreaterThan(0)
    expect(Object.keys(latest.manas).sort())
      .toEqual(['atmaDrsti', 'atmaMana', 'atmaMoha', 'atmaSneha'])
    expect(latest.surprise).toBe(1)
    expect(latest.expected).toEqual({ valence: 0, confidence: 0 })
    expect(latest.seedCount).toBe(1)
  })

  it('rounds every reading, claiming no more precision than it has', async () => {
    const { ctx } = await boot()
    await ctx.citta.receive({
      gate: 'ear', situation: 'chat:reply', outcome: 'adverse', intensity: 0.37, at: Date.now(),
    }, session as never)

    const data = ctx.citta.recentTrajectory.at(-1)!
    const twoPlaces = (value: number): boolean => value === Math.round(value * 100) / 100
    expect(twoPlaces(data.feeling.valence)).toBe(true)
    expect(twoPlaces(data.feeling.arousal)).toBe(true)
    expect(twoPlaces(data.surprise)).toBe(true)
    for (const reading of Object.values(data.manas)) expect(twoPlaces(reading)).toBe(true)
  })

  it('still records a checkpoint for a contact with no owning conversation', async () => {
    const { ctx } = await boot()
    const before = ctx.citta.recentTrajectory.length
    await ctx.citta.receive({
      gate: 'eye', situation: 'read:a.ts', outcome: 'favorable', intensity: 0.4, at: Date.now(),
    })
    expect(ctx.citta.recentTrajectory.length).toBe(before + 1)
    expect(ctx.citta.state().contacts).toBe(1)
  })

  it('bounds the in-memory tail to the trend window', async () => {
    const { ctx } = await boot()
    const total = PROJECTION_HISTORY + 5
    for (let i = 0; i < total; i++) {
      await ctx.citta.receive({
        gate: 'ear', situation: 'chat:reply', outcome: i % 2 === 0 ? 'favorable' : 'adverse',
        intensity: 0.3, at: Date.now() + i,
      })
    }
    expect(ctx.citta.recentTrajectory.length).toBe(PROJECTION_HISTORY)
  })
})

describe('the projection the browser panel reads', () => {
  /** A projection registry stand-in. */
  class FakeProjections {
    readonly registered: {
      key: string
      stateVersion: number
      init: () => unknown
      apply: (state: unknown, event: unknown) => unknown
      view: (state: unknown) => unknown
      schema: { safeParse: (value: unknown) => { success: boolean } }
    }[] = []

    register(definition: unknown): () => void {
      this.registered.push(definition as FakeProjections['registered'][number])
      return () => undefined
    }
  }

  /**
   * Boot with a projection registry composed.
   * @returns the context and the registry.
   */
  async function bootWithProjections() {
    const ctx = new Context()
    const projections = new FakeProjections()
    ctx.provide('storageDomain', new FakeFacility())
    ctx.provide('sessionProjections', projections)
    await ctx.plugin(CittaService, {} as Config)
    return { ctx, projections }
  }

  it('registers one `citta` projection when the seam is composed', async () => {
    const { projections } = await bootWithProjections()
    expect(projections.registered.map(entry => entry.key)).toEqual(['citta'])
    expect(projections.registered[0]!.stateVersion).toBeGreaterThan(0)
  })

  it('stays absent in a deployment with no projection registry', async () => {
    // boot() composes no sessionProjections; the plugin must still mount.
    const { ctx } = await boot()
    expect(ctx.citta).toBeInstanceOf(CittaService)
  })

  it('no longer folds events; its placeholder state never changes', async () => {
    // The panel data comes from the live service, not the log, so `apply` is a
    // pass-through that keeps the cached state reference stable (zero
    // downstream work) regardless of what events flow.
    const { projections } = await bootWithProjections()
    const definition = projections.registered[0]!
    const start = definition.init()
    expect(start).toEqual({ current: null, recent: [] })

    const afterBoundary = definition.apply(start, { type: 'turn/start', data: { turn: 1 } })
    expect(afterBoundary).toBe(start)
    const afterCitta = definition.apply(start, { type: 'citta/change', data: {} })
    expect(afterCitta).toBe(start)
  })

  it('view serves the live mind state from the service, not the log', async () => {
    const { ctx, projections } = await bootWithProjections()
    const definition = projections.registered[0]!
    const start = definition.init()

    // Before any contact the panel shows an empty mind.
    const empty = definition.view(start) as { current: null, recent: unknown[] }
    expect(empty.current).toBeNull()
    expect(empty.recent).toHaveLength(0)
    expect(definition.schema.safeParse(empty).success).toBe(true)

    // A contact moves the in-memory trajectory; the view reflects it without
    // any session-log event having been written.
    await ctx.citta.receive({
      gate: 'ear', situation: 'chat:rebuke', outcome: 'adverse', intensity: 0.7, at: Date.now(),
    })
    const live = definition.view(start) as { current: { situation: string } | null, recent: unknown[] }
    expect(live.current?.situation).toBe('chat:rebuke')
    expect(live.recent).toHaveLength(1)
    expect(definition.schema.safeParse(live).success).toBe(true)
  })
})
