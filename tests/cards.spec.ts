import { describe, expect, it } from 'vitest'
import { boot } from './helpers/harness.ts'
import type { RegisteredTool } from './helpers/harness.ts'

/**
 * Drive one tool end to end the way the runtime does: execute, project the
 * durable card data, then present the completed card from that projection
 * alone — which is all a replay has.
 * @param tool - The registered definition.
 * @param args - Model-supplied arguments.
 * @returns the canonical value and the completed card.
 */
async function complete(tool: RegisteredTool, args: unknown) {
  const value = await (tool.execute as (a: unknown, e: unknown) => Promise<unknown>)(args, {})
  const meta = tool.output.presentationMeta === undefined
    ? undefined
    : (tool.output.presentationMeta as (a: unknown, v: unknown) => unknown)(args, value)
  const card = tool.presentResult === undefined
    ? undefined
    : (tool.presentResult as (a: unknown, r: unknown) => { card: string; title?: string } | undefined)(
        args, { content: [], isError: false, meta })
  return { value, meta, card }
}

describe('the cards a UI renders', () => {
  it('titles a reflection with the readings that matter, not the tool name', async () => {
    const { ctx, tools } = await boot()
    await ctx.citta.receive({
      gate: 'body', situation: 'bash:migrate', outcome: 'adverse', intensity: 0.9, at: Date.now(),
    })
    const { card } = await complete(tools.get('self_reflect'), { situation: 'bash:migrate' })
    expect(card?.card).toBe('generic')
    expect(card?.title).toMatch(/受 苦/)
    expect(card?.title).toContain('种子 1')
  })

  it('says so plainly when there is nothing active', async () => {
    const { tools } = await boot()
    const { card } = await complete(tools.get('self_reflect'), {})
    expect(card?.title).toBe('心寂静 — nothing active')
  })

  it('titles an appraisal with the contact, the feeling, and the seed count', async () => {
    const { tools } = await boot()
    const { card } = await complete(tools.get('self_appraise'), {
      gate: 'tongue', situation: 'bash:pytest', outcome: 'adverse', intensity: 0.8,
    })
    expect(card?.title).toContain('触 bash:pytest')
    expect(card?.title).toContain('受 苦')
    expect(card?.title).toContain('种子 ×1')
  })

  it('titles a recall with how much of the store matched', async () => {
    const { ctx, tools } = await boot()
    const at = Date.now()
    await ctx.citta.receive({ gate: 'eye', situation: 'read:a.ts', outcome: 'favorable', intensity: 0.5, at })
    await ctx.citta.receive({ gate: 'eye', situation: 'read:b.ts', outcome: 'favorable', intensity: 0.5, at })

    const matched = await complete(tools.get('self_recall'), { situation: 'read:a.ts' })
    expect(matched.card?.title).toMatch(/^阿赖耶 \d+\/2 seeds · read:a\.ts$/)

    const missed = await complete(tools.get('self_recall'), { situation: 'deploy:prod' })
    expect(missed.card?.title).toBe('阿赖耶 — no precedent')
  })

  it('titles a turning with the movement it caused', async () => {
    const { ctx, tools } = await boot()
    const at = Date.now()
    for (let index = 0; index < 3; index += 1) {
      await ctx.citta.receive({
        gate: 'body', situation: 'bash:flaky', outcome: 'adverse', intensity: 0.9, at: at + index,
      })
    }
    const { card } = await complete(tools.get('self_transform'), { affliction: 'auddhatya' })
    expect(card?.title).toContain('转依 掉举 → 行舍')
    expect(card?.title).toContain('(平等性智)')
    expect(card?.title).toMatch(/0\.\d\d → 0\.\d\d/)
  })

  it('falls back to generic rendering rather than throwing on a replay without meta', async () => {
    const { tools } = await boot()
    for (const name of ['self_reflect', 'self_appraise', 'self_recall', 'self_transform']) {
      const tool = tools.get(name)
      const present = tool.presentResult as (a: unknown, r: unknown) => unknown
      // Older logs, a nested dispatch, or a failed call: no usable projection.
      expect(present({}, { content: [], isError: false })).toBeUndefined()
      expect(present({}, { content: [], isError: false, meta: 'not an object' })).toBeUndefined()
      expect(present({}, { content: [], isError: true, meta: { feeling: 'duhkha' } })).toBeUndefined()
    }
  })

  it('keeps every projection JSON-serializable, since it is persisted', async () => {
    const { ctx, tools } = await boot()
    await ctx.citta.receive({
      gate: 'ear', situation: 'review:pr-1', outcome: 'adverse', intensity: 0.6, at: Date.now(),
    })
    for (const [name, args] of [
      ['self_reflect', { situation: 'review:pr-1' }],
      ['self_appraise', { gate: 'ear', situation: 'review:pr-1', outcome: 'adverse' }],
      ['self_recall', {}],
      ['self_transform', { affliction: 'atma-mana' }],
    ] as const) {
      const { meta } = await complete(tools.get(name), args)
      expect(meta, `${name} projects no card data`).toBeDefined()
      expect(() => JSON.parse(JSON.stringify(meta))).not.toThrow()
      expect(JSON.parse(JSON.stringify(meta))).toEqual(meta)
    }
  })
})
