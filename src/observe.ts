/**
 * Translation of harness tool activity into contacts.
 *
 * The agent does not have to narrate every event for the model to move: a tool
 * result is already a moment where an object met a gate. This module decides
 * WHICH gate — running the tests is not the same kind of perception as reading
 * a file — and what situation key the event perfumes. Pure, so the mapping can
 * be argued with in a test rather than only in production.
 * @module dsh-yogacara/observe
 */

import type { Contact, SenseGate } from './types.ts'

/** Tools that are the agent looking at something. */
const EYE_TOOLS: ReadonlySet<string> = new Set([
  'read', 'glob', 'grep', 'list', 'ls', 'web_search', 'web_fetch', 'notebook_read',
])

/** Tools that are the agent being told something. */
const EAR_TOOLS: ReadonlySet<string> = new Set([
  'ask_user_question', 'ask', 'user_input', 'subagent', 'task',
])

/** Tools that change the world and can be refused by it. */
const BODY_TOOLS: ReadonlySet<string> = new Set([
  'write', 'edit', 'multi_edit', 'notebook_edit', 'apply_patch', 'move', 'delete',
])

/** Shell tools, whose gate depends on what the command actually does. */
const SHELL_TOOLS: ReadonlySet<string> = new Set(['bash', 'shell', 'run', 'exec', 'run_code'])

/**
 * Commands whose point is to taste one's own product. Deliberately narrow: a
 * `git status` is looking, a `pytest` is tasting.
 */
const TASTE_PATTERN =
  /\b(test|tests|pytest|vitest|jest|mocha|go\s+test|cargo\s+test|tsc|typecheck|build|lint|eslint|ruff|mypy|make\s+check|npm\s+run|pnpm\s+run|yarn\s+run)\b/

/** Characters kept in a situation key; everything else collapses to `-`. */
const KEY_UNSAFE = /[^A-Za-z0-9._/:-]+/g

/** Upper bound on a derived situation key. */
const KEY_MAX = 80

/**
 * Which gate a tool result reaches.
 * @param toolName - The registered tool name.
 * @param subject - The derived subject, used to tell a test run from a listing.
 * @returns the sense gate.
 */
export function gateFor(toolName: string, subject: string): SenseGate {
  const name = toolName.toLowerCase()
  if (EYE_TOOLS.has(name)) return 'eye'
  if (EAR_TOOLS.has(name)) return 'ear'
  if (BODY_TOOLS.has(name)) return 'body'
  if (SHELL_TOOLS.has(name)) return TASTE_PATTERN.test(subject) ? 'tongue' : 'body'
  // An unknown tool is most often a retrieval of some kind; looking is the
  // conservative reading, since it moves the mind least.
  return 'eye'
}

/**
 * The subject of a tool call: the part of its arguments that identifies WHICH
 * situation this is, so two runs of the same test share a seed and two edits of
 * different files do not.
 * @param args - The tool's parsed arguments, whatever shape they took.
 * @returns the subject, or an empty string when nothing identifying was found.
 */
export function subjectOf(args: unknown): string {
  if (typeof args !== 'object' || args === null) return ''
  const record = args as Record<string, unknown>
  for (const key of ['command', 'path', 'file_path', 'pattern', 'query', 'url', 'description']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return ''
}

/**
 * Reduce a subject to a stable key: the head of a command, or the tail of a
 * path. A key that changes on every call would give every call its own seed and
 * the store would never accumulate anything.
 * @param subject - The raw subject.
 * @returns the normalized key fragment, possibly empty.
 */
export function normalizeSubject(subject: string): string {
  if (subject.length === 0) return ''
  const trimmed = subject.trim()
  // A path keeps its last two segments; a command keeps its first two words.
  const looksLikePath = /^[./~]|\.[A-Za-z0-9]{1,8}$/.test(trimmed) && !trimmed.includes(' ')
  const head = looksLikePath
    ? trimmed.split('/').filter(Boolean).slice(-2).join('/')
    : trimmed.split(/\s+/).slice(0, 2).join(' ')
  return head.replace(KEY_UNSAFE, '-').replace(/^-+|-+$/g, '').slice(0, KEY_MAX)
}

/**
 * Build the contact one tool result constitutes.
 *
 * Intensity is not uniform: a failure lands harder than a success, because a
 * result that matches expectation carries less information than one that does
 * not — which is as true for an agent as the classical account says it is for
 * anyone else.
 * @param toolName - The registered tool name.
 * @param args - The tool's parsed arguments.
 * @param isError - Whether the call failed.
 * @param at - Wall-clock milliseconds.
 * @returns the contact to receive.
 */
export function contactFromTool(
  toolName: string,
  args: unknown,
  isError: boolean,
  at: number,
): Contact {
  const subject = subjectOf(args)
  const key = normalizeSubject(subject)
  const gate = gateFor(toolName, subject)
  return {
    gate,
    situation: key.length === 0 ? toolName : `${toolName}:${key}`,
    outcome: isError ? 'adverse' : 'favorable',
    intensity: isError ? 0.6 : 0.3,
    at,
  }
}
