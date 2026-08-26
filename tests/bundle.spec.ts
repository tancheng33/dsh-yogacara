/**
 * What this bundle's patch layer is allowed to contribute.
 *
 * A profile composes bundle layers by appending each layer's `insert` rows to
 * one entry list, and the loader rejects that list outright if two rows share
 * an id. So a row this bundle inserts is not a default a later layer can
 * override — it is a row that collides with anyone else who inserts it, and
 * `@deepseek-ai/dsh-web-app` inserts the whole storage stack. Inserting
 * `storage` here broke every web profile at boot (#1).
 * @module dsh-yogacara/tests/bundle
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const patch = readFileSync(fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)), 'utf8')

/** Row ids `@deepseek-ai/dsh-web-app` already inserts. */
const WEB_APP_ROWS = ['storage', 'storage-json', 'storage-domain']

/**
 * The ids this patch inserts, read as text — the package ships no YAML parser,
 * and the shape here is flat enough that a line match is honest.
 * @returns every inserted row id, in file order.
 */
function insertedIds(): string[] {
  return [...patch.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)].map(match => match[1] ?? '')
}

describe('the bundle patch layer', () => {
  it('inserts exactly one row, which is this plugin', () => {
    expect(insertedIds()).toEqual(['yogacara'])
  })

  it('inserts nothing that dsh-web-app also inserts', () => {
    // Renaming a colliding row does not fix it either: a second storage
    // backend under another id competes to provide the same service. The
    // stack belongs to the profile, and the README says how to add one.
    for (const id of WEB_APP_ROWS) {
      expect(insertedIds(), `inserting ${id} collides with dsh-web-app`).not.toContain(id)
    }
  })

  it('tells the reader why the storage rows are absent', () => {
    expect(patch).toMatch(/storage/i)
    expect(patch).toMatch(/README/)
  })
})
