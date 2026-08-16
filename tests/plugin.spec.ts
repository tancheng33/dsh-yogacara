import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import CittaService, { assertDomainName, defineAlayaDomain } from '../src/index.ts'
import type { Config } from '../src/index.ts'
import type { Seed } from '../src/types.ts'

/** In-memory stand-in for one storage-domain table. */
class FakeTable<V> {
  readonly records = new Map<string, V>()

  get(key: string): V | undefined {
    return this.records.get(key)
  }

  entries(): IterableIterator<[string, V]> {
    return new Map(this.records).entries()
  }

  keys(): IterableIterator<string> {
    return new Map(this.records).keys()
  }

  get size(): number {
    return this.records.size
  }

  put(key: string, value: V): Promise<void> {
    this.records.set(key, value)
    return Promise.resolve()
  }

  delete(key: string): Promise<boolean> {
    return Promise.resolve(this.records.delete(key))
  }

  update(key: string, fn: (current: V) => V): Promise<V> {
    const current = this.records.get(key)
    if (current === undefined) return Promise.reject(new Error('missing-key'))
    const next = fn(current)
    this.records.set(key, next)
    return Promise.resolve(next)
  }
}

/** In-memory stand-in for one open domain. */
class FakeDomain {
  readonly tables = new Map<string, FakeTable<unknown>>()
  closed = false
  globalValue: unknown

  constructor(readonly name: string, initial: unknown) {
    this.globalValue = initial
  }

  readonly global = {
    get: (): unknown => this.globalValue,
    set: (value: unknown): Promise<void> => {
      this.globalValue = value
      return Promise.resolve()
    },
  }

  table(name: string): FakeTable<unknown> {
    let table = this.tables.get(name)
    if (table === undefined) {
      table = new FakeTable()
      this.tables.set(name, table)
    }
    return table
  }

  close(): Promise<void> {
    this.closed = true
    return Promise.resolve()
  }
}

/** The facility the service injects. */
class FakeFacility {
  readonly opened: FakeDomain[] = []

  open(spec: { name: string; global?: { initial: unknown } }): Promise<FakeDomain> {
    const domain = new FakeDomain(spec.name, spec.global?.initial)
    this.opened.push(domain)
    return Promise.resolve(domain)
  }
}

/** Records what the plugin contributes to the prompt. */
class FakePrompt {
  readonly sections: { name: string; order: number; text: (context: unknown) => string }[] = []

  section(section: { name: string; order: number; text: unknown }): () => void {
    this.sections.push(section as { name: string; order: number; text: (context: unknown) => string })
    return () => undefined
  }
}

/** Records what the plugin registers as model-facing tools. */
class FakeTools {
  readonly registered: { name: string; description: string; execute: (args: never, exec: unknown) => unknown }[] = []

  register(definition: unknown): () => void {
    this.registered.push(definition as FakeTools['registered'][number])
    return () => undefined
  }
}

/**
 * Boot a context with the plugin over in-memory stand-ins for the harness
 * services it uses.
 * @param config - Config overrides.
 * @returns the context and the stand-ins.
 */
async function boot(config: Partial<Config> = {}) {
  const ctx = new Context()
  const facility = new FakeFacility()
  const prompt = new FakePrompt()
  const tools = new FakeTools()
  ctx.provide('storageDomain', facility)
  ctx.provide('systemPrompt', prompt)
  ctx.provide('tools', tools)
  // The loader fills defaults from the static Config schema; the type demands
  // the whole shape, so a partial override is passed through it.
  const fiber = await ctx.plugin(CittaService, config as Config)
  return { ctx, facility, prompt, tools, fiber }
}

/**
 * Emit a harness event the plugin listens for, without the tool runtime that
 * normally owns its signature.
 * @param ctx - The booted context.
 * @param args - Event name followed by its payload.
 */
function emit(ctx: Context, ...args: unknown[]): void {
  ;(ctx as unknown as { emit: (...args: unknown[]) => void }).emit(...args)
}

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

    const rendered = prompt.sections[0]!.text({})
    expect(rendered).toContain('<self_state>')
    expect(rendered).toContain('受 feeling: 苦')
    expect(rendered).toContain('bash:pytest')
    expect(rendered).toContain('run the baseline')
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
    expect(ctx.citta.seedsFor('bash:pytest--q')[0]?.seed.gate).toBe('tongue')
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
