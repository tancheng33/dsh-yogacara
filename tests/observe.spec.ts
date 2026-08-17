import { describe, expect, it } from 'vitest'
import { contactFromTool, gateFor, normalizeSubject, payloadSegment, subjectOf } from '../src/observe.ts'

const T0 = 1_700_000_000_000

describe('which gate a tool result reaches', () => {
  it('reads retrieval as looking', () => {
    expect(gateFor('read', 'src/index.ts')).toBe('eye')
    expect(gateFor('grep', 'TODO')).toBe('eye')
    expect(gateFor('web_fetch', 'https://example.com')).toBe('eye')
  })

  it('reads being answered as hearing', () => {
    expect(gateFor('ask_user_question', 'which one?')).toBe('ear')
    expect(gateFor('subagent', 'investigate the flake')).toBe('ear')
  })

  it('reads mutation as the world\'s resistance', () => {
    expect(gateFor('write', 'src/new.ts')).toBe('body')
    expect(gateFor('edit', 'src/index.ts')).toBe('body')
  })

  it('distinguishes tasting one\'s own product from merely acting', () => {
    expect(gateFor('bash', 'pytest -q tests/')).toBe('tongue')
    expect(gateFor('bash', 'npm run build')).toBe('tongue')
    expect(gateFor('bash', 'cargo test --all')).toBe('tongue')
    expect(gateFor('bash', 'git status')).toBe('body')
    expect(gateFor('bash', 'ls -la')).toBe('body')
  })

  it('treats an unknown tool as looking, the reading that moves the mind least', () => {
    expect(gateFor('some_third_party_tool', 'whatever')).toBe('eye')
  })
})

describe('what a call is about', () => {
  it('finds the identifying argument whatever it is called', () => {
    expect(subjectOf({ command: 'pytest -q' })).toBe('pytest -q')
    expect(subjectOf({ file_path: '/a/b.ts' })).toBe('/a/b.ts')
    expect(subjectOf({ query: 'yogacara' })).toBe('yogacara')
  })

  it('survives arguments that identify nothing', () => {
    expect(subjectOf(undefined)).toBe('')
    expect(subjectOf(null)).toBe('')
    expect(subjectOf({ todos: [] })).toBe('')
    expect(subjectOf('a bare string')).toBe('')
  })

  it('drops flags, so the same work under different flags shares a seed', () => {
    expect(normalizeSubject('pytest -q tests/unit --maxfail=1')).toBe('pytest-tests/unit')
    expect(normalizeSubject('pytest tests/unit')).toBe('pytest-tests/unit')
  })

  it('keeps genuinely different targets apart', () => {
    expect(normalizeSubject('pytest tests/unit'))
      .not.toBe(normalizeSubject('pytest tests/e2e'))
  })

  it('looks past a word that only delegates, so two scripts are two seeds', () => {
    expect(normalizeSubject('npm run build')).toBe('npm-run-build')
    expect(normalizeSubject('npm run test')).toBe('npm-run-test')
    expect(normalizeSubject('pnpm run test:unit')).toBe('pnpm-run-test:unit')
    expect(normalizeSubject('python -m pytest tests/')).toBe('python-m-pytest')
  })

  it('still merges the same command over changing arguments beyond the head', () => {
    expect(normalizeSubject('git commit -m wip')).toBe('git-commit')
    expect(normalizeSubject('git commit -m "another message"')).toBe('git-commit')
  })

  it('keeps the tail of a path so two files stay distinct', () => {
    expect(normalizeSubject('/very/deep/pkg/src/index.ts')).toBe('src/index.ts')
    expect(normalizeSubject('/very/deep/pkg/src/other.ts')).toBe('src/other.ts')
  })

  it('bounds the key and strips what a key may not carry', () => {
    const key = normalizeSubject(`echo ${'x'.repeat(300)}`)
    expect(key.length).toBeLessThanOrEqual(80)
    expect(key).toMatch(/^[A-Za-z0-9._/:-]*$/)
  })
})

describe('the contact a tool result constitutes', () => {
  it('keys the situation by tool and subject', () => {
    const made = contactFromTool('bash', { command: 'pytest -q tests/unit' }, false, T0)
    expect(made.situation).toBe('bash:pytest-tests/unit')
    expect(made.gate).toBe('tongue')
    expect(made.outcome).toBe('favorable')
  })

  it('falls back to the bare tool name when nothing identifies the call', () => {
    expect(contactFromTool('todo_write', { todos: [] }, false, T0).situation).toBe('todo_write')
  })

  it('lets a failure land harder than a success', () => {
    const failed = contactFromTool('bash', { command: 'pytest' }, true, T0)
    const passed = contactFromTool('bash', { command: 'pytest' }, false, T0)
    expect(failed.outcome).toBe('adverse')
    expect(failed.intensity).toBeGreaterThan(passed.intensity)
  })
})

describe('a compound command is about its payload, not its setup', () => {
  it('looks past the navigation that positioned the shell', () => {
    // Taken from a real store: nine different jobs had all collapsed onto `cd`.
    expect(normalizeSubject('cd /tmp/dsh-yogacara && npx vitest run')).toBe('npx-vitest-run')
    expect(normalizeSubject('cd /tmp/dsh-yogacara && npm run build')).toBe('npm-run-build')
    expect(normalizeSubject('cd /tmp/dsh-yogacara && npx vitest run'))
      .not.toBe(normalizeSubject('cd /tmp/dsh-yogacara && npm run build'))
  })

  it('looks past a leading environment assignment', () => {
    expect(normalizeSubject('DST=/a/b/c cp -r lib $DST')).toBe('cp-lib')
  })

  it('keys a pipeline on what produced the output, not what formatted it', () => {
    expect(normalizeSubject('find ~/.dsh -name "*.json" | head -5')).toBe('find-/.dsh')
  })

  it('keeps a bare command untouched', () => {
    expect(payloadSegment('git status')).toBe('git status')
  })

  it('falls back to the whole command when every segment is setup', () => {
    expect(normalizeSubject('cd /tmp && cd /var')).toBe('cd-/tmp')
  })

  it('still reads a test run through the tongue after the setup is stripped', () => {
    expect(gateFor('bash', 'cd /tmp/x && npx vitest run')).toBe('tongue')
  })
})
