/**
 * In-memory stand-ins for the harness services the plugin injects, so a spec
 * can boot the real `CittaService` in a real Cordis context without the
 * storage, prompt, or tool runtimes.
 * @module dsh-yogacara/tests/helpers/harness
 */

import { Context } from '@deepseek-ai/cordis'
import CittaService from '../../src/index.ts'
import type { Config } from '../../src/index.ts'

/** In-memory stand-in for one storage-domain table. */
export class FakeTable<V> {
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
export class FakeDomain {
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
export class FakeFacility {
  readonly opened: FakeDomain[] = []

  open(spec: { name: string; global?: { initial: unknown } }): Promise<FakeDomain> {
    const domain = new FakeDomain(spec.name, spec.global?.initial)
    this.opened.push(domain)
    return Promise.resolve(domain)
  }
}

/** Records what the plugin contributes to the prompt. */
export class FakePrompt {
  readonly sections: { name: string; order: number; text: (context: unknown) => string }[] = []

  section(section: { name: string; order: number; text: unknown }): () => void {
    this.sections.push(section as { name: string; order: number; text: (context: unknown) => string })
    return () => undefined
  }
}

/** The parts of a registered tool a spec drives directly. */
export interface RegisteredTool {
  readonly name: string
  readonly description: string
  readonly output: {
    readonly render: (args: never, value: never) => unknown
    readonly presentationMeta?: (args: never, value: never) => unknown
  }
  readonly execute: (args: never, exec: unknown) => unknown
  readonly presentCall?: (args: never) => unknown
  readonly presentResult?: (
    args: never,
    result: { content: unknown[]; isError: boolean; meta?: unknown },
  ) => { card: string; title?: string } | undefined
}

/** Records what the plugin registers as model-facing tools. */
export class FakeTools {
  readonly registered: RegisteredTool[] = []

  register(definition: unknown): () => void {
    this.registered.push(definition as RegisteredTool)
    return () => undefined
  }

  /**
   * One registered tool by name.
   * @param name - Model-facing tool name.
   * @returns the definition.
   * @throws Error when no tool of that name was registered.
   */
  get(name: string): RegisteredTool {
    const tool = this.registered.find(entry => entry.name === name)
    if (tool === undefined) throw new Error(`no tool named ${name} was registered`)
    return tool
  }
}

/**
 * Boot a context with the plugin over in-memory stand-ins for the harness
 * services it uses.
 * @param config - Config overrides.
 * @returns the context and the stand-ins.
 */
export async function boot(config: Partial<Config> = {}) {
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
export function emit(ctx: Context, ...args: unknown[]): void {
  ;(ctx as unknown as { emit: (...args: unknown[]) => void }).emit(...args)
}

