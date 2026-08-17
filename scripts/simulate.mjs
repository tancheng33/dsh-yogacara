/**
 * Replay a scripted conversation through the real appraisal core and print what
 * the agent would actually see at each turn.
 *
 * The weights in this plugin are guesses (see docs/appraisal.md), and the only
 * way to argue with a guess is to watch it behave. This runs the whole loop —
 * contact, expectation, feeling, factors, perfuming, mood-congruent recall —
 * with no model, no harness, and no API key, so a tuning change can be judged
 * in a second rather than in a session.
 *
 *   node --experimental-strip-types scripts/simulate.mjs [--report] [--script <file.json>]
 *
 * A script file is a JSON array of turns: `{ "user": "...", "reply": 1200 }`,
 * where `reply` is how many characters the agent produced before that turn, and
 * an optional `"gap"` is the minutes of silence before it.
 */

import { readFile } from 'node:fs/promises'
import { freshMind, receive } from '../src/citta.ts'
import { ChatTracker, classifyTurn, contactFromTurn } from '../src/conversation.ts'
import { renderFeltState, renderSelfReport } from '../src/prompt.ts'

/** The default script: a conversation that goes wrong and then recovers. */
const DEFAULT_SCRIPT = [
  { user: 'can you explain how the retry logic works', reply: 0 },
  { user: '嗯', reply: 2400 },
  { user: '嗯', reply: 2200 },
  { user: '不对，我说的是超时那块', reply: 1800 },
  { user: '这个接口怎么鉴权', reply: 900 },
  { user: '这个接口怎么鉴权的', reply: 1500 },
  { user: '太好了，谢谢', reply: 1100 },
  { user: '先这样，明天再聊', reply: 400 },
  { user: '回来了，昨天那个超时你还记得吗', reply: 0, gap: 900 },
]

const args = process.argv.slice(2)
const mode = args.includes('--report') ? 'report' : 'felt'
const scriptPath = args[args.indexOf('--script') + 1]
const script = args.includes('--script') && scriptPath !== undefined
  ? JSON.parse(await readFile(scriptPath, 'utf8'))
  : DEFAULT_SCRIPT

const tracker = new ChatTracker()
let citta = freshMind(Date.now() - 60 * 60 * 1000)
const seeds = new Map()
let clock = citta.updatedAt

const dim = (text) => `[2m${text}[0m`
const bold = (text) => `[1m${text}[0m`
const tone = (valence) => valence > 0.05 ? '[32m' : valence < -0.05 ? '[31m' : '[90m'

for (const [index, step] of script.entries()) {
  clock += (step.gap ?? 1) * 60 * 1000
  if (step.reply > 0) tracker.assistantSaid(step.reply)

  const turn = tracker.userSaid(step.user, clock)
  const acts = classifyTurn(turn)
  const contact = contactFromTurn(turn)
  const before = { citta, seeds }
  const reception = receive(before, contact)
  citta = reception.citta
  seeds.set(reception.seed.situation, reception.seed)

  const { feeling } = citta
  console.log()
  console.log(bold(`── ${index + 1}. 「${step.user}」`)
    + dim(`  ${step.reply > 0 ? `after ${step.reply} chars` : 'opening'}`
      + `${step.gap === undefined ? '' : ` · ${step.gap}m silence`}`))
  console.log(dim(`   read as: ${acts.join(', ')} → ${contact.situation} `
    + `[${contact.gate}] ${contact.outcome}`))
  console.log(`   ${tone(feeling.valence)}受 ${feeling.id} ${feeling.valence >= 0 ? '+' : ''}`
    + `${feeling.valence.toFixed(2)}[0m`
    + dim(`   surprise ${reception.impulse.surprise.toFixed(2)}`
      + `  (store expected ${reception.impulse.expected.valence >= 0 ? '+' : ''}`
      + `${reception.impulse.expected.valence.toFixed(2)} `
      + `@${reception.impulse.expected.confidence.toFixed(2)} confidence)`))

  const input = {
    citta,
    manifestations: [...seeds.values()]
      .filter(seed => seed.situation === contact.situation)
      .map(seed => ({ seed, current: seed.potency, via: 'exact' })),
    turnings: [],
    maxFactors: 5,
    manasWarning: 0.5,
    turningMaxAgeMs: 30 * 60 * 1000,
    lastSurprise: reception.impulse.surprise,
    stirred: reception.impulse.factors,
    now: clock,
  }
  const rendered = mode === 'report' ? renderSelfReport(input) : renderFeltState(input)
  const body = rendered.split('\n\n')[0]
  console.log(body.length === 0
    ? dim('   (nothing reaches the prompt)')
    : body.split('\n').map(line => `   ${bold('▸')} ${line}`).join('\n'))
}

console.log()
console.log(bold('── what it kept'))
for (const seed of [...seeds.values()].sort((a, b) => b.count - a.count)) {
  console.log(`   ${seed.situation.padEnd(30)} ×${String(seed.count).padEnd(3)}`
    + `${tone(seed.valence)}${seed.valence >= 0 ? '+' : ''}${seed.valence.toFixed(2)}[0m`
    + dim(`  potency ${seed.potency.toFixed(2)}`))
}
